import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  B2ApiError,
  createB2ApiClient,
  type B2Beneficiary,
  type B2BriefingResponse,
  type B2AccessException,
  type B2Referral,
  type B2Task,
  type B2TaskAction,
  type B2TaskProgressSnapshot,
  submitAndVerifyTaskProgress,
  verifyTaskProgressReadback,
} from '../services/b2Api';

const SYNTHETIC_LABEL = 'SYNTHETIC DATA · DEVELOPMENT ONLY';
const OUTCOME_CODES = [
  'service_contact_recorded', 'appointment_recorded', 'follow_up_requested',
  'facility_unavailable', 'not_attended', 'unknown', 'other_workflow_outcome',
] as const;
const EXCEPTION_TYPES = [
  'pending_mobile_verification', 'identity_mismatch', 'document_unavailable',
  'benefit_access_blocked', 'other_review_needed',
] as const;
const EXCEPTION_RESOLUTIONS = [
  'verification_completed', 'manual_review_completed', 'records_corrected_by_authorized_process',
  'referred_to_responsible_office', 'no_barrier_found', 'other_review_outcome',
] as const;

export const SyntheticOperationsPage: React.FC = () => {
  const { supabaseSession, backendProfile, profileStatus, authInitializing, authMessage } = useAuth();
  const [briefing, setBriefing] = useState<B2BriefingResponse | null>(null);
  const [tasks, setTasks] = useState<B2Task[] | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<B2Beneficiary[] | null>(null);
  const [referrals, setReferrals] = useState<B2Referral[] | null>(null);
  const [exceptions, setExceptions] = useState<B2AccessException[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState('');
  const [referralKind, setReferralKind] = useState<'general' | 'deic'>('general');
  const [destination, setDestination] = useState('');
  const [reasonCode, setReasonCode] = useState('case_follow_up');
  const [exceptionType, setExceptionType] = useState<string>(EXCEPTION_TYPES[0]);
  const [resolutionCodes, setResolutionCodes] = useState<Record<string, string>>({});
  const [dueOn, setDueOn] = useState('');
  const [progressNotes, setProgressNotes] = useState<Record<string, string>>({});
  const [pendingProgress, setPendingProgress] = useState<Record<string, { before: B2TaskProgressSnapshot; note: string }>>({});
  const pendingProgressRef = useRef<Record<string, { before: B2TaskProgressSnapshot; note: string }>>({});
  const taskActionsInFlight = useRef(new Set<string>());
  const [outcomeCodes, setOutcomeCodes] = useState<Record<string, string>>({});

  const accessToken = supabaseSession?.access_token || '';
  const role = backendProfile?.role;
  const centreScopes = backendProfile?.scopes.filter((scope) => scope.type === 'centre') || [];
  const centreId = centreScopes.length === 1 ? centreScopes[0].id : '';
  const eligibleProfile = backendProfile?.identity_mode === 'supabase'
    && backendProfile.demo === false && backendProfile.is_active === true;
  const api = useMemo(() => {
    const baseUrl = import.meta.env.VITE_B2_API_URL?.trim();
    if (!baseUrl) return null;
    try { return createB2ApiClient(baseUrl); } catch { return null; }
  }, []);

  const canViewTasks = role === 'AWW' || role === 'LS' || role === 'CDPO';
  const canViewReferrals = role === 'AWW' || role === 'LS' || role === 'CDPO';
  const canCreateReferral = canViewReferrals;
  const canRecordReferralOutcome = role === 'LS' || role === 'CDPO';
  const canViewExceptions = role === 'LS';
  const canCreateException = role === 'AWW' || role === 'LS';
  const canResolveException = role === 'LS';

  const refresh = useCallback(async (manual = false) => {
    if (!api || !accessToken || !eligibleProfile) return;
    if (role !== 'DPO' && !centreId) {
      setError('B2 did not return exactly one centre scope. Choose an authorized centre after a trusted centre-list contract is available.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const briefingResult = await api.getBriefing(role === 'DPO' ? undefined : centreId, accessToken);
      setBriefing(briefingResult);
      if (!centreId || !canViewTasks) setTasks(null);
      else {
        const refreshedTasks = (await api.listTasks(centreId, accessToken)).tasks;
        setTasks(refreshedTasks);
        let confirmed = 0;
        let absent = 0;
        for (const [taskId, pending] of Object.entries(pendingProgressRef.current)) {
          const task = refreshedTasks.find((item) => item.task_id === taskId);
          if (!task) continue;
          const result = verifyTaskProgressReadback(pending.before, task, pending.note);
          if (result === 'committed') {
            delete pendingProgressRef.current[taskId];
            confirmed += 1;
          } else if (result === 'not_committed' && manual) {
            delete pendingProgressRef.current[taskId];
            absent += 1;
          }
        }
        if (confirmed || absent) {
          setPendingProgress({ ...pendingProgressRef.current });
          setNotice([
            confirmed ? `Fresh B2 data confirmed ${confirmed} progress append${confirmed === 1 ? '' : 's'}.` : '',
            absent ? `Fresh B2 data showed no new append for ${absent} request${absent === 1 ? '' : 's'}; no save is claimed.` : '',
            'Review the updated history before any new action.',
          ].filter(Boolean).join(' '));
        }
        if (manual && Object.keys(pendingProgressRef.current).length) {
          setError('A fresh B2 read did not uniquely reconcile every progress request. Those tasks remain locked; review the task history with an authorized supervisor. Do not retry an ambiguous action.');
        }
      }
      if (!centreId || !canViewReferrals) {
        setBeneficiaries(null);
        setReferrals(null);
      } else {
        const [beneficiaryResult, referralResult] = await Promise.all([
          api.listBeneficiaries(centreId, accessToken),
          api.listReferrals(centreId, accessToken),
        ]);
        setBeneficiaries(beneficiaryResult.beneficiaries);
        setSelectedBeneficiary((current) => beneficiaryResult.beneficiaries.some((item) => item.beneficiary_id === current)
          ? current : beneficiaryResult.beneficiaries[0]?.beneficiary_id || '');
        setReferrals(referralResult.referrals);
      }
      if (!centreId || !canViewExceptions) setExceptions(null);
      else setExceptions((await api.listAccessExceptions(centreId, accessToken)).exceptions);
    } catch (cause) {
      setBriefing(null);
      setTasks(null);
      setBeneficiaries(null);
      setReferrals(null);
      setExceptions(null);
      setError(cause instanceof Error ? cause.message : 'B2 operations data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [api, accessToken, eligibleProfile, role, centreId, canViewTasks, canViewReferrals, canViewExceptions]);

  useEffect(() => {
    if (profileStatus === 'ready' && eligibleProfile) void refresh();
    else {
      setBriefing(null);
      setTasks(null);
      setBeneficiaries(null);
      setReferrals(null);
      setExceptions(null);
      pendingProgressRef.current = {};
      setPendingProgress({});
    }
  }, [profileStatus, eligibleProfile, refresh]);

  const runTaskAction = async (task: B2Task, action: B2TaskAction) => {
    if (!api || !accessToken || !centreId) return;
    if (taskActionsInFlight.current.has(task.task_id) || pendingProgressRef.current[task.task_id]) return;
    const notes = progressNotes[task.task_id]?.trim();
    if (action === 'record_progress' && !notes) {
      setError('Enter a progress note before recording progress.');
      return;
    }
    taskActionsInFlight.current.add(task.task_id);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (action === 'record_progress') {
        const attempt = await submitAndVerifyTaskProgress(
          task,
          notes || '',
          async () => (await api.applyTaskAction(task.task_id, action, accessToken, { notes })).task,
          async () => (await api.listTasks(centreId, accessToken)).tasks,
        );
        if (attempt.tasks) setTasks(attempt.tasks);
        if (attempt.status === 'committed' && attempt.tasks) {
          setNotice(`A fresh B2 read contains one matching appended progress note and event for ${task.task_id}. The current API has no event ID, so identical concurrent writes cannot be uniquely attributed.`);
          setProgressNotes((current) => ({ ...current, [task.task_id]: '' }));
          return;
        }
        pendingProgressRef.current[task.task_id] = { before: attempt.before, note: notes || '' };
        setPendingProgress({ ...pendingProgressRef.current });
        if (attempt.status === 'ambiguous') {
          setError(attempt.phase === 'post'
            ? 'B2 did not confirm the progress request. Its outcome may be ambiguous; this task is locked until you refresh and reconcile its B2 history. Do not retry yet.'
            : attempt.phase === 'readback'
              ? 'B2 accepted the progress request, but read-back failed. Its outcome is ambiguous; this task is locked until you refresh and reconcile its B2 history. Do not retry yet.'
              : 'B2 returned inconsistent progress data. This task is locked until you refresh and reconcile its history. Do not retry yet.');
          return;
        }
        setError('The first fresh B2 read did not show a newly appended progress entry. No successful save is claimed; the task stays locked until a second manual refresh reconciles the result. Do not retry yet.');
        return;
      }
      const saved = await api.applyTaskAction(task.task_id, action, accessToken, { notes });
      let refreshed: B2Task[];
      try {
        refreshed = (await api.listTasks(centreId, accessToken)).tasks;
      } catch {
        throw new Error('B2 accepted the action, but its fresh task list could not be read. Refresh to verify the result before retrying.');
      }
      const persisted = refreshed.find((item) => item.task_id === task.task_id);
      const expectedStatus = action === 'acknowledge' ? 'acknowledged'
        : action === 'start' ? 'in_progress' : task.status;
      if (!persisted || persisted.status !== expectedStatus || saved.task.status !== expectedStatus) {
        setTasks(refreshed);
        setError('B2 accepted the action, but a fresh task-list read did not confirm the saved result. Treat this action as unverified and refresh before retrying.');
        return;
      }
      setTasks(refreshed);
      setNotice(`B2 confirmed ${action.replace('_', ' ')} for ${task.task_id} in persisted task data.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'B2 could not confirm the task action.');
    } finally {
      taskActionsInFlight.current.delete(task.task_id);
      setSaving(false);
    }
  };

  const createReferral = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!api || !accessToken || !selectedBeneficiary || !destination.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.createReferral({
        beneficiary_id: selectedBeneficiary,
        referral_kind: referralKind,
        destination: destination.trim(),
        reason_code: reasonCode,
        ...(dueOn ? { due_on: dueOn } : {}),
      }, accessToken);
      const refreshed = (await api.listReferrals(centreId, accessToken)).referrals;
      if (!refreshed.some((item) => item.referral_id === saved.referral.referral_id
          && item.beneficiary_id === saved.referral.beneficiary_id
          && item.centre_id === centreId
          && item.referral_kind === saved.referral.referral_kind
          && item.reason_code === saved.referral.reason_code
          && item.status === 'sent')) {
        setReferrals(refreshed);
        setError('B2 accepted the referral, but a fresh referral-list read did not confirm it. Treat the result as unverified and refresh before retrying.');
        return;
      }
      setReferrals(refreshed);
      setNotice(`B2 confirmed referral ${saved.referral.referral_id} and its sent status in persisted data.`);
      setDestination('');
      setDueOn('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'B2 could not confirm the referral.');
    } finally {
      setSaving(false);
    }
  };

  const runReferralAction = async (referral: B2Referral, action: 'acknowledge' | 'attend' | 'record_outcome') => {
    if (!api || !accessToken || !centreId) return;
    const outcome = outcomeCodes[referral.referral_id] || '';
    if (action === 'record_outcome' && !outcome) {
      setError('Select an outcome code before recording the referral outcome.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.applyReferralAction(referral.referral_id, action, accessToken, outcome || undefined);
      const refreshed = (await api.listReferrals(centreId, accessToken)).referrals;
      const expectedStatus = action === 'acknowledge' ? 'acknowledged'
        : action === 'attend' ? 'attended' : 'outcome_recorded';
      const persisted = refreshed.find((item) => item.referral_id === referral.referral_id);
      if (!persisted || persisted.status !== expectedStatus || saved.referral.status !== expectedStatus
          || (action === 'record_outcome' && persisted.outcome_code !== outcome)) {
        setReferrals(refreshed);
        setError('B2 accepted the action, but a fresh referral-list read did not confirm the saved result. Treat this action as unverified and refresh before retrying.');
        return;
      }
      setReferrals(refreshed);
      setNotice(`B2 confirmed ${action.replace('_', ' ')} for referral ${referral.referral_id} in persisted data.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'B2 could not confirm the referral action.');
    } finally {
      setSaving(false);
    }
  };

  const createException = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!api || !accessToken || !selectedBeneficiary) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.createAccessException({ beneficiary_id: selectedBeneficiary, exception_type: exceptionType }, accessToken);
      if (!canViewExceptions) {
        setError(`B2 accepted coded exception ${saved.exception.exception_id}, but this role cannot read the exception list. Persistence is unverified; ask an authorized supervisor to review it.`);
        return;
      }
      const refreshed = (await api.listAccessExceptions(centreId, accessToken)).exceptions;
      if (!refreshed.some((item) => item.exception_id === saved.exception.exception_id
          && item.beneficiary_id === saved.exception.beneficiary_id
          && item.centre_id === centreId
          && item.exception_type === saved.exception.exception_type
          && item.status === 'open')) {
        setExceptions(refreshed);
        setError('B2 accepted the coded exception, but fresh history did not confirm it. Treat the result as unverified and refresh before retrying.');
        return;
      }
      setExceptions(refreshed);
      setNotice(`B2 confirmed human-review exception ${saved.exception.exception_id} in persisted data. It does not deny access or determine eligibility.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'B2 could not confirm the access exception.');
    } finally {
      setSaving(false);
    }
  };

  const resolveException = async (record: B2AccessException) => {
    if (!api || !accessToken || !centreId) return;
    const code = resolutionCodes[record.exception_id] || EXCEPTION_RESOLUTIONS[0];
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.resolveAccessException(record.exception_id, code, accessToken);
      const refreshed = (await api.listAccessExceptions(centreId, accessToken)).exceptions;
      const persisted = refreshed.find((item) => item.exception_id === record.exception_id);
      if (!persisted || persisted.status !== 'resolved' || persisted.resolution_code !== code
          || saved.exception.status !== 'resolved') {
        setExceptions(refreshed);
        setError('B2 accepted the resolution, but fresh history did not confirm it. Treat the result as unverified and refresh before retrying.');
        return;
      }
      setExceptions(refreshed);
      setNotice(`B2 confirmed resolution of ${record.exception_id} in persisted data.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'B2 could not confirm the exception resolution.');
    } finally {
      setSaving(false);
    }
  };

  if (!import.meta.env.DEV) return <Unavailable message="This synthetic B2 workspace is available only in a development build." />;
  if (authInitializing || profileStatus === 'loading') return <Unavailable message="Waiting for a provider session and server-resolved B2 profile." />;
  if (!supabaseSession) return <Unavailable message="A provider session is required. The local demo persona does not authenticate to B2." />;
  if (!api) return <Unavailable message="Configure VITE_B2_API_URL to use the B2 API. No local demo data is substituted." />;
  if (profileStatus !== 'ready' || !eligibleProfile) return <Unavailable message={authMessage || 'B2 has not returned an active provider-backed profile.'} />;
  if (role !== 'DPO' && !centreId) return <Unavailable message="This workspace needs one centre in the server-resolved profile. A centre picker is unavailable until B2 provides an authorized centre-list contract." />;

  const counts = briefing?.counts;
  const countCards: Array<[string, unknown]> = [
    ['Flags', counts?.flags], ['Tasks', counts?.tasks], ['Active tasks', counts?.active_tasks], ['As of', briefing?.as_of],
  ];
  return (
    <main className="min-h-screen bg-[#F5F9FC] px-4 py-8 text-[#0E1B2B] sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <header className="rounded-3xl border border-amber-300 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">{SYNTHETIC_LABEL}</p>
          <h1 className="mt-2 text-2xl font-semibold">B2 backend briefing and workflow</h1>
          <p className="mt-2 text-sm text-amber-950">Counts, tasks, beneficiaries, and referrals below come only from B2. Existing demo screens remain separate and are not used as a fallback.</p>
          <p className="mt-2 font-mono text-xs text-amber-900">{role === 'DPO' ? `Server scope: ${briefing?.scope || 'district aggregate'}` : `Server-assigned centre: ${centreId}`}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/synthetic-workflow" className="rounded-xl border border-amber-500 px-3 py-2 text-sm">Beneficiaries and measurements</Link>
            <button type="button" onClick={() => void refresh(true)} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-xl border border-amber-500 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh from B2</button>
          </div>
        </header>

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="B2 saved-record counts">
          {countCards.map(([label, value]) => (
            <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">B2 {label}</p>
              <p className="mt-2 text-2xl font-semibold">{value === undefined ? (loading ? 'Loading…' : 'Unavailable') : String(value)}</p>
            </article>
          ))}
        </section>
        <p className="text-xs text-slate-500">{briefing?.counts_source || 'Counts are returned by B2 from saved backend records.'}</p>

        {canViewTasks && <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
          <div><h2 className="text-lg font-semibold">B2 task queue</h2><p className="text-xs text-slate-500">Raw B2 task IDs and statuses. The API enforces role, worker, and centre scope.</p></div>
          {tasks === null ? <p className="text-sm text-slate-500">{loading ? 'Loading tasks from B2…' : 'Task list unavailable.'}</p>
            : tasks.length === 0 ? <p className="text-sm text-slate-600">B2 returned no tasks for this authorized scope.</p>
              : tasks.map((task) => <TaskCard key={task.task_id} task={task} role={role || ''} saving={saving} locked={Boolean(pendingProgress[task.task_id])} notes={progressNotes[task.task_id] || ''} onNotes={(value) => setProgressNotes((current) => ({ ...current, [task.task_id]: value }))} onAction={(action) => void runTaskAction(task, action)} />)}
        </section>}

        {canViewReferrals && <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
          <div><h2 className="text-lg font-semibold">B2 referrals and follow-up</h2><p className="text-xs text-slate-500">B2 supports coded referral creation, acknowledgement, attendance, and outcome recording. These are operational states, not clinical determinations.</p></div>
          {canCreateReferral && beneficiaries && <form onSubmit={(event) => void createReferral(event)} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
            <label className="text-sm">B2 beneficiary<select required value={selectedBeneficiary} onChange={(event) => setSelectedBeneficiary(event.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2">{beneficiaries.map((item) => <option key={item.beneficiary_id} value={item.beneficiary_id}>{item.beneficiary_id}</option>)}</select></label>
            <label className="text-sm">Referral type<select value={referralKind} onChange={(event) => setReferralKind(event.target.value as 'general' | 'deic')} className="mt-1 block w-full rounded-lg border bg-white p-2"><option value="general">General</option><option value="deic">DEIC</option></select></label>
            <label className="text-sm">Destination<input required value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={160} className="mt-1 block w-full rounded-lg border bg-white p-2" /></label>
            <label className="text-sm">Reason code<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2"><option value="case_follow_up">Case follow-up</option><option value="verification_follow_up">Verification follow-up</option><option value="disability_service_follow_up">Disability service follow-up</option><option value="service_follow_up">Service follow-up</option><option value="other_approved_workflow">Other approved workflow</option></select></label>
            <label className="text-sm">Due date (optional)<input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2" /></label>
            <button type="submit" disabled={saving || !selectedBeneficiary || !destination.trim() || Boolean(error)} className="self-end rounded-lg bg-[#0E1B2B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create referral in B2</button>
          </form>}
          {referrals === null ? <p className="text-sm text-slate-500">{loading ? 'Loading referrals from B2…' : 'Referral list unavailable.'}</p>
            : referrals.length === 0 ? <p className="text-sm text-slate-600">B2 returned no referrals for this authorized scope.</p>
              : referrals.map((referral) => <ReferralCard key={referral.referral_id} referral={referral} canRecordOutcome={canRecordReferralOutcome} outcome={outcomeCodes[referral.referral_id] || OUTCOME_CODES[0]} onOutcome={(value) => setOutcomeCodes((current) => ({ ...current, [referral.referral_id]: value }))} saving={saving} onAction={(action) => void runReferralAction(referral, action)} />)}
        </section>}

        {(canViewExceptions || canCreateException) && <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
          <div><h2 className="text-lg font-semibold">Human-reviewed access exceptions</h2><p className="text-xs text-slate-500">Coded barriers only. These records never deny access or make eligibility decisions.</p></div>
          {canCreateException && beneficiaries && <form onSubmit={(event) => void createException(event)} className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4">
            <label className="text-sm">B2 beneficiary<select required value={selectedBeneficiary} onChange={(event) => setSelectedBeneficiary(event.target.value)} className="mt-1 block rounded-lg border bg-white p-2">{beneficiaries.map((item) => <option key={item.beneficiary_id} value={item.beneficiary_id}>{item.beneficiary_id}</option>)}</select></label>
            <label className="text-sm">Coded barrier<select value={exceptionType} onChange={(event) => setExceptionType(event.target.value)} className="mt-1 block rounded-lg border bg-white p-2">{EXCEPTION_TYPES.map((code) => <option key={code} value={code}>{code.replaceAll('_', ' ')}</option>)}</select></label>
            <button type="submit" disabled={saving || !selectedBeneficiary || Boolean(error)} className="rounded-lg bg-[#0E1B2B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Open human review in B2</button>
          </form>}
          {!canViewExceptions && <p className="text-sm text-slate-600">This role may submit a coded human-review exception but cannot view the exception list. B2 writes remain unverified to this role; an authorized supervisor must confirm them.</p>}
          {canViewExceptions && exceptions === null ? <p className="text-sm text-slate-500">{loading ? 'Loading exceptions from B2…' : 'Exception list unavailable.'}</p>
            : canViewExceptions && exceptions?.length === 0 ? <p className="text-sm text-slate-600">B2 returned no access exceptions for this authorized scope.</p>
              : canViewExceptions && exceptions?.map((record) => <article key={record.exception_id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap justify-between gap-2"><p className="font-mono text-sm font-semibold">{record.exception_id}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{record.status}</span></div>
                <p className="mt-2 text-xs text-slate-600">{record.beneficiary_id} · {record.exception_type.replaceAll('_', ' ')} · opened {record.opened_at}</p>
                {record.status === 'open' && canResolveException && <div className="mt-3 flex flex-wrap gap-2"><select aria-label={`Resolution for ${record.exception_id}`} value={resolutionCodes[record.exception_id] || EXCEPTION_RESOLUTIONS[0]} onChange={(event) => setResolutionCodes((current) => ({ ...current, [record.exception_id]: event.target.value }))} className="rounded-lg border p-2 text-sm">{EXCEPTION_RESOLUTIONS.map((code) => <option key={code} value={code}>{code.replaceAll('_', ' ')}</option>)}</select><button type="button" disabled={saving} onClick={() => void resolveException(record)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Resolve via B2</button></div>}
              </article>)}
        </section>}
      </div>
    </main>
  );
};

const TaskCard: React.FC<{ task: B2Task; role: string; saving: boolean; locked: boolean; notes: string; onNotes: (value: string) => void; onAction: (action: B2TaskAction) => void }> = ({ task, role, saving, locked, notes, onNotes, onAction }) => {
  const canUseTaskActions = role === 'AWW' || role === 'LS';
  const actions: B2TaskAction[] = task.status === 'assigned' || task.status === 'escalated' ? ['acknowledge']
    : task.status === 'acknowledged' ? ['start']
      : task.status === 'in_progress' ? ['record_progress'] : [];
  return <article className="rounded-2xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-sm font-semibold">{task.task_id}</p><p className="mt-1 text-xs text-slate-600">Beneficiary {task.beneficiary_id} · Flag {task.flag_id}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{task.status}</span></div>
    <p className="mt-2 text-xs text-slate-500">{task.alert_level} · {task.colour} · Due {task.due_on || 'not set'} · owner {task.owner_id || 'unassigned'}</p>
    <p className="mt-2 text-xs text-slate-500">Escalation level {task.escalation_level} Â· {task.events.length} recorded event{task.events.length === 1 ? '' : 's'}</p>
    {task.events.length > 0 && <details className="mt-3 rounded-lg bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-medium">B2 task history</summary>
      <ol className="mt-2 space-y-2">
        {task.events.map((event, index) => <li key={`${event.at}-${event.event}-${index}`} className="border-l-2 border-slate-300 pl-3 text-xs">
          <p className="font-medium">{event.event.replaceAll('_', ' ')} Â· {event.at}</p>
          <p className="text-slate-500">Actor {event.actor_id}</p>
          {typeof event.details.notes === 'string' && event.details.notes && <p className="mt-1 whitespace-pre-wrap text-slate-700">{event.details.notes}</p>}
          {typeof event.details.reason === 'string' && event.details.reason && <p className="mt-1 text-slate-700">Reason: {event.details.reason}</p>}
        </li>)}
      </ol>
    </details>}
    {actions.includes('record_progress') && canUseTaskActions && <label className="mt-3 block text-sm">Progress note<textarea value={notes} onChange={(event) => onNotes(event.target.value)} maxLength={500} rows={2} className="mt-1 block w-full rounded-lg border p-2" /></label>}
    {locked && <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Progress outcome is ambiguous. Actions are locked; use “Refresh from B2” to reconcile before retrying.</p>}
    {canUseTaskActions && actions.map((action) => <button key={action} type="button" disabled={saving || locked || (action === 'record_progress' && !notes.trim())} onClick={() => onAction(action)} className="mt-3 mr-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{action.replace('_', ' ')}</button>)}
    {!actions.length && <p className="mt-3 text-xs text-slate-500">No Phase 1 task transition is available for this current status. Assignment, escalation, and closure controls are not exposed here.</p>}
  </article>;
};

const ReferralCard: React.FC<{ referral: B2Referral; canRecordOutcome: boolean; outcome: string; onOutcome: (value: string) => void; saving: boolean; onAction: (action: 'acknowledge' | 'attend' | 'record_outcome') => void }> = ({ referral, canRecordOutcome, outcome, onOutcome, saving, onAction }) => {
  const canAcknowledge = referral.status === 'sent';
  const canAttend = referral.status === 'sent' || referral.status === 'acknowledged';
  const canOutcome = referral.status === 'attended' && canRecordOutcome;
  return <article className="rounded-2xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-sm font-semibold">{referral.referral_id}</p><p className="mt-1 text-xs text-slate-600">Beneficiary {referral.beneficiary_id} · {referral.referral_kind} · {referral.destination}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{referral.status}</span></div>
    <p className="mt-2 text-xs text-slate-500">Reason {referral.reason_code} · due {referral.due_on || 'not set'} · task {referral.task_id || 'none'}</p>
    {canAcknowledge && <button type="button" disabled={saving} onClick={() => onAction('acknowledge')} className="mt-3 mr-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Acknowledge</button>}
    {canAttend && <button type="button" disabled={saving} onClick={() => onAction('attend')} className="mt-3 mr-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Record attendance</button>}
    {canOutcome && <div className="mt-3 flex flex-wrap gap-2"><select value={outcome} onChange={(event) => onOutcome(event.target.value)} className="rounded-lg border p-2 text-sm">{OUTCOME_CODES.map((code) => <option key={code} value={code}>{code.replaceAll('_', ' ')}</option>)}</select><button type="button" disabled={saving} onClick={() => onAction('record_outcome')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Record outcome</button></div>}
    {referral.status === 'attended' && !canRecordOutcome && <p className="mt-3 text-xs text-slate-500">Outcome recording requires a server-authorized LS or CDPO role.</p>}
  </article>;
};

const Unavailable: React.FC<{ message: string }> = ({ message }) => <main className="min-h-screen bg-[#F5F9FC] p-6 text-[#0E1B2B]"><section className="mx-auto mt-12 max-w-2xl rounded-3xl border border-amber-300 bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-amber-800">{SYNTHETIC_LABEL}</p><h1 className="mt-3 text-2xl font-semibold">B2 operations unavailable</h1><p role="status" className="mt-3 text-sm text-slate-700">{message}</p><p className="mt-3 flex gap-2 text-xs text-slate-500"><ShieldAlert className="h-4 w-4 shrink-0" />No local demo records are used as a substitute.</p><Link to="/dashboard" className="mt-6 inline-flex items-center gap-2 text-sm text-blue-700"><ArrowLeft className="h-4 w-4" /> Dashboard</Link></section></main>;
