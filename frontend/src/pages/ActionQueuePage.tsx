import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ListTodo,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  Calendar,
  Check,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Info,
  Scale,
  Ruler,
  UserCheck,
  Lock,
  Eye,
} from 'lucide-react';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DataBadge } from '../components/common/DataBadge';
import { mockStore, BeneficiaryCase } from '../store/mockStore.ts';
import { canEscalateCase, ESCALATION_TIERS } from '../utils/casework.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canPerformAction, canRenderVerificationAction, ROLE_CONFIGS } from '../utils/permissions.ts';

const formatCaseReading = (weight?: number, height?: number, date?: string) => {
  const values = [
    typeof weight === 'number' && Number.isFinite(weight) ? `weight ${weight.toFixed(2)} kg` : null,
    typeof height === 'number' && Number.isFinite(height) ? `height ${height.toFixed(1)} cm` : null,
    typeof date === 'string' && date.trim() ? `date ${date}` : null,
  ].filter(Boolean);

  return values.length > 0 ? values.join(', ') : 'not recorded';
};

const buildCaseExplanation = (caseItem: BeneficiaryCase) => {
  const rule = [caseItem.ruleCode, caseItem.ruleName].filter((value) => typeof value === 'string' && value.trim()).join(' — ');
  const trigger = caseItem.triggerDetail?.trim() || caseItem.concernSummary?.trim();
  const ruleText = rule ? `This case was flagged by ${rule}.` : 'No triggering rule is recorded for this case.';
  const triggerText = trigger ? `Recorded trigger: ${trigger}` : 'No trigger detail or concern summary is recorded.';

  return `${ruleText} ${triggerText}. Available evidence — previous reading: ${formatCaseReading(caseItem.prevWeight, caseItem.prevHeight, caseItem.prevDate)}; flagged reading: ${formatCaseReading(caseItem.flaggedWeight, caseItem.flaggedHeight, caseItem.flaggedDate)}. Current status: ${caseItem.status || 'unavailable'}; priority: ${caseItem.priority || 'unavailable'}.`;
};

