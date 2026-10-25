import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Baby,
  Calendar,
  Phone,
  MapPin,
  ShieldCheck,
  Scale,
  Ruler,
  Activity,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronRight,
  X,
  Check,
  ArrowLeft,
  Sparkles,
  Info,
  Clock,
  Heart,
  Send,
  UserCheck,
  Lock,
} from 'lucide-react';
import { mockStore, BeneficiaryCase } from '../store/mockStore';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { DataBadge } from '../components/common/DataBadge';

interface MeasurementRow {
  date: string;
  ageMonths: number;
  weight: number;
  height: number;
  muac?: number;
  waz: string;
  flag: string | null;
  recordedBy: string;
  verified: boolean;
}

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  actor: string;
  badge: string;
  badgeColor: string;
}

const mapMeasurementRows = (beneficiaryId: string): MeasurementRow[] =>
  mockStore
    .getMeasurements(beneficiaryId)
    .filter((measurement) => measurement.beneficiaryId === beneficiaryId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((measurement) => {
      const hasFlag = measurement.qualityFlags.length > 0 || measurement.clinicalFlags.length > 0;
      return {
        date: new Date(measurement.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        ageMonths: measurement.ageMonths,
        weight: measurement.weightKg,
        height: measurement.heightCm,
        muac: measurement.muacCm,
        waz: 'Not recorded',
        flag: hasFlag ? (measurement.qualityFlags[0] || measurement.clinicalFlags[0] || 'Flagged') : null,
        recordedBy: measurement.recordedBy,
        verified: measurement.isVerified,
      };
    });

const getTimelineEvents = (beneficiaryId: string): TimelineEvent[] => {
  const cases = mockStore.getCases().filter((record) => record.id === beneficiaryId);
  const measurements = mockStore.getMeasurements(beneficiaryId).filter((record) => record.beneficiaryId === beneficiaryId);
  const referrals = mockStore.getReferrals().filter((record) => record.beneficiaryId === beneficiaryId);
  const audits = mockStore.getAuditLog().filter((record) => record.palId === beneficiaryId);

  const events: TimelineEvent[] = [
    ...measurements.map((measurement) => {
      const flags = [...measurement.qualityFlags, ...measurement.clinicalFlags];
      return {
        id: measurement.id,
        date: measurement.date,
        title: flags.length ? 'Flagged measurement recorded' : 'Measurement recorded',
        description: `${measurement.weightKg} kg / ${measurement.heightCm} cm${measurement.muacCm == null ? '' : ` / MUAC ${measurement.muacCm} cm`}.${flags.length ? ` Recorded flags: ${flags.join('; ')}.` : ''}`,
        actor: measurement.recordedBy,
        badge: measurement.isVerified ? 'Verified reading' : flags.length ? 'Unverified flag' : 'Not verified',
        badgeColor: measurement.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
      };
    }),
    ...cases.map((record) => ({
      id: record.actionId,
      date: record.flaggedDate,
      title: `${record.actionId} · ${record.ruleName}`,
      description: `${record.triggerDetail} Current stored case status: ${record.status}.`,
      actor: record.assignedActor,
      badge: record.isVerified ? 'Verification recorded' : 'Awaiting verification',
      badgeColor: record.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
    })),
    ...audits.map((entry) => {
      const relatedCase = cases.find((record) => record.actionId === entry.actionId);
      const requiresConfirmation = Boolean(relatedCase && !relatedCase.isVerified && entry.actionType.toLowerCase().includes('re-weigh'));
      return {
        id: entry.id,
        date: entry.timestamp,
        title: requiresConfirmation ? `Demo audit record: ${entry.actionType}` : entry.actionType,
        description: `${entry.deltaSummary}${requiresConfirmation ? ` This seeded demo audit entry requires confirmation; the case remains ${relatedCase?.status}.` : ''}`,
        actor: entry.actor,
        badge: requiresConfirmation ? 'Demo record · confirm' : entry.status,
        badgeColor: requiresConfirmation ? 'bg-amber-100 text-amber-800' : entry.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800',
      };
    }),
    ...referrals.flatMap((referral) => [
      {
        id: referral.id,
        date: referral.referralDate,
        title: `Referral recorded: ${referral.destination}`,
        description: `${referral.reason} Stored workflow status: ${referral.status}.${referral.status === 'Completed' ? ' This status does not independently confirm clinical resolution.' : ''}`,
        actor: referral.owner,
        badge: referral.status === 'Completed' ? 'Completed · demo status' : referral.status,
        badgeColor: referral.status === 'Completed' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800',
      },
      ...(referral.finalOutcome?.trim() ? [{
        id: `${referral.id}-outcome`,
        date: referral.outcomeDate || referral.referralDate,
        title: 'Demo referral outcome recorded · confirmation required',
        description: `Stored demo outcome: ${referral.finalOutcome}. This outcome requires confirmation.`,
        actor: referral.owner,
        badge: 'Demo record · confirm',
        badgeColor: 'bg-amber-100 text-amber-800',
      }] : []),
      ...referral.followUpAttempts.map((attempt) => ({
        id: `${referral.id}-${attempt.id}`,
        date: attempt.date,
        title: `Demo follow-up record · confirmation required (${attempt.method})`,
        description: `${attempt.findings}${attempt.outcomeNote?.trim() ? ` Recorded note: ${attempt.outcomeNote}` : ''}`,
        actor: attempt.actor,
        badge: 'Demo record · confirm',
        badgeColor: 'bg-amber-100 text-amber-800',
      })),
    ]),
  ];

  return events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
};

export const ChildProfilePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { showToast } = useToast();
  const { isReadOnlyDemo, requireStaffAction, staffUser, role } = useAuth();

  const [activeTab, setActiveTab] = useState<'growth' | 'history' | 'timeline' | 'flags'>('growth');
  const [isRecordPanelOpen, setIsRecordPanelOpen] = useState(false);
  const [, setSummaryRevision] = useState(0);

  const targetId = id || 'BEN-0142';
  const profileScopeKey = JSON.stringify([targetId, role, staffUser?.id, staffUser?.centreCode]);
  const previousProfileScopeKey = useRef(profileScopeKey);
  const [loadedProfileScopeKey, setLoadedProfileScopeKey] = useState(profileScopeKey);
  const beneficiaryExists = Boolean(mockStore.getBeneficiaryById(targetId));
  const beneficiaryIsPermitted = mockStore
    .getBeneficiaries({ role, centreCode: staffUser?.centreCode })
    .some((beneficiary) => beneficiary.id === targetId);

  // Beneficiary data from store
  const [caseItem, setCaseItem] = useState<BeneficiaryCase | undefined>(() => mockStore.getCaseById(targetId));
  const [historyRows, setHistoryRows] = useState<MeasurementRow[]>(() => mapMeasurementRows(targetId));

  useLayoutEffect(() => {
    const profileScopeChanged = previousProfileScopeKey.current !== profileScopeKey;
    previousProfileScopeKey.current = profileScopeKey;
    if (profileScopeChanged) {
      setIsRecordPanelOpen(false);
      setRecordDate('');
      setRecordWeight('');
      setRecordHeight('');
      setRecordMuac('');
      setRecordNotes('');
      setActiveTab('growth');
    }

    const sync = () => {
      setSummaryRevision((revision) => revision + 1);
      setCaseItem(mockStore.getCaseById(targetId));
      setHistoryRows(mapMeasurementRows(targetId));
    };
    sync();
    const unsub = mockStore.subscribe(sync);
    setLoadedProfileScopeKey(profileScopeKey);
    return unsub;
  }, [profileScopeKey, targetId, role, staffUser?.id, staffUser?.centreCode]);

  // Form inputs for Record Measurement panel
  const [recordDate, setRecordDate] = useState('2026-10-24');
  const [recordWeight, setRecordWeight] = useState('8.95');
  const [recordHeight, setRecordHeight] = useState('78.0');
  const [recordMuac, setRecordMuac] = useState('14.2');
  const [recordNotes, setRecordNotes] = useState('Follow-up weigh-in following supervisory spot check.');

  // Esc key dismiss for panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRecordPanelOpen) {
        setIsRecordPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordPanelOpen]);

  // Screening Checks in Record Measurement Panel
  const parsedWeight = parseFloat(recordWeight) || 0;
  const parsedHeight = parseFloat(recordHeight) || 0;
  const lastWeight = historyRows[historyRows.length - 1]?.weight;
  const weightVelocity = lastWeight === undefined ? 0 : parsedWeight - lastWeight;
  const isHighVelocity = weightVelocity > 2.5;

  const handleConfirmAndCreateAction = (e: React.FormEvent) => {
    e.preventDefault();

    if (!requireStaffAction('record physical re-measurements or dispatch casework actions')) {
      setIsRecordPanelOpen(false);
      return;
    }

    // Persist to unified reactive store
    const result = mockStore.recordMeasurement(
      {
        beneficiaryId: targetId,
        weightKg: parsedWeight,
        heightCm: parsedHeight,
        measurementDate: recordDate,
        muacCm: parseFloat(recordMuac) || undefined,
        notes: recordNotes,
        actor: staffUser?.id || 'AWW-409',
      },
      { actorId: staffUser?.id, role }
    );

    if (!result.success) {
      showToast('Measurement Not Recorded', result.error || 'The measurement was rejected and no changes were saved.', 'error');
      return;
    }

    // Add timeline entry
    setIsRecordPanelOpen(false);
    showToast(
      'Measurement Recorded',
      `Logged ${parsedWeight} kg for ${caseItem?.id || targetId}. Persisted to shared store.`,
      'success'
    );
  };

  // SVG Growth Trajectory Path Calculations
  // Months: 10 to 15 (X: 50 to 550)
  // Weights: 6 to 14 kg (Y: 220 to 20)
  const chartWidth = 580;
  const chartHeight = 240;
  const getX = (m: number) => 50 + ((m - 9) / 6) * 480;
  const getY = (w: number) => 220 - ((w - 6) / 8) * 190;

  if (loadedProfileScopeKey !== profileScopeKey) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6" role="status">
        <p className="text-sm text-slate-600">Checking beneficiary access…</p>
      </div>
    );
  }

  if (!beneficiaryExists || !beneficiaryIsPermitted) {
    const isNotFound = !beneficiaryExists;
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[#172B4D]">
            {isNotFound ? 'Beneficiary not found' : 'Access denied'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {isNotFound
              ? 'No beneficiary record exists for this ID.'
              : 'This beneficiary is not included in your currently permitted beneficiary list.'}
          </p>
          <Link to="/beneficiaries" className="mt-5 inline-flex rounded-full bg-[#172B4D] px-4 py-2 text-sm font-medium text-white">
            Return to beneficiaries
          </Link>
        </div>
      </div>
    );
  }

  const summaryMeasurements = mockStore
    .getMeasurements(targetId)
    .filter((measurement) => measurement.beneficiaryId === targetId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const summaryCases = mockStore.getCases().filter((record) => record.id === targetId);
  const summaryReferrals = mockStore
    .getReferrals()
    .filter((referral) => referral.beneficiaryId === targetId);
  const resolvedCases = summaryCases.filter((record) => record.status === 'Resolved');
  const openCases = summaryCases.filter((record) => record.status !== 'Resolved');
  const completedReferrals = summaryReferrals.filter((referral) => referral.status === 'Completed');
  const openReferrals = summaryReferrals.filter((referral) => referral.status !== 'Completed');
  const recordedFollowUps = summaryReferrals.flatMap((referral) =>
    (referral.followUpAttempts || []).map((attempt) => ({ referral, attempt }))
  );
  const screeningFlags = [
    ...summaryCases.map((record) => {
      const matchingMeasurement = summaryMeasurements.find((measurement) => measurement.date === record.flaggedDate);
      const recordedFlags = matchingMeasurement
        ? [...matchingMeasurement.qualityFlags, ...matchingMeasurement.clinicalFlags]
        : [];
      return {
        id: record.actionId,
        title: `${record.ruleCode} · ${record.ruleName}`,
        status: record.isVerified ? 'Verification recorded' : `Awaiting human verification · ${record.status}`,
        statusColor: record.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
        detail: `${record.triggerDetail}${recordedFlags.length ? ` Recorded measurement flags: ${recordedFlags.join('; ')}.` : ''}`,
        verification: record.isVerified
          ? record.verifiedNotes?.trim() || 'The case record marks this verification complete.'
          : 'No completed verification is recorded for this case.',
      };
    }),
    ...summaryMeasurements
      .filter((measurement) => measurement.qualityFlags.length > 0 || measurement.clinicalFlags.length > 0)
      .filter((measurement) => !summaryCases.some((record) => record.flaggedDate === measurement.date))
      .map((measurement) => ({
        id: measurement.id,
        title: 'Measurement screening flag',
        status: measurement.isVerified ? 'Verified measurement' : 'Unverified measurement',
        statusColor: measurement.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
        detail: `Recorded ${measurement.date}: ${[...measurement.qualityFlags, ...measurement.clinicalFlags].join('; ')}`,
        verification: measurement.isVerified ? 'The measurement record is marked verified.' : 'The measurement record is not verified.',
      })),
  ];
  const timelineEvents = getTimelineEvents(targetId);
  const hasStoredVerifiedWeight = Boolean(
    caseItem?.isVerified && typeof caseItem.verifiedWeight === 'number' && Number.isFinite(caseItem.verifiedWeight)
  );
  const verificationSummary = !caseItem
    ? 'No case verification record is available.'
    : hasStoredVerifiedWeight
      ? `Stored case verification: ${caseItem.verifiedWeight!.toFixed(2)} kg.${caseItem.verifiedNotes?.trim() ? ` Recorded notes: ${caseItem.verifiedNotes.trim()}` : ''}`
      : typeof caseItem.flaggedWeight === 'number' && Number.isFinite(caseItem.flaggedWeight)
        ? `The ${caseItem.flaggedWeight.toFixed(2)} kg flagged reading is unverified; the result is awaiting human verification.${caseItem.verifiedNotes?.trim() ? ` Recorded notes: ${caseItem.verifiedNotes.trim()}` : ''}`
        : `Case status: ${caseItem.status}. No verified replacement weight is recorded.${caseItem.verifiedNotes?.trim() ? ` Recorded notes: ${caseItem.verifiedNotes.trim()}` : ''}`;
  const verifiedPoints = summaryMeasurements
    .filter((measurement) => measurement.isVerified && Number.isFinite(measurement.weightKg))
    .map((measurement) => ({ m: measurement.ageMonths, w: measurement.weightKg }));
  if (hasStoredVerifiedWeight && caseItem) {
    verifiedPoints.push({ m: caseItem.ageMonths, w: caseItem.verifiedWeight! });
  }
  verifiedPoints.sort((a, b) => a.m - b.m);
  const trajectoryPath = verifiedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(point.m)} ${getY(point.w)}`)
    .join(' ');
  const flaggedPoint = caseItem && typeof caseItem.flaggedWeight === 'number' && Number.isFinite(caseItem.flaggedWeight)
    ? { m: caseItem.ageMonths, w: caseItem.flaggedWeight }
    : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Screen Header & Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider mb-1">
            <Link to="/queue" className="hover:text-[#1F8A83] flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Action Queue</span>
            </Link>
            <span>&gt;</span>
            <DataBadge variant="beneficiary" className="font-mono">{caseItem?.id || targetId}</DataBadge>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0E1B2B]">
            Child Profile & Longitudinal Timeline
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            {caseItem?.id || targetId} • Action {caseItem?.actionId || 'ACT-2041'} • {caseItem?.centreCode || 'AWC-702'} (demo)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/queue"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm"
          >
            Action Queue
          </Link>
          <button
            type="button"
            onClick={() => setIsRecordPanelOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0E1B2B] hover:bg-black rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83] active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Measurement</span>
          </button>
        </div>
      </motion.div>

      {/* Master Beneficiary Card (Consistent with Action Queue Case 1) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#CFEFD8] to-[#D6E6F7] text-[#0E1B2B] flex items-center justify-center font-bold text-base font-mono shadow-inner border border-white">
              {targetId.replace('BEN-', '')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-medium tracking-tight text-[#0E1B2B] font-mono flex flex-wrap items-center gap-2">
                  <DataBadge variant="beneficiary">{caseItem?.id || targetId}</DataBadge>
                  <span className="text-sm font-sans text-slate-500">({caseItem?.ageMonths || 14}m)</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Normal Nutrition (Green)
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{caseItem?.ageMonths || 14} Months • {caseItem?.gender || 'Male'}</span>
                <span>•</span>
                <span>Caregiver Kinship: {caseItem?.caregiverKinship || 'Mother'}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">Centre: <DataBadge variant="centre" className="font-mono">{caseItem?.centreCode || 'AWC-702'}</DataBadge></span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                <span className="flex items-center gap-1 font-mono">
                  <MapPin className="w-3 h-3" /> <DataBadge variant="centre">{caseItem?.centreCode || 'AWC-702'}</DataBadge>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <ShieldCheck className="w-3 h-3" /> Synthetic Record
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">Assigned: <DataBadge variant="worker" className="font-mono">{caseItem?.assignedAww || 'AWW-409'}</DataBadge></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center min-w-[100px]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Verified Weight</span>
              <span className="text-base font-semibold text-slate-800 block mt-0.5">
                {caseItem?.isVerified && typeof caseItem.verifiedWeight === 'number' && Number.isFinite(caseItem.verifiedWeight)
                  ? `${caseItem.verifiedWeight.toFixed(2)} kg`
                  : 'Not verified'}
              </span>
              <span className={`text-[10px] font-medium ${caseItem?.isVerified ? 'text-emerald-600' : 'text-amber-700'}`}>
                {caseItem?.isVerified ? 'Verification recorded' : 'Awaiting verification'}
              </span>
            </div>
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center min-w-[100px]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Height</span>
              <span className="text-base font-semibold text-slate-800 block mt-0.5">
                {caseItem?.isVerified && typeof caseItem.verifiedHeight === 'number' && Number.isFinite(caseItem.verifiedHeight)
                  ? `${caseItem.verifiedHeight.toFixed(1)} cm`
                  : 'Not verified'}
              </span>
              <span className={`text-[10px] font-medium ${caseItem?.isVerified ? 'text-emerald-600' : 'text-amber-700'}`}>
                {caseItem?.isVerified ? 'Verification recorded' : 'Awaiting verification'}
              </span>
            </div>
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center min-w-[100px]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">MUAC</span>
              <span className="text-base font-semibold text-slate-800 block mt-0.5">14.2 cm</span>
              <span className="text-[10px] text-emerald-600 font-medium">Green / Normal</span>
            </div>
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center min-w-[100px]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Flag Status</span>
              <span className={`text-base font-semibold block mt-0.5 ${caseItem?.status === 'Resolved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {caseItem?.status || 'No case record'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {caseItem?.verifiedNotes || (caseItem?.isVerified ? 'Verification recorded' : 'No verification recorded')}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stored-record summary for the route-selected beneficiary */}
      <section
        aria-labelledby="beneficiary-history-summary-title"
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h2 id="beneficiary-history-summary-title" className="text-base font-semibold text-[#0E1B2B]">
              Beneficiary History Summary
            </h2>
            <p className="text-xs text-slate-500 mt-1">Recorded summary for {targetId}</p>
          </div>
          <span className="self-start rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-800">
            Demo Preview — not live AI
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <h3 className="text-xs font-semibold text-[#172B4D] mb-2">Recorded measurements</h3>
            {summaryMeasurements.length === 0 ? (
              <p className="text-xs text-slate-500">No measurement records are available for this beneficiary.</p>
            ) : (
              <ul className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {summaryMeasurements.map((measurement) => {
                  const flags = [
                    ...(measurement.qualityFlags || []),
                    ...(measurement.clinicalFlags || []),
                  ];
                  return (
                    <li key={measurement.id} className="rounded-xl border border-slate-200/70 bg-white p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{measurement.date}</span>
                        <span className={measurement.isVerified ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                          {measurement.isVerified ? 'Verified' : 'Not verified'}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">
                        {measurement.weightKg} kg · {measurement.heightCm} cm
                        {measurement.muacCm != null ? ` · MUAC ${measurement.muacCm} cm` : ''}
                      </p>
                      {flags.length > 0 && (
                        <p className="mt-1 text-amber-800">Recorded flags: {flags.join('; ')}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-[#172B4D] mb-2">Historical records</h3>
              {resolvedCases.length === 0 && completedReferrals.length === 0 && recordedFollowUps.length === 0 ? (
                <p className="text-xs text-slate-500">No completed or resolved actions or recorded referral follow-ups are available.</p>
              ) : (
                <ul className="space-y-2">
                  {resolvedCases.map((record) => (
                    <li key={record.actionId} className="rounded-xl border border-slate-200/70 bg-white p-3 text-xs text-slate-700">
                      <span className="font-semibold">{record.actionId}</span> · {record.ruleName} · {record.status}
                    </li>
                  ))}
                  {completedReferrals.map((referral) => (
                    <li key={referral.id} className="rounded-xl border border-slate-200/70 bg-white p-3 text-xs text-slate-700 space-y-1">
                      <p><span className="font-semibold">{referral.id}</span> · Stored workflow status: {referral.status} for {referral.destination} ({referral.referralDate}){referral.status === 'Completed' ? ' · clinical resolution is not independently confirmed' : ''}</p>
                      {referral.finalOutcome?.trim() ? <p>Demo-recorded outcome (requires confirmation): {referral.finalOutcome}</p> : <p>No referral outcome is recorded.</p>}
                      {referral.outcomeDate && <p>Demo-recorded outcome date (requires confirmation): {referral.outcomeDate}</p>}
                      {referral.nextSteps?.trim() && <p>Demo-recorded next steps (requires confirmation): {referral.nextSteps}</p>}
                    </li>
                  ))}
                  {recordedFollowUps.map(({ referral, attempt }) => (
                    <li key={`${referral.id}-${attempt.id}`} className="rounded-xl border border-slate-200/70 bg-white p-3 text-xs text-slate-700 space-y-1">
                      <p><span className="font-semibold">{referral.id}</span> · Demo follow-up record (requires confirmation): {attempt.method} ({attempt.date})</p>
                      {attempt.findings?.trim() && <p>Recorded findings: {attempt.findings}</p>}
                      {attempt.outcomeNote?.trim() && <p>Recorded outcome note: {attempt.outcomeNote}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#172B4D] mb-2">Current open actions</h3>
              {openCases.length === 0 && openReferrals.length === 0 ? (
                <p className="text-xs text-slate-500">No currently open cases or referrals are recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {openCases.map((record) => (
                    <li key={record.actionId} className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-slate-700 space-y-1">
                      <p><span className="font-semibold">{record.actionId}</span> · {record.ruleName} · {record.status}</p>
                      <p>Priority: {record.priority} · Due: {record.dueDate}</p>
                      {record.assignedActor && <p>Assigned to: {record.assignedActor}</p>}
                    </li>
                  ))}
                  {openReferrals.map((referral) => (
                    <li key={referral.id} className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-slate-700 space-y-1">
                      <p><span className="font-semibold">{referral.id}</span> · {referral.destination} · {referral.status}</p>
                      <p>{referral.reason}</p>
                      <p>Priority: {referral.priority} · Due: {referral.dueDate} · Owner: {referral.owner}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 border-t border-slate-200/70 pt-3">
          Summarizes recorded demo data; not a diagnosis or clinical advice.
        </p>
      </section>

      {/* Tabs with Sliding Pill Indicator */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        {[
          { id: 'growth', label: 'WHO Growth Trajectory' },
          { id: 'history', label: '5-Row Measurement History' },
          { id: 'flags', label: `Screening Flags (${screeningFlags.length})` },
          { id: 'timeline', label: 'Chronological Timeline' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative px-4 py-2 text-xs font-semibold rounded-full transition-colors z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] ${
                isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 bg-white/70'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="childProfileTabPill"
                  className="absolute inset-0 bg-[#0F172A] rounded-full -z-10 shadow-sm"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Growth Trajectory Curve */}
      {activeTab === 'growth' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#0E1B2B] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#1F8A83]" />
                Weight-for-Age Trajectory Curve ({targetId} • 10–14 Months)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Solid line shows stored verified measurements; the red point shows the stored flagged reading. {verificationSummary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-200/80 border border-emerald-400" />
                Normal Band
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-200/80 border border-amber-400" />
                MAM Band
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-200/80 border border-rose-400" />
                SAM Band
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-[#0E1B2B]">
                <span className="w-3 h-1 bg-[#0E1B2B] rounded-full" />
                Beneficiary Trajectory
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="min-w-[600px] p-2">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
                {/* Horizontal Grid */}
                {[6, 8, 10, 12, 14].map((w) => (
                  <g key={w}>
                    <line x1={50} y1={getY(w)} x2={530} y2={getY(w)} stroke="#E2E8F0" strokeDasharray="3 3" />
                    <text x={42} y={getY(w) + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono">
                      {w} kg
                    </text>
                  </g>
                ))}

                {/* Vertical Months */}
                {[10, 11, 12, 13, 14, 15].map((m) => (
                  <g key={m}>
                    <line x1={getX(m)} y1={20} x2={getX(m)} y2={220} stroke="#E2E8F0" strokeDasharray="3 3" />
                    <text x={getX(m)} y={236} textAnchor="middle" className="text-[10px] fill-slate-500 font-mono font-medium">
                      {m}m
                    </text>
                  </g>
                ))}

                {/* Trajectory line animated */}
                <motion.path
                  d={trajectoryPath}
                  fill="none"
                  stroke="#0E1B2B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.1, ease: 'easeInOut' }}
                />

                {/* Points */}
                {verifiedPoints.map((p, i) => (
                  <g key={i}>
                    <circle cx={getX(p.m)} cy={getY(p.w)} r={4.5} fill="#0E1B2B" stroke="#FFFFFF" strokeWidth="2" />
                    <text x={getX(p.m)} y={getY(p.w) - 10} textAnchor="middle" className="text-[9px] font-mono fill-slate-700 font-bold">
                      {p.w} kg
                    </text>
                  </g>
                ))}

                {flaggedPoint && (
                  <g>
                    <circle cx={getX(flaggedPoint.m)} cy={getY(flaggedPoint.w)} r={4} fill="#EF4444" stroke="#FECACA" strokeWidth="3" />
                    <text x={getX(flaggedPoint.m) + 10} y={getY(flaggedPoint.w) + 3} className="text-[9px] font-mono fill-rose-600 font-bold">
                      {flaggedPoint.w.toFixed(1)} kg (Unverified flagged reading)
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Clinical Referral Card */}
          <div className="bg-[#F5F9FC] border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-[#1F8A83] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-[#0E1B2B]">Referral Evaluation Status: </span>
              {summaryReferrals.length > 0
                ? <>Stored referral workflow status: {summaryReferrals.map((referral) => `${referral.destination}: ${referral.status}${referral.status === 'Completed' ? ' (clinical resolution not independently confirmed)' : ''}`).join('; ')}. </>
                : 'No referral record is stored for this beneficiary. '}
              {verificationSummary}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 2: 5-Row Measurement History */}
      {activeTab === 'history' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-[#0E1B2B]">
                Longitudinal Anthropometric Register (5 Visits)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official physical records and verification stamps for {targetId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsRecordPanelOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Record Measurement</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Date & Age</th>
                  <th className="py-3 px-4">Weight (kg)</th>
                  <th className="py-3 px-4">Height (cm)</th>
                  <th className="py-3 px-4">MUAC (cm)</th>
                  <th className="py-3 px-4">WAZ (Z-Score)</th>
                  <th className="py-3 px-4">Logged By</th>
                  <th className="py-3 px-4">Audit Note</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-sm text-slate-500">
                      No measurement records are available for this beneficiary.
                    </td>
                  </tr>
                ) : historyRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-[#0F172A]">{r.date}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.ageMonths} months old</div>
                    </td>
                    <td className="py-3.5 px-4"><DataBadge variant="previous" className="font-mono tabular-nums">{r.weight.toFixed(2)} kg</DataBadge></td>
                    <td className="py-3.5 px-4"><DataBadge variant="previous" className="font-mono tabular-nums">{r.height.toFixed(1)} cm</DataBadge></td>
                    <td className="py-3.5 px-4"><DataBadge variant="previous" className="font-mono tabular-nums">{r.muac == null ? 'Not recorded' : `${r.muac.toFixed(1)} cm`}</DataBadge></td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 tabular-nums">
                        {r.waz}
                      </span>
                    </td>
                    <td className="py-3.5 px-4"><DataBadge variant="worker" className="font-mono">{r.recordedBy}</DataBadge></td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-500 text-[11px]">
                      {r.flag ? <span className="text-amber-800 font-medium">{r.flag}</span> : 'No recorded flag'}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${r.verified ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
                        {r.verified ? <><CheckCircle2 className="w-3 h-3" />Verified</> : 'Not verified'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Tab 3: 3 Screening Flags Audited */}
      {activeTab === 'flags' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {screeningFlags.length === 0 ? (
            <div className="bg-white/90 rounded-[28px] border border-slate-200/80 p-6 shadow-sm text-sm text-slate-500">
              No screening flags are recorded for this beneficiary.
            </div>
          ) : screeningFlags.map((f) => (
            <div
              key={f.id}
              className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[#2457F5] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {f.id}
                  </span>
                  <h4 className="font-semibold text-sm text-[#0F172A]">{f.title}</h4>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${f.statusColor}`}>
                  {f.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{f.detail}</p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed">
                <strong>Verification record:</strong> {f.verification}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Tab 4: Chronological Timeline */}
      {activeTab === 'timeline' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4"
        >
          <h3 className="font-semibold text-sm text-[#0F172A] mb-4">
            Longitudinal Lifecycle Events
          </h3>

          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timelineEvents.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No timeline events are recorded for this beneficiary.</p>
            ) : timelineEvents.map((evt) => (
              <div key={evt.id} className="relative group">
                <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-white border-2 border-[#2457F5] shadow-sm" />
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#0F172A]">{evt.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${evt.badgeColor}`}>
                      {evt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{evt.description}</p>
                  <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                    <DataBadge variant="date" className="font-mono">{evt.date}</DataBadge>
                    <span>By: <DataBadge variant="worker" className="font-mono">{evt.actor}</DataBadge></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Record Measurement Panel (Slide-Over Drawer with Esc Close) */}
      <AnimatePresence>
        {isRecordPanelOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setIsRecordPanelOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              aria-hidden="true"
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200"
              >
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg text-[#0F172A]">
                      + Record Anthropometry
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      {targetId} ({caseItem?.ageMonths || 14}m)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRecordPanelOpen(false)}
                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleConfirmAndCreateAction} className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Measurement Date
                    </label>
                    <input
                      type="date"
                      value={recordDate}
                      onChange={(e) => setRecordDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={recordWeight}
                        onChange={(e) => setRecordWeight(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={recordHeight}
                        onChange={(e) => setRecordHeight(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      MUAC (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={recordMuac}
                      onChange={(e) => setRecordMuac(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A]"
                      required
                    />
                  </div>

                  {/* Real-time Screening Heuristic Check */}
                  {isHighVelocity && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Rule Alert: Weight Velocity Anomaly (+{weightVelocity.toFixed(2)} kg)</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Recorded delta exceeds the physiological monthly ceiling (+2.5 kg/month). Clicking "Confirm & Create Action" will dispatch an urgent verification task to the supervisor worklist.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Frontline Observation Notes
                    </label>
                    <textarea
                      rows={3}
                      value={recordNotes}
                      onChange={(e) => setRecordNotes(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#0F172A]"
                    />
                  </div>

                  {isReadOnlyDemo && (
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Public Read-Only Demo</span>: Recording re-measurements and generating official actions requires staff authentication.
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsRecordPanelOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-full"
                    >
                      {isReadOnlyDemo ? 'Close' : 'Cancel'}
                    </button>
                    {isReadOnlyDemo ? (
                      <Link
                        to="/signin"
                        className="px-5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full shadow-sm flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Staff Sign In to Record</span>
                      </Link>
                    ) : (
                      <button
                        type="submit"
                        className="px-5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full shadow-sm flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm & Create Action</span>
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
