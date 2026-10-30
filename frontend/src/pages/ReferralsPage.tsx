import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  User,
  ArrowRight,
  Phone,
  Home,
  Check,
  X,
  FileText,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { mockStore, ReferralRecord, ReferralFollowUp, BeneficiaryRecord } from '../store/mockStore.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { DataBadge } from '../components/common/DataBadge';
import { canPerformAction } from '../utils/permissions.ts';

export const ReferralsPage: React.FC = () => {
  const { showToast } = useToast();
  const { staffUser, role, requireStaffAction } = useAuth();
  const canCreateReferral = canPerformAction(role, 'create_referral');
  const canLogFollowUp = canPerformAction(role, 'log_follow_up');
  const canResolveReferral = canPerformAction(role, 'resolve_referral');

  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<ReferralRecord | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ReferralRecord | null>(null);

  // New Referral Form State
  const [newBenId, setNewBenId] = useState('');
  const [newReason, setNewReason] = useState('Severe Acute Malnutrition (SAM) • WAZ < -3 SD');
  const [newDestination, setNewDestination] = useState<ReferralRecord['destination']>('Nutrition Rehabilitation Centre (NRC)');
  const [newDueDate, setNewDueDate] = useState('2026-10-31');
  const [newPriority, setNewPriority] = useState<'Urgent' | 'High' | 'Routine'>('Urgent');

  // Follow-up Form State
  const [fuMethod, setFuMethod] = useState<'Home Visit' | 'Phone Call' | 'AWC Consultation'>('Home Visit');
  const [fuFindings, setFuFindings] = useState('');
  const [fuActor, setFuActor] = useState(staffUser?.id || 'AWW-409');

  // Resolve Outcome Form State
  const [resolveOutcome, setResolveOutcome] = useState('');
  const [resolveNextSteps, setResolveNextSteps] = useState('');
  const [outcomeConfirmed, setOutcomeConfirmed] = useState(false);

  useEffect(() => {
    const fetch = () => {
      setReferrals(mockStore.getReferrals({ role, centreCode: staffUser?.centreCode, actorId: staffUser?.id }));
      const bens = mockStore.getBeneficiaries({ role, centreCode: staffUser?.centreCode });
      setBeneficiaries(bens);
      if (bens.length > 0 && !newBenId) {
        setNewBenId(bens[0].id);
      }
    };
    fetch();

    const unsubscribe = mockStore.subscribe(fetch);
    return unsubscribe;
  }, [role, staffUser]);

  // Filter referrals
  const filteredReferrals = referrals.filter((item) => {
    if (facilityFilter !== 'all' && item.destination !== facilityFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.beneficiaryId.toLowerCase().includes(q) ||
        item.destination.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleCreateReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireStaffAction('dispatch clinical referrals')) {
      return;
    }
    if (!canCreateReferral) {
      showToast('Permission Restricted', `Role ${role} cannot initiate clinical referrals.`, 'error');
      return;
    }
    if (!newBenId) return;

    const actorId = staffUser?.id || 'AWW-409';
    const res = mockStore.createReferral(
      {
        beneficiaryId: newBenId,
        reason: newReason,
        destination: newDestination,
        dueDate: newDueDate,
        priority: newPriority,
        owner: actorId,
      },
      { actorId, role, centreCode: staffUser?.centreCode }
    );

    if (res.success) {
      showToast(
        'Referral Dispatched',
        `Clinical referral ${res.referralId} issued for ${newDestination}.`,
        'success'
      );
      setIsNewModalOpen(false);
    } else {
      showToast('Referral Error', res.error || 'Failed to dispatch referral.', 'error');
    }
  };

  const handleSaveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpTarget || !fuFindings.trim()) return;
    if (!requireStaffAction('log follow-up outreach')) {
      return;
    }
    if (!canLogFollowUp) {
      showToast('Permission Restricted', `Role ${role || 'unknown'} cannot log referral follow-up.`, 'error');
      return;
    }

    const actorId = fuActor || staffUser?.id || 'AWW-409';
    const saved = mockStore.addFollowUpAttempt(
      followUpTarget.id,
      {
        method: fuMethod,
        findings: fuFindings,
        actor: actorId,
      },
      { actorId, role, centreCode: staffUser?.centreCode }
    );
    if (!saved) {
      showToast('Follow-up Not Saved', 'The follow-up was rejected; no referral or audit changes were saved.', 'error');
      return;
    }

    showToast(
      'Follow-up Attempt Logged',
      `Recorded ${fuMethod} visit for ${followUpTarget.beneficiaryId}. Status updated.`,
      'success'
    );
    setFollowUpTarget(null);
    setFuFindings('');
  };

  const handleConfirmResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveTarget) return;
    if (!requireStaffAction('record clinical resolution and close referrals')) {
      return;
    }
    if (!canResolveReferral) {
      showToast('Permission Restricted', `Role ${role} cannot close referrals. Restricted to Supervisor and CDPO.`, 'error');
      return;
    }
    if (!resolveOutcome.trim() || resolveNextSteps.trim().length < 10 || !outcomeConfirmed) {
      showToast('Resolution Blocked', 'Select an outcome, enter meaningful next steps, and confirm the outcome is supported by a verified record.', 'error');
      return;
    }

    const actorId = staffUser?.id || 'Sector Supervisor (LS-01)';
    const res = mockStore.resolveReferral(
      resolveTarget.id,
      resolveOutcome,
      resolveNextSteps,
      { actorId, role, outcomeConfirmed }
    );

    if (res.success) {
      showToast(
        'Referral Case Successfully Resolved',
        `Workflow status set to Completed for ${resolveTarget.beneficiaryId}; outcome confirmation was recorded.`,
        'success'
      );
      setResolveTarget(null);
    } else {
      showToast('Resolution Blocked', res.error || 'Mandatory outcome must be recorded.', 'error');
    }
  };

  const openResolveForm = (item: ReferralRecord) => {
    setResolveOutcome('');
    setResolveNextSteps('');
    setOutcomeConfirmed(false);
    setResolveTarget(item);
  };

  const openCasesCount = referrals.filter((r) => r.status !== 'Completed').length;
  const completedCount = referrals.filter((r) => r.status === 'Completed').length;
  const inProgressCount = referrals.filter((r) => r.status === 'Follow-up In Progress').length;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider mb-1.5">
            <Link to="/" className="hover:text-[#2457F5] transition-colors">Home</Link>
            <span>&gt;</span>
            <Link to="/dashboard" className="hover:text-[#2457F5] transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-semibold">Referrals & Follow-up</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Clinical Referrals & Follow-up Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
            Monitor Malnutrition Rehabilitation Centres (NRC) admissions, Primary Health Centre consultations, and ensure caregiver follow-up milestones are fulfilled.
          </p>
        </div>

        {canCreateReferral && <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Issue Clinical Referral</span>
        </button>}
      </motion.div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Active Referrals',
            value: referrals.length,
            subtext: `${openCasesCount} pending/active • ${completedCount} closed`,
            icon: Heart,
            color: 'bg-rose-50 text-rose-700 border-rose-200/60',
          },
          {
            label: 'In Field Follow-up',
            value: inProgressCount,
            subtext: 'Home visit or phone outreach underway',
            icon: Clock,
            color: 'bg-blue-50 text-[#2457F5] border-blue-200/60',
          },
          {
            label: 'Completed Workflow',
            value: completedCount,
            subtext: 'Stored referral workflow status',
            icon: CheckCircle2,
            color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
          },
          {
            label: 'NRC Facility Escalations',
            value: referrals.filter((r) => r.destination === 'Nutrition Rehabilitation Centre (NRC)').length,
            subtext: 'Severe Acute Malnutrition (SAM) care',
            icon: Building2,
            color: 'bg-purple-50 text-purple-700 border-purple-200/60',
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white/90 backdrop-blur-md rounded-[24px] border border-slate-200/80 p-5 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${kpi.color}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-light tracking-tight text-[#0F172A] tabular-nums">
              {kpi.value}
            </div>
            <p className="text-[11px] text-slate-400 font-normal">{kpi.subtext}</p>
          </div>
        ))}
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by child name, ID, facility, or clinical reason..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={facilityFilter}
            onChange={(e) => setFacilityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">All Healthcare Facilities</option>
            <option value="Nutrition Rehabilitation Centre (NRC)">Nutrition Rehab Centre (NRC)</option>
            <option value="Primary Health Centre (PHC)">Primary Health Centre (PHC)</option>
            <option value="Community Health Centre (CHC)">Community Health Centre (CHC)</option>
            <option value="District Hospital">District Hospital</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">All Referral Statuses</option>
            <option value="Pending">Pending Contact</option>
            <option value="Follow-up In Progress">Follow-up In Progress</option>
            <option value="Completed">Completed Workflow</option>
          </select>
        </div>
      </div>

      {/* 4. Referrals Card Roster */}
      <div className="space-y-4">
        {filteredReferrals.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-12 text-center space-y-3 shadow-sm">
            <Heart className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-700">No clinical referrals found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No referral records match your query or filters. Click &quot;Issue Clinical Referral&quot; to register an escalation.
            </p>
          </div>
        ) : (
          filteredReferrals.map((item) => (
            <article
              key={item.id}
              className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0 border border-rose-100">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/beneficiaries/${item.beneficiaryId}`}
                        className="font-semibold text-sm text-slate-900 hover:text-[#2457F5] transition-colors font-mono"
                      >
                        <DataBadge variant="beneficiary" className="font-mono">{item.beneficiaryId}</DataBadge>
                      </Link>
                      <span className="text-xs text-slate-500">• {item.ageDisplay}</span>
                    </div>
                    <div className="text-xs text-rose-700 font-medium mt-0.5">
                      {item.reason}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      item.status === 'Completed' && item.outcomeConfirmed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : item.status === 'Completed'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : item.status === 'Follow-up In Progress'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {item.status === 'Completed' ? `Completed · ${item.outcomeConfirmed ? 'outcome confirmed' : 'workflow status'}` : item.status}
                  </span>
                  <DataBadge variant="action" className="font-mono">{item.id}</DataBadge>
                </div>
              </div>

              {/* Referral Metadata Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Destination Facility</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#2457F5]" />
                    {item.destination}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Referral Date</span>
                  <DataBadge variant="date" className="font-mono">{item.referralDate}</DataBadge>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Case Owner</span>
                  <DataBadge variant="worker" className="font-mono">{item.owner}</DataBadge>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Target Due Date</span>
                  <DataBadge variant="date" className="font-mono">{item.dueDate}</DataBadge>
                </div>
              </div>

              {/* Follow-up History Log */}
              {item.followUpAttempts.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Documented Follow-up Attempts ({item.followUpAttempts.length})
                  </span>
                  <div className="space-y-1.5">
                    {item.followUpAttempts.map((fu, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {fu.method}
                          </span>
                          <span className="text-slate-800 font-medium">{fu.findings}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 shrink-0">
                          <DataBadge variant="worker" className="font-mono">{fu.actor}</DataBadge>
                          <DataBadge variant="date" className="font-mono">{fu.date}</DataBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolved Outcome Banner */}
              {item.status === 'Completed' && item.finalOutcome && (
                <div className={`${item.outcomeConfirmed ? 'bg-emerald-50/80 border-emerald-200/80' : 'bg-amber-50/80 border-amber-200/80'} border rounded-2xl p-4 text-xs space-y-1`}>
                  <div className={`flex items-center gap-1.5 font-semibold ${item.outcomeConfirmed ? 'text-emerald-900' : 'text-amber-900'}`}>
                    <CheckCircle2 className={`w-4 h-4 ${item.outcomeConfirmed ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <span>{item.outcomeConfirmed ? 'Confirmed Referral Outcome' : 'Demo Outcome · confirmation required'}{item.outcomeDate ? ` (${item.outcomeDate})` : ''}</span>
                  </div>
                  <p className={`${item.outcomeConfirmed ? 'text-emerald-800' : 'text-amber-800'} leading-relaxed font-medium`}>{item.finalOutcome}</p>
                  {item.nextSteps && (
                    <p className={`${item.outcomeConfirmed ? 'text-emerald-700' : 'text-amber-700'} text-[11px]`}>
                      <strong>Next Steps:</strong> {item.nextSteps}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="text-[11px] text-slate-400">
                  {item.status === 'Completed'
                    ? item.outcomeConfirmed
                      ? 'Workflow status Completed; outcome confirmation is recorded.'
                      : 'Stored workflow status Completed; demo outcome requires confirmation.'
                    : 'Mandatory outcome note required prior to case closure.'}
                </div>

                <div className="flex items-center gap-2">
                  {canLogFollowUp && <button
                    type="button"
                    onClick={() => setFollowUpTarget(item)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <Home className="w-3.5 h-3.5 text-[#2457F5]" />
                    <span>+ Log Follow-up Visit</span>
                  </button>}

                  {canResolveReferral && item.status !== 'Completed' && (
                    <button
                      type="button"
                      onClick={() => openResolveForm(item)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Record Outcome & Resolve</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* 5. MODAL: Issue New Referral */}
      <AnimatePresence>
        {isNewModalOpen && canCreateReferral && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Heart className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-[#0F172A]">Issue Clinical Referral</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateReferral} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Beneficiary Child</label>
                  <select
                    value={newBenId}
                    onChange={(e) => setNewBenId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 cursor-pointer"
                  >
                    {beneficiaries.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id} • Caregiver: {b.caregiverKinship} • Centre: {b.centreCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Referral Indication / Clinical Reason</label>
                  <textarea
                    rows={2}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="e.g. Severe Acute Malnutrition (SAM), Bilateral Edema, or persistent growth faltering"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Destination Facility</label>
                    <select
                      value={newDestination}
                      onChange={(e) => setNewDestination(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 cursor-pointer"
                    >
                      <option value="Nutrition Rehabilitation Centre (NRC)">Nutrition Rehab Centre (NRC)</option>
                      <option value="Primary Health Centre (PHC)">Primary Health Centre (PHC)</option>
                      <option value="Community Health Centre (CHC)">Community Health Centre (CHC)</option>
                      <option value="District Hospital">District Hospital</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Target Due Date</label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold shadow-sm"
                  >
                    Dispatch Referral
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL: Log Follow-up Attempt */}
      <AnimatePresence>
        {followUpTarget && canLogFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[#2457F5] flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#0F172A]">Log Follow-up Outreach</h3>
                    <p className="text-[11px] text-slate-400">
                      Beneficiary: {followUpTarget.beneficiaryId} ({followUpTarget.id})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFollowUpTarget(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveFollowUp} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Contact Method</label>
                    <select
                      value={fuMethod}
                      onChange={(e) => setFuMethod(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 cursor-pointer"
                    >
                      <option value="Home Visit">In-Person Home Visit</option>
                      <option value="AWC Consultation">AWC Consultation Desk</option>
                      <option value="Phone Call">Phone Outreach (IVR)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Staff Actor</label>
                    <input
                      type="text"
                      value={fuActor}
                      onChange={(e) => setFuActor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Visit Observations & Caregiver Response</label>
                  <textarea
                    rows={3}
                    value={fuFindings}
                    onChange={(e) => setFuFindings(e.target.value)}
                    placeholder="Document caregiver transport readiness, health condition, and guidance provided..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFollowUpTarget(null)}
                    className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold shadow-sm"
                  >
                    Save Follow-up Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL: Record Case Outcome & Resolve */}
      <AnimatePresence>
        {resolveTarget && canResolveReferral && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#0F172A]">Record Case Outcome & Resolve</h3>
                    <p className="text-[11px] text-slate-400">
                      Mandatory medical outcome for {resolveTarget.beneficiaryId} ({resolveTarget.id})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResolveTarget(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmResolve} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Clinical Exit / Discharge Outcome</label>
                  <select
                    value={resolveOutcome}
                    onChange={(e) => setResolveOutcome(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 cursor-pointer"
                  >
                    <option value="" disabled>Select an outcome supported by the clinical record</option>
                    <option value="Admitted to NRC & Stabilized">Admitted to NRC & Stabilized</option>
                    <option value="Treated at PHC Outpatient & Recovered">Treated at PHC Outpatient & Recovered</option>
                    <option value="Double-Ration Supplementary THR Assigned">Double-Ration Supplementary THR Assigned</option>
                    <option value="Graduated with Normal Weight-for-Age (WAZ)">Graduated with Normal Weight-for-Age (WAZ)</option>
                    <option value="Caregiver Refused Facility Admission (Counseling Documented)">
                      Caregiver Refused Admission (Counseling Documented)
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Next Steps & Ongoing Surveillance Plan</label>
                  <textarea
                    rows={2}
                    value={resolveNextSteps}
                    onChange={(e) => setResolveNextSteps(e.target.value)}
                    placeholder="e.g. Bi-weekly Salter weighing at AWC #702; home nutrition visits..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                    required
                    minLength={10}
                  />
                </div>

                <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                  <input
                    type="checkbox"
                    checked={outcomeConfirmed}
                    onChange={(e) => setOutcomeConfirmed(e.target.checked)}
                    required
                    className="mt-0.5 rounded border-amber-300 text-[#2457F5] focus:ring-[#2457F5]"
                  />
                  <span>I confirm this selected outcome is supported by a verified clinical record. This confirmation will be saved with the referral.</span>
                </label>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveTarget(null)}
                    className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Confirm & Close Referral
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