export const ActionQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isReadOnlyDemo, role, staffUser, requireStaffAction } = useAuth();

  const [cases, setCases] = useState<BeneficiaryCase[]>([]);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'urgent' | 'drift' | 'sam' | 'visit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'attention' | 'resolved'>('all');
  const [selectedCase, setSelectedCase] = useState<BeneficiaryCase | null>(null);

  // Multi-tier Escalation Modal
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [escalateTargetTier, setEscalateTargetTier] = useState<1 | 2 | 3 | 4>(2);
  const [escalateReason, setEscalateReason] = useState('Overdue frontline verification requiring supervisory spot-check.');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Verification drawer form state
  const [verifiedWeight, setVerifiedWeight] = useState('');
  const [verifiedHeight, setVerifiedHeight] = useState('');
  const [findingReason, setFindingReason] = useState<'typo' | 'genuine' | 'referral' | ''>('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [sopChecked, setSopChecked] = useState({
    calibratedScale: true,
    minimalClothing: true,
    checkedPreviousLog: true,
    edemaChecked: true,
  });

  useEffect(() => {
    const fetchCases = () => {
      setCases(mockStore.getCases({ role, centreCode: staffUser?.centreCode, actorId: staffUser?.id }));
    };
    fetchCases();
    const unsubscribe = mockStore.subscribe(fetchCases);
    return unsubscribe;
  }, [role, staffUser]);

  // Esc key listener for the case detail right-hand drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCase) {
        setSelectedCase(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCase]);

  // Filtering
  const filteredCases = cases.filter((c) => {
    if (activeFilterTab !== 'all' && c.category !== activeFilterTab) return false;
    if (priorityFilter === 'urgent' && c.priority !== 'Urgent') return false;
    if (priorityFilter === 'attention' && c.priority !== 'Needs Attention') return false;
    if (priorityFilter === 'resolved' && !c.isVerified) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        c.id.toLowerCase().includes(q) ||
        c.actionId.toLowerCase().includes(q) ||
        c.assignedAww.toLowerCase().includes(q) ||
        c.centreCode.toLowerCase().includes(q) ||
        c.ruleCode.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage) || 1;
  const paginatedCases = filteredCases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const selectedRuleGuidance = selectedCase
    ? mockStore.getRules().find((rule) => rule.id === selectedCase.ruleCode)?.actionGenerated.trim() || undefined
    : undefined;
  const canAcknowledge = canPerformAction(role, 'acknowledge_case');
  const canEscalate = canPerformAction(role, 'escalate');
  const canVerify = canRenderVerificationAction(role);

  const handleOpenDetail = (c: BeneficiaryCase) => {
    setSelectedCase(c);
    setVerifiedWeight('');
    setVerifiedHeight('');
    setSupervisorNotes('');
    setFindingReason('');
  };

  const handleCompleteVerification = () => {
    if (!selectedCase) return;
    if (!requireStaffAction('complete physical verifications and sign off case records')) {
      return;
    }
    if (!canVerify) {
      showToast('Permission Restricted', `Role ${role} cannot record physical re-measurements.`, 'error');
      return;
    }
    const actionId = selectedCase.actionId;
    const benId = selectedCase.id;
    const w = Number(verifiedWeight);
    const h = Number(verifiedHeight);
    if (!verifiedWeight.trim() || !Number.isFinite(w) || w <= 0 || !verifiedHeight.trim() || !Number.isFinite(h) || h <= 0) {
      showToast('Verification Not Saved', 'Enter valid, physically measured weight and height before completing verification.', 'error');
      return;
    }

    const saved = mockStore.verifyCase(actionId, w, h, supervisorNotes, {
      actorId: staffUser?.id || 'AWW-409',
      role,
    });
    if (!saved) {
      showToast('Verification Not Saved', 'The verification was rejected. The case remains unchanged; check your access and entered readings.', 'error');
      return;
    }

    setSelectedCase(null);
    showToast(
      'Physical Verification Logged',
      `Action ${actionId} (${benId}) verified with calibrated reading: ${w} kg. Case resolved in sector audit.`,
      'success'
    );
  };

  const handleAcknowledgeCase = () => {
    if (!selectedCase) return;
    if (!requireStaffAction('acknowledge action queue cases')) {
      return;
    }
    if (!canAcknowledge) {
      showToast('Permission Restricted', `Role ${role || 'unknown'} cannot acknowledge cases.`, 'error');
      return;
    }
    const actorId = staffUser?.id || 'AWW-409';
    const saved = mockStore.acknowledgeCase(selectedCase.actionId, { actorId, role });
    if (!saved) {
      showToast('Case Not Updated', 'The acknowledgement was rejected; no case changes were saved.', 'error');
      return;
    }
    showToast(
      'Case Acknowledged',
      `Action ${selectedCase.actionId} marked Under Review with timestamp. Scheduled for verification.`,
      'info'
    );
    setSelectedCase((prev) => (prev ? { ...prev, status: 'Under Review', acknowledgedAt: '24 Oct 2026', acknowledgedBy: actorId } : null));
  };

  const handleOpenEscalateModal = () => {
    if (!selectedCase) return;
    if (!canEscalate) {
      showToast('Permission Restricted', `Role ${role || 'unknown'} cannot escalate cases.`, 'error');
      return;
    }
    if (!requireStaffAction('escalate cases to higher supervisory tiers')) {
      return;
    }
    const canEsc = canEscalateCase(selectedCase.tierLevel || 1);
    if (!canEsc.allowed) {
      showToast('Maximum Escalation Reached', canEsc.reason || 'Cannot escalate further.', 'info');
      return;
    }
    setEscalateTargetTier(((selectedCase.tierLevel || 1) + 1) as 1 | 2 | 3 | 4);
    setIsEscalateModalOpen(true);
  };

  const handleConfirmEscalate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!canEscalate) {
      showToast('Permission Restricted', `Role ${role || 'unknown'} cannot escalate cases.`, 'error');
      setIsEscalateModalOpen(false);
      return;
    }
    if (!requireStaffAction('escalate cases to higher supervisory tiers')) {
      setIsEscalateModalOpen(false);
      return;
    }

    const actorId = staffUser?.id || 'AWW-409';
    const saved = mockStore.escalateCase(
      selectedCase.actionId,
      escalateTargetTier,
      escalateReason,
      { actorId, role }
    );
    if (!saved) {
      showToast('Escalation Not Saved', 'The escalation was rejected; no case or audit changes were saved.', 'error');
      return;
    }

    const targetTierInfo = ESCALATION_TIERS[escalateTargetTier];
    showToast(
      'Case Escalated Successfully',
      `Action ${selectedCase.actionId} escalated to Tier ${escalateTargetTier} (${targetTierInfo?.roleName}). Reason recorded in audit trail.`,
      'warning'
    );
    setIsEscalateModalOpen(false);
    setSelectedCase(null);
  };

  const handleEscalateToNRC = () => {
    if (!selectedCase) return;
    if (!canEscalate) {
      showToast('Permission Restricted', `Role ${role || 'unknown'} cannot initiate escalation.`, 'error');
      return;
    }
    navigate(`/referrals`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Screen Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-[11px] font-semibold text-rose-800 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Human-in-the-Loop Triaging
          </div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Frontline Action Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
            Prioritized worklist of 35 flagged anthropometric anomalies, physical measurement conflicts, and referral milestones requiring supervisory verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/rules"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2457F5]" />
            Rule Engine (8 Active)
          </Link>
          <Link
            to="/beneficiaries/BEN-0142"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Spotlight: BEN-0142</span>
          </Link>
        </div>
      </motion.div>

      {/* 4 Staggered KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Pending Verification',
            value: 7,
            suffix: ' cases',
            subtext: '4 Urgent • 3 Needs Attention',
            icon: AlertTriangle,
            badgeColor: 'bg-rose-100 text-rose-800',
          },
          {
            label: 'Avg Verification Turnaround',
            value: 1.4,
            isDecimal: true,
            suffix: ' days',
            subtext: 'SLA Target: < 2.0 days',
            icon: Clock,
            badgeColor: 'bg-emerald-100 text-emerald-800',
          },
          {
            label: 'Resolved This Month',
            value: 38,
            suffix: ' cases',
            subtext: '94.7% supervisory SLA adherence',
            icon: CheckCircle2,
            badgeColor: 'bg-blue-100 text-blue-800',
          },
          {
            label: 'Escalated to NRC / MO',
            value: 3,
            suffix: ' referrals',
            subtext: '0 SAM with med. complications',
            icon: ShieldAlert,
            badgeColor: 'bg-purple-100 text-purple-800',
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.06 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className="bg-white/85 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.badgeColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-light tracking-tight text-[#0F172A] flex items-baseline gap-1">
                  {card.isDecimal ? <span>{card.value}</span> : <AnimatedNumber value={card.value} />}
                  <span className="text-xs font-normal text-slate-500">{card.suffix}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">{card.subtext}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Table Panel with Filters & Pagination */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 shadow-sm overflow-hidden"
      >
        {/* Filter Bar with Sliding Pill Tabs */}
        <div className="p-5 border-b border-slate-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Sliding Pill Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 relative bg-slate-100/80 p-1.5 rounded-full border border-slate-200/60 max-w-full">
            {[
              { id: 'all', label: `All (${cases.length})` },
              { id: 'urgent', label: 'Urgent Anomaly (12)' },
              { id: 'drift', label: 'Measurement Drift (12)' },
              { id: 'sam', label: 'SAM / MAM Flag (11)' },
              { id: 'visit', label: 'Home Visit (0)' },
            ].map((tab) => {
              const isActive = activeFilterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveFilterTab(tab.id as any);
                    setCurrentPage(1);
                  }}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] ${
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeQueueTabPill"
                      className="absolute inset-0 bg-[#0F172A] rounded-full -z-10 shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Priority Selector */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search child, ID, AWW..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-full text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 focus:border-[#2457F5] transition-all"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 cursor-pointer"
            >
              <option value="all">Priority: All</option>
              <option value="urgent">Urgent Only</option>
              <option value="attention">Needs Attention</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1210px] table-fixed text-left border-collapse">
            <colgroup>
              <col style={{ width: 225 }} />
              <col style={{ width: 225 }} />
              <col style={{ width: 270 }} />
              <col style={{ width: 145 }} />
              <col style={{ width: 230 }} />
              <col style={{ width: 115 }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Action & Beneficiary</th>
                <th className="py-3 px-4">Biometric Concern & Trigger</th>
                <th className="py-3 px-4">Comparison (Prev vs Flagged)</th>
                <th className="py-3 px-4">Assigned Worker</th>
                <th className="py-3 px-4">Status & SLA</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              <AnimatePresence mode="popLayout">
                {paginatedCases.map((item, idx) => (
                  <motion.tr
                    key={item.actionId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.8)' }}
                    className="group cursor-pointer transition-colors align-middle"
                    onClick={() => handleOpenDetail(item)}
                  >
                    {/* Action & Beneficiary */}
                    <td className="py-3 px-5 align-middle">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {item.id.slice(-3)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#0F172A] flex flex-wrap items-center gap-1.5">
                            <Link
                              to={`/beneficiaries/${item.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#2457F5] transition-colors"
                            >
                              <DataBadge variant="beneficiary" className="font-mono">{item.id}</DataBadge>
                            </Link>
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({item.ageMonths}m • {item.gender})
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <DataBadge variant="action" className="font-mono">{item.actionId}</DataBadge>
                            <span>•</span>
                            <DataBadge variant="centre" className="font-mono">{item.centreCode}</DataBadge>
                          </div>
                          <div className="break-words text-[10px] text-slate-500 mt-0.5">
                            Caregiver: {item.caregiverKinship} • Centre: {item.centreCode}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Biometric Concern */}
                    <td className="py-3 px-4 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <DataBadge variant="rule" className="shrink-0 font-mono">{item.ruleCode}</DataBadge>
                        <span className="min-w-0 break-words text-[10px] font-semibold leading-snug text-slate-700">{item.ruleName}</span>
                      </div>
                      <p className="break-words text-slate-700 font-medium leading-relaxed">
                        {item.concernSummary}
                      </p>
                    </td>

                    {/* Comparison */}
                    <td className="py-3 px-4 align-middle">
                      <div className="space-y-1">
                        <div className="flex min-w-0 flex-nowrap items-center gap-1 rounded-lg border border-[#A9C6D9]/70 bg-[#E5EFF6]/70 px-2 py-1">
                          <span className="w-8 shrink-0 text-[10px] text-slate-500">Prev:</span>
                          <DataBadge variant="previous" className="whitespace-nowrap font-mono tabular-nums">{item.prevWeight.toFixed(2)} kg</DataBadge>
                          <DataBadge variant="date" className="whitespace-nowrap font-mono tabular-nums">{item.prevDate}</DataBadge>
                        </div>
                        <div className="flex min-w-0 flex-nowrap items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/80 px-2 py-1">
                          <span className="w-8 shrink-0 text-[10px] font-medium text-rose-700">Flag:</span>
                          <DataBadge variant="flagged" className="whitespace-nowrap font-mono tabular-nums">{item.flaggedWeight.toFixed(2)} kg</DataBadge>
                          <DataBadge variant="date" className="whitespace-nowrap font-mono tabular-nums">{item.flaggedDate}</DataBadge>
                        </div>
                        <div className="inline-flex min-h-6 items-center rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-900 font-mono tabular-nums">
                          Δ {item.weightDelta}
                        </div>
                      </div>
                    </td>

                    {/* Assigned Worker */}
                    <td className="py-3 px-4 align-middle">
                      <div className="flex flex-col items-start gap-1">
                        <DataBadge variant="worker" className="whitespace-nowrap font-mono">{item.assignedAww}</DataBadge>
                        <DataBadge variant="centre" className="whitespace-nowrap font-mono">{item.centreCode}</DataBadge>
                      </div>
                    </td>

                    {/* Status & SLA */}
                    <td className="py-3 px-4 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex min-h-6 items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${item.priorityColor}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {item.priority}
                        </span>
                        <DataBadge variant="date" className="whitespace-nowrap font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Due {item.dueDate}
                        </DataBadge>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-5 text-right align-middle">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(item);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-medium text-xs shadow-sm transition-transform active:scale-95 inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
                      >
                        {item.isVerified ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {filteredCases.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              No pending action cases match the specified search or filter criteria.
            </div>
          )}
        </div>

        {/* Pagination & Footer */}
        <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/70 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredCases.length)} of {filteredCases.length} filtered items ({cases.length} total)
          </span>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Case Detail Right-hand Drawer with Soft Backdrop Blur & Esc Close */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSelectedCase(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              aria-hidden="true"
            />

            {/* Sliding Drawer Container from Right */}
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200"
              >
                {/* Drawer Top Header */}
                <div className="p-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-sm">
                      PAL
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-lg text-[#0F172A] flex flex-wrap items-center gap-2">
                          Case <DataBadge variant="action" className="font-mono">{selectedCase.actionId}</DataBadge>
                        </h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${selectedCase.priorityColor}`}>
                          {selectedCase.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        Beneficiary ID: <DataBadge variant="beneficiary" className="ml-1 align-middle">{selectedCase.id}</DataBadge>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-mono hidden sm:inline-block">
                      Press Esc to close
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCase(null)}
                      className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
                      aria-label="Close drawer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Drawer Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Beneficiary Snapshot Banner */}
                  <div className="bg-[#F6FAFF] border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm text-[#0F172A] flex flex-wrap items-center gap-2">
                        <DataBadge variant="beneficiary" className="font-mono">{selectedCase.id}</DataBadge>
                        <span className="text-slate-500 font-normal">({selectedCase.ageMonths}m • {selectedCase.gender})</span>
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Caregiver: <span className="font-medium">{selectedCase.caregiverKinship}</span> • Centre: {selectedCase.centreCode}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Assigned: <DataBadge variant="worker" className="ml-1 font-mono">{selectedCase.assignedAww}</DataBadge>
                      </p>
                    </div>

                    <Link
                      to={`/beneficiaries/${selectedCase.id}`}
                      className="px-3 py-1.5 text-xs font-semibold text-[#2457F5] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1 self-start sm:self-auto"
                    >
                      <span>View Growth Profile</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Multi-Tier Role Assignment & Escalation Status */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center">
                          T{selectedCase.tierLevel || 1}
                        </span>
                        <div>
                          <div className="font-semibold text-xs text-[#0F172A]">
                            {ESCALATION_TIERS[selectedCase.tierLevel || 1]?.title}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Assigned Actor: {selectedCase.assignedActor || selectedCase.assignedAww}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canAcknowledge && selectedCase.status !== 'Under Review' && !selectedCase.isVerified && (
                          <button
                            type="button"
                            onClick={handleAcknowledgeCase}
                            className="px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-[#2457F5] border border-blue-200 text-[10px] font-semibold transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        {canEscalate && (selectedCase.tierLevel || 1) < 4 && !selectedCase.isVerified && (
                          <button
                            type="button"
                            onClick={handleOpenEscalateModal}
                            className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold transition-colors"
                          >
                            Escalate Tier &gt;
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedCase.acknowledgedAt && (
                      <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Acknowledged on {selectedCase.acknowledgedAt} by {selectedCase.acknowledgedBy || 'Frontline Worker'}</span>
                      </div>
                    )}

                    {/* Escalation Step History */}
                    {selectedCase.escalationHistory && selectedCase.escalationHistory.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Assignment & Escalation Log ({selectedCase.escalationHistory.length})
                        </span>
                        {selectedCase.escalationHistory.map((step, sIdx) => (
                          <div key={sIdx} className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] space-y-0.5">
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>
                                {step.fromTier === step.toTier && ['System Engine', 'Rule Engine'].includes(step.fromActor)
                                  ? `Initial assignment · Tier ${step.toTier}`
                                  : `Tier ${step.fromTier} → Tier ${step.toTier}`}
                              </span>
                              <span>{step.timestamp}</span>
                            </div>
                            <div className="font-medium text-slate-800">{step.reason}</div>
                            <div className="text-[10px] text-slate-500">By {step.fromActor} &bull; To {step.toActor}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Triggered Rule Card */}
                  <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs mb-1">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Screening Rule Triggered: {selectedCase.ruleCode} — {selectedCase.ruleName}</span>
                    </div>
                    <p className="text-xs text-rose-950 font-normal leading-relaxed mt-1">
                      {selectedCase.triggerDetail}
                    </p>
                    <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>Non-clinical heuristic: Flags extreme data drift before official consolidation. (Example rule • Demo)</span>
                    </div>
                  </div>

                  {/* Deterministic, field-grounded case explanation preview */}
                  <div className="bg-blue-50/60 border border-blue-200/70 rounded-2xl p-4 space-y-2.5">
                    <h4 className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#2457F5]" />
                      <span>Explain This Case — Demo Preview</span>
                    </h4>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {buildCaseExplanation(selectedCase)}
                    </p>
                    {selectedRuleGuidance && (
                      <p className="text-[11px] text-slate-600 leading-relaxed border-t border-blue-200/70 pt-2">
                        <span className="font-semibold text-slate-700">General rule guidance:</span>{' '}
                        {selectedRuleGuidance}
                      </p>
                    )}
                    <div className="border-t border-blue-200/70 pt-2 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-[11px] font-semibold text-[#0F172A]">Suggested Next Action</h5>
                        <span className="rounded-full border border-blue-200 bg-white/70 px-2 py-0.5 text-[9px] font-semibold text-blue-800">
                          Demo Preview — not live AI
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        {selectedRuleGuidance || 'No suggested workflow step is recorded for this rule.'}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        General rule guidance only; this is not an AI decision or a case-specific recommendation. This step has NOT been executed automatically.
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Rule-based demo preview, not AI-generated or a diagnosis. This flag requires human verification.
                    </p>
                  </div>

                  {/* Biometric Comparison Cards */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                      Anthropometric Comparison
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Prior Verified Visit
                        </div>
                        <div className="mt-1"><DataBadge variant="date" className="font-mono">{selectedCase.prevDate}</DataBadge></div>
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Weight:</span>
                            <DataBadge variant="previous" className="font-mono">{typeof selectedCase.prevWeight === 'number' && Number.isFinite(selectedCase.prevWeight) ? `${selectedCase.prevWeight.toFixed(2)} kg` : 'Not recorded'}</DataBadge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Height:</span>
                            <DataBadge variant="previous" className="font-mono">{typeof selectedCase.prevHeight === 'number' && Number.isFinite(selectedCase.prevHeight) ? `${selectedCase.prevHeight.toFixed(1)} cm` : 'Not recorded'}</DataBadge>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Status:</span>
                            <span className="font-medium text-emerald-600">Normal (Green)</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
                        <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
                          Flagged Record
                        </div>
                        <div className="mt-1"><DataBadge variant="date" className="font-mono">{selectedCase.flaggedDate}</DataBadge></div>
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-rose-700">Weight:</span>
                            <DataBadge variant="flagged" className="font-mono">{typeof selectedCase.flaggedWeight === 'number' && Number.isFinite(selectedCase.flaggedWeight) ? `${selectedCase.flaggedWeight.toFixed(2)} kg` : 'Not recorded'}</DataBadge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-rose-700">Height:</span>
                            <DataBadge variant="flagged" className="font-mono">{typeof selectedCase.flaggedHeight === 'number' && Number.isFinite(selectedCase.flaggedHeight) ? `${selectedCase.flaggedHeight.toFixed(1)} cm` : 'Not recorded'}</DataBadge>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-rose-700">Discrepancy:</span>
                            <span className="font-bold text-rose-700">Δ {selectedCase.weightDelta}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {canVerify && <>
                  {/* SOP Physical Verification Checklist */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <h4 className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 mb-2">
                      <UserCheck className="w-4 h-4 text-[#2457F5]" />
                      <span>Supervisory Physical Verification SOP Checklist</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Verify protocol adherence before confirming the record change:
                    </p>

                    <div className="space-y-2.5 text-xs">
                      {[
                        {
                          key: 'calibratedScale',
                          number: '1',
                          text: 'Scale zeroed with standard 5.0 kg calibration weight before weighing.',
                        },
                        {
                          key: 'minimalClothing',
                          number: '2',
                          text: 'Child stripped of heavy winter coats/footwear (bare minimum clothing).',
                        },
                        {
                          key: 'checkedPreviousLog',
                          number: '3',
                          text: 'Cross-referenced physical handwritten AWC register (digit typo check).',
                        },
                        {
                          key: 'edemaChecked',
                          number: '4',
                          text: 'Follow the approved protocol for checking and recording edema-related observations; escalate concerns to the appropriate health professional.',
                        },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#F3F7FA] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={(sopChecked as any)[item.key]}
                            onChange={(e) =>
                              setSopChecked((prev) => ({ ...prev, [item.key]: e.target.checked }))
                            }
                            className="mt-1 rounded text-[#2457F5] focus:ring-[#2457F5]"
                          />
                          <span className="flex items-start gap-2.5 text-slate-700 text-[11px] leading-relaxed">
                            <span className="w-5 h-5 shrink-0 rounded-md bg-blue-100 text-[#2457F5] border border-blue-200 flex items-center justify-center font-semibold text-[10px]">
                              {item.number}
                            </span>
                            <span>{item.text}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Verification Findings Form */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Supervisor Resolution Entry
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Verified Weight (kg)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0.01"
                            required
                            step="0.05"
                            value={verifiedWeight}
                            onChange={(e) => setVerifiedWeight(e.target.value)}
                            placeholder="Enter verified weight after physical measurement"
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2457F5]"
                          />
                          <Scale className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Verified Stature (cm)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0.01"
                            required
                            step="0.1"
                            value={verifiedHeight}
                            onChange={(e) => setVerifiedHeight(e.target.value)}
                            placeholder="e.g. 77.5"
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2457F5]"
                          />
                          <Ruler className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Finding Classification
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'typo', label: 'Typo in Record' },
                          { id: 'genuine', label: 'Genuine Anomaly' },
                          { id: 'referral', label: 'Escalate to NRC' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFindingReason(opt.id as any)}
                            className={`p-2 rounded-xl text-[11px] font-medium border text-center transition-all ${
                              findingReason === opt.id
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-500">Demo selection only; it is not saved to the case record.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Supervisor Field Notes & Justification
                      </label>
                      <textarea
                        rows={3}
                        value={supervisorNotes}
                        onChange={(e) => setSupervisorNotes(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2457F5]"
                        placeholder="Record observations after verification"
                      />
                    </div>
                  </div>
                  </>}
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {canEscalate && <button
                    type="button"
                    onClick={handleEscalateToNRC}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    Escalate to MO / NRC
                  </button>}

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedCase(null)}
                      className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition-colors"
                    >
                      Cancel
                    </button>
                    {canVerify && <button
                      type="button"
                      onClick={handleCompleteVerification}
                      className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full shadow-sm transition-transform active:scale-95 inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Update Record</span>
                    </button>}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Escalation Modal Dialog */}
      <AnimatePresence>
        {isEscalateModalOpen && selectedCase && canEscalate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#0F172A] flex flex-wrap items-center gap-2">
                      Escalate Case <DataBadge variant="action" className="font-mono">{selectedCase.actionId}</DataBadge>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Beneficiary ID: <DataBadge variant="beneficiary" className="ml-1 font-mono">{selectedCase.id}</DataBadge>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEscalateModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmEscalate} className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Current Role Tier</span>
                    <span className="font-semibold text-slate-800">
                      Tier {selectedCase.tierLevel || 1}: {selectedCase.assignedRole}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Current Status</span>
                    <span className="font-semibold text-amber-700">{selectedCase.status}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Target Escalation Tier</label>
                  <select
                    value={escalateTargetTier}
                    onChange={(e) => setEscalateTargetTier(parseInt(e.target.value, 10) as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 cursor-pointer"
                  >
                    {[2, 3, 4]
                      .filter((tier) => tier > (selectedCase.tierLevel || 1))
                      .map((tier) => (
                        <option key={tier} value={tier}>
                          {ESCALATION_TIERS[tier]?.title} ({ESCALATION_TIERS[tier]?.actorName})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Escalation Justification / Overdue Reason</label>
                  <textarea
                    rows={3}
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    placeholder="Provide operational reason for higher supervisory or clinical triage..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEscalateModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
                  >
                    Confirm Escalation
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
