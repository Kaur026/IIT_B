import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  Clock,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Shield,
  Calendar,
  CheckCircle2,
  Check,
  UserPlus,
  ListTodo,
  FileBarChart2,
  ShieldCheck,
  Scale,
  X,
  Ruler,
  Lock,
  Eye,
  Sliders,
  HeartHandshake,
  Building2,
  TrendingUp,
  Activity,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DataBadge } from '../components/common/DataBadge';
import { mockStore, BeneficiaryCase, BeneficiaryRecord } from '../store/mockStore';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CategoryIllustration, CategoryType } from '../components/portal/CategoryIllustrations';
import { canPerformAction, ROLE_CONFIGS } from '../utils/permissions';
import { calculateAge, getDaysUntilDate, getTodayISODate } from '../utils/casework';

export const MockDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { isReadOnlyDemo, requireStaffAction, role, staffUser } = useAuth();
  const canVerifyCases = canPerformAction(role, 're_measure');
  const demoScope = {
    role,
    centreCode: staffUser?.centreCode,
    sectorCode: staffUser?.sectorCode,
    projectCode: staffUser?.projectCode,
    actorId: staffUser?.id,
  };

  const [activeQueueTab, setActiveQueueTab] = useState<'all' | 'urgent' | 'verification' | 'referrals'>('all');
  const [cases, setCases] = useState<BeneficiaryCase[]>([]);
  const [selectedCaseToVerify, setSelectedCaseToVerify] = useState<BeneficiaryCase | null>(null);
  const [verifiedWeightInput, setVerifiedWeightInput] = useState('');
  const [verifiedHeightInput, setVerifiedHeightInput] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');

  useEffect(() => {
    const fetch = () => {
      setCases(mockStore.getCases(demoScope));
    };
    fetch();
    const unsubscribe = mockStore.subscribe(fetch);
    return unsubscribe;
  }, [role, staffUser]);

  useEffect(() => {
    if (location.hash) {
      const target = location.hash.slice(1);
      const el = document.getElementById(target);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [location.hash]);

  const handleOpenVerifyModal = (item: BeneficiaryCase) => {
    setSelectedCaseToVerify(item);
    setVerifiedWeightInput('');
    setVerifiedHeightInput('');
    setVerificationNotes('');
  };

  const handleConfirmVerification = () => {
    if (!selectedCaseToVerify) return;
    if (!isReadOnlyDemo && !canVerifyCases) {
      showToast('Permission Restricted', `Role ${role || 'unknown'} cannot verify cases.`, 'error');
      return;
    }
    if (!requireStaffAction('confirm physical verifications or modify case records')) {
      return;
    }
    const weight = Number(verifiedWeightInput);
    const height = Number(verifiedHeightInput);
    if (!verifiedWeightInput.trim() || !Number.isFinite(weight) || weight <= 0 || !verifiedHeightInput.trim() || !Number.isFinite(height) || height <= 0) {
      showToast('Verification Not Saved', 'Enter valid, physically measured weight and height before completing verification.', 'error');
      return;
    }
    const actorId = staffUser?.id || 'AWW-409';
    const saved = mockStore.verifyCase(
      selectedCaseToVerify.actionId,
      weight,
      height,
      verificationNotes,
      { actorId, role }
    );
    if (!saved) {
      showToast('Verification Not Saved', 'The verification was rejected. The case remains unchanged; check your access and entered readings.', 'error');
      return;
    }
    showToast(
      'Physical verification logged',
      `Record ${selectedCaseToVerify.actionId} (${selectedCaseToVerify.id}) confirmed with calibrated scale. Status updated to Resolved.`,
      'success'
    );
    setSelectedCaseToVerify(null);
  };

  const metrics = mockStore.getMetrics(demoScope);
  const totalPop = Math.max(1, metrics.total);
  const allBeneficiaries = mockStore.getBeneficiaries(demoScope);
  const allReferrals = mockStore.getReferrals(demoScope);

  // Beneficiaries with overdue/pending measurements (>35 days)
  const staleChildren = allBeneficiaries
    .filter((b) => b.category === 'child_under_6')
    .filter((b) => {
      if (!b.lastMeasurementDate) return true;
      const days = getDaysUntilDate(b.lastMeasurementDate, getTodayISODate());
      return days === undefined || days > 35 || days < 0;
    });

  // Recent activity log scoped to role
  const recentActivity = role === 'AWW'
    ? [
        ...mockStore.getMeasurements(undefined, demoScope).map((m) => ({
          id: m.id,
          actionType: 'Measurement recorded',
          timestamp: m.date,
          deltaSummary: `${m.beneficiaryId}: ${m.weightKg} kg / ${m.heightCm} cm.`,
          status: m.isVerified ? 'Verified' : 'Logged',
        })),
        ...cases.map((c) => ({
          id: c.actionId,
          actionType: 'Casework assigned',
          timestamp: c.flaggedDate,
          deltaSummary: `${c.id}: ${c.concernSummary}`,
          status: c.isVerified ? 'Verified' : 'Escalated',
        })),
        ...allReferrals.map((r) => ({
          id: r.id,
          actionType: 'Referral follow-up',
          timestamp: r.referralDate,
          deltaSummary: `${r.beneficiaryId}: ${r.destination} · ${r.status}.`,
          status: r.status === 'Completed' ? 'Verified' : 'Logged',
        })),
      ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 4)
    : mockStore.getAuditLog(demoScope).slice(0, 4);

  // Centre comparison matrix (all 5 canonical centres)
  const allCentres = ['AWC-702', 'AWC-703', 'AWC-704', 'AWC-705', 'AWC-706'];
  const centreComparisons = allCentres.map((cCode) => {
    const cMetrics = mockStore.getMetrics({ role: 'AWW', centreCode: cCode });
    const cCases = mockStore.getCases({ role: 'CDPO', centreCode: cCode });
    const pending = cCases.filter((c) => !c.isVerified).length;
    const resolved = cCases.filter((c) => c.isVerified).length;
    const sector = ['AWC-702', 'AWC-703', 'AWC-704'].includes(cCode) ? 'Sector-4' : 'Sector-5';
    const compliance = cMetrics.total > 0 ? Math.round(((cMetrics.total - cMetrics.pendingMeasurements) / cMetrics.total) * 100) : 100;
    return {
      code: cCode,
      sector,
      total: cMetrics.total,
      pendingCases: pending,
      resolvedCases: resolved,
      urgentCases: cMetrics.urgentCases,
      openReferrals: cMetrics.openReferrals,
      compliance,
      staleCount: cMetrics.staleCount,
    };
  });

  // Six canonical categories breakdown
  const categories: {
    id: CategoryType;
    label: string;
    count: number;
    pct: number;
    color: string;
  }[] = [
    { id: 'children0to6m', label: 'Children (0–6 months)', count: metrics.children0to6m, pct: Number(((metrics.children0to6m / totalPop) * 100).toFixed(1)), color: 'bg-sky-500' },
    { id: 'children6mTo3y', label: 'Children (6 months–3 years)', count: metrics.children6mTo3y, pct: Number(((metrics.children6mTo3y / totalPop) * 100).toFixed(1)), color: 'bg-blue-600' },
    { id: 'children3to6y', label: 'Children (3–6 years)', count: metrics.children3to6y, pct: Number(((metrics.children3to6y / totalPop) * 100).toFixed(1)), color: 'bg-amber-500' },
    { id: 'adolescent', label: 'Adolescent Girls', count: metrics.adolescentGirls, pct: Number(((metrics.adolescentGirls / totalPop) * 100).toFixed(1)), color: 'bg-indigo-500' },
    { id: 'pregnant', label: 'Pregnant Women', count: metrics.pregnantWomen, pct: Number(((metrics.pregnantWomen / totalPop) * 100).toFixed(1)), color: 'bg-rose-500' },
    { id: 'lactating', label: 'Lactating Mothers', count: metrics.lactatingMothers, pct: Number(((metrics.lactatingMothers / totalPop) * 100).toFixed(1)), color: 'bg-purple-500' },
  ];

  const urgentCount = cases.filter((c) => c.priority === 'Urgent' && !c.isVerified).length;
  const verifyCount = cases.filter((c) => c.status === 'Pending Verification' && !c.isVerified).length;
  const referralCount = cases.filter((c) => c.category === 'sam' || c.priority === 'Referral Pending').length;

  const filteredPreview = cases
    .filter((item) => {
      if (activeQueueTab === 'urgent') return item.priority === 'Urgent' && !item.isVerified;
      if (activeQueueTab === 'verification') return item.status === 'Pending Verification' && !item.isVerified;
      if (activeQueueTab === 'referrals') return item.category === 'sam' || item.priority === 'Referral Pending';
      return true;
    })
    .slice(0, 5);

  // Protocol-grounded alerts for AWW
  const awwFrontlineAlerts = [
    {
      id: 'ALT-1',
      title: 'High Velocity Weight Drop (>1.5 kg in 30d)',
      target: 'BEN-0142',
      rule: 'RUL-01: Rapid Depletion Protocol',
      action: 'Confirm scale tare is zeroed. Conduct physical re-weighing and evaluate illness/hydration status.',
      severity: 'Urgent',
      severityColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      id: 'ALT-2',
      title: 'Growth Faltering Over 2 Consecutive Months',
      target: 'BEN-0219',
      rule: 'RUL-03: Growth Stagnation Check',
      action: 'Provide supplementary nutrition (THR) counseling and review infant feeding practices with mother.',
      severity: 'Needs Attention',
      severityColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'ALT-3',
      title: 'NRC Referral Post-Discharge Follow-up',
      target: 'BEN-0088',
      rule: 'ICDS Protocol: 14-Day Post-NRC Checkpoint',
      action: 'Schedule frontline home visit to assess weight trajectory and dietary adherence.',
      severity: 'In Progress',
      severityColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Context Area */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
              {role === 'AWW'
                ? `Frontline Operations · Centre ${staffUser?.centreCode || 'AWC-702'}`
                : role === 'LS'
                ? 'Supervisor Operations · Sector 4 Catchment'
                : role === 'CDPO'
                ? 'Project Operations · Project Central'
                : role === 'DPO'
                ? 'District Oversight · Read-Only Program Monitoring'
                : isReadOnlyDemo
                ? 'Public Overview · Project Aggregates'
                : ROLE_CONFIGS[role || 'User'].fullTitle}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17365D]">
            {role === 'AWW'
              ? `AWW Centre Briefing — ${staffUser?.centreCode || 'AWC-702'}`
              : role === 'LS'
              ? 'Supervisor Operations Dashboard — Sector 4'
              : role === 'CDPO'
              ? 'Project Operations Dashboard — Project Central'
              : role === 'DPO'
              ? 'District Oversight Dashboard'
              : role === 'System Administrator'
              ? 'System Administration Console'
              : role === 'Rule Administrator'
              ? 'Screening Rules & Test Bench'
              : 'Poshan Public Overview'}
          </h1>
          <p className="text-sm text-[#52708F] mt-1 font-normal leading-relaxed">
            {role === 'AWW'
              ? `Assigned centre ${staffUser?.centreCode || 'AWC-702'}: daily beneficiary monitoring, due measurements, and priority cases.`
              : role === 'LS'
              ? 'Supervisory oversight across centres: AWC-702, AWC-703, AWC-704 (465 beneficiaries). Independent verifications and escalations.'
              : role === 'CDPO'
              ? 'Project-wide administrative oversight across all 5 Anganwadi centres (600 beneficiaries).'
              : role === 'DPO'
              ? 'District-level programme oversight, centre performance comparisons, and screening trends. (Read-only monitoring).'
              : 'Beneficiary monitoring, linked casework, and referral follow-up.'}
          </p>
        </div>

        {/* Role-Specific Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {role === 'AWW' && (
            <>
              <Link
                to="/measurements"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Record new measurement"
              >
                <Scale className="w-3.5 h-3.5 text-blue-600" />
                <span>+ Measure</span>
              </Link>
              <Link
                to="/beneficiaries/register"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-all shadow-xs flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
                title="Register new beneficiary"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Register</span>
              </Link>
              <Link
                to="/queue"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <ListTodo className="w-3.5 h-3.5 text-blue-600" />
                <span>Action Queue ({metrics.pendingCases})</span>
              </Link>
            </>
          )}

          {role === 'LS' && (
            <>
              <Link
                to="/queue"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verification Queue ({verifyCount})</span>
              </Link>
              <Link
                to="/reports"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <FileBarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sector Reports</span>
              </Link>
            </>
          )}

          {role === 'CDPO' && (
            <>
              <Link
                to="/beneficiaries"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>All Centres (600)</span>
              </Link>
              <Link
                to="/queue"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <ListTodo className="w-3.5 h-3.5 text-blue-600" />
                <span>Action Queue ({metrics.pendingCases})</span>
              </Link>
              <Link
                to="/reports"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <FileBarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reports</span>
              </Link>
            </>
          )}

          {role === 'DPO' && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Read-Only Oversight</span>
              </div>
              <Link
                to="/reports"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <FileBarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>District Reports</span>
              </Link>
            </>
          )}

          {(role === 'System Administrator' || role === 'Rule Administrator') && (
            <>
              <Link
                to="/rules"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Rules Console</span>
              </Link>
              <Link
                to="/reports"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Audit Logs</span>
              </Link>
            </>
          )}

          {isReadOnlyDemo && !role && (
            <>
              <Link
                to="/beneficiaries"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-[#F8FBFF] border border-[#BBD5F0] rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Beneficiaries ({metrics.total})</span>
              </Link>
              <Link
                to="/signin"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-all shadow-xs flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Staff Sign In</span>
              </Link>
            </>
          )}
        </div>
      </motion.div>

      {/* 2. Top 4 Standardized KPI Cards (Scoped per role) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: role === 'AWW' ? 'Assigned Beneficiaries' : role === 'LS' ? 'Sector Beneficiaries' : role === 'DPO' ? 'District Enrollment' : 'Total Beneficiaries',
            value: metrics.total,
            subtext: role === 'AWW' ? `${metrics.totalChildren} children · ${metrics.totalMothers} mothers` : role === 'LS' ? 'Catchment: AWC-702, 703, 704' : 'Across 5 Anganwadi centres',
            icon: Users,
            badgeColor: 'bg-[#F8FBFF] text-blue-700 border-[#BBD5F0]',
          },
          {
            label: role === 'AWW' ? 'Measurements Due' : role === 'LS' ? 'Awaiting Verification' : role === 'DPO' ? 'Severe Malnutrition' : 'Active Casework',
            value: role === 'AWW' ? metrics.pendingMeasurements : role === 'LS' ? verifyCount : role === 'DPO' ? metrics.urgentCases : metrics.pendingCases,
            suffix: role === 'AWW' ? ' due' : role === 'LS' ? ' cases' : role === 'DPO' ? ' SAM/MAM' : ' cases',
            subtext: role === 'AWW' ? 'Overdue or due for monthly weigh-in' : role === 'LS' ? 'Calibrated spring scale spot-checks' : role === 'DPO' ? 'Active acute clinical alerts' : `${metrics.urgentCases} Urgent · ${metrics.attentionCases} Needs Attention`,
            icon: role === 'AWW' ? Scale : AlertTriangle,
            badgeColor: 'bg-[#F8FBFF] text-rose-700 border-[#BBD5F0]',
          },
          {
            label: role === 'AWW' ? 'Active Cases' : role === 'LS' ? 'Overdue Follow-ups' : role === 'DPO' ? 'Clinical Referrals' : 'Physical Verifications',
            value: role === 'AWW' ? metrics.pendingCases : role === 'LS' ? (metrics.overdueTasks + metrics.staleCount) : role === 'DPO' ? metrics.openReferrals : metrics.resolvedCases,
            suffix: role === 'AWW' ? ' active' : role === 'LS' ? ' pending' : role === 'DPO' ? ' escalated' : ' resolved',
            subtext: role === 'AWW' ? `${metrics.urgentCases} Urgent · ${metrics.attentionCases} Attention` : role === 'LS' ? 'Requiring supervisory assistance' : role === 'DPO' ? 'NRC & PHC hospital coordination' : 'Calibrated scale confirmations',
            icon: role === 'AWW' ? ListTodo : role === 'LS' ? Clock : CheckCircle2,
            badgeColor: 'bg-[#F8FBFF] text-amber-700 border-[#BBD5F0]',
          },
          {
            label: role === 'AWW' ? 'Referrals & Follow-ups' : role === 'LS' ? 'Verified & Resolved' : role === 'DPO' ? 'Program Verification' : 'Measurement Compliance',
            value: role === 'AWW' ? metrics.openReferrals : role === 'LS' ? metrics.resolvedCases : role === 'DPO' ? (metrics.total ? Math.round((metrics.resolvedCases / Math.max(1, metrics.pendingCases + metrics.resolvedCases)) * 100) : 0) : (metrics.total ? Math.round(((metrics.total - metrics.staleCount) / metrics.total) * 100) : 0),
            suffix: role === 'AWW' ? ' active' : role === 'LS' ? ' resolved' : '%',
            subtext: role === 'AWW' ? 'Clinical follow-up in progress' : role === 'LS' ? 'Logged in sector audit trail' : role === 'DPO' ? 'Independent spot-checks completed' : 'Enrolled children up to date',
            icon: role === 'AWW' ? HeartHandshake : CheckCircle2,
            badgeColor: 'bg-[#F8FBFF] text-blue-700 border-[#BBD5F0]',
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className="bg-[#E8F2FC] rounded-2xl p-5 border border-[#BBD5F0] shadow-xs flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#52708F] uppercase tracking-wider">{card.label}</span>
                <div className={`p-2 rounded-xl border ${card.badgeColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-semibold text-[#17365D] tracking-tight flex items-baseline gap-1">
                  <AnimatedNumber value={card.value} />
                  {card.suffix && <span className="text-xs font-medium text-[#52708F]">{card.suffix}</span>}
                </div>
                <p className="text-xs text-[#52708F] mt-1 font-normal leading-relaxed truncate">
                  {card.subtext}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* =========================================================================
          ROLE-SPECIFIC DASHBOARD SECTIONS
         ========================================================================= */}

      {/* -----------------------------------------------------------------------
          ROLE: AWW (Anganwadi Worker)
          - Assigned beneficiaries
          - Measurements due
          - Assigned cases and follow-ups
          - Relevant alerts & recommended next actions
          - NO large generic briefing card
         ----------------------------------------------------------------------- */}
      {role === 'AWW' && (
        <div className="space-y-6">
          {/* Beneficiary Category Breakdown */}
          <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#BBD5F0] gap-2">
              <div>
                <h2 className="text-base font-bold text-[#17365D]">
                  Assigned Beneficiary Categories ({staffUser?.centreCode || 'AWC-702'})
                </h2>
                <p className="text-xs text-[#52708F] mt-0.5">
                  Catchment distribution across six Poshan 2.0 beneficiary cohorts.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-700 self-start sm:self-auto tabular-nums">
                Centre Total: {metrics.total} Beneficiaries
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
              {categories.map((cat, i) => (
                <div
                  key={cat.label}
                  className="p-3.5 rounded-2xl bg-[#F8FBFF] border border-[#BBD5F0] hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIllustration
                      type={cat.id}
                      className="w-10 h-10 ring-1 ring-slate-900/5 shadow-xs shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate" title={cat.label}>
                          {cat.label}
                        </span>
                        <span className="font-mono text-[#17365D] font-bold tabular-nums text-sm ml-2">
                          {cat.count}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cat.color} rounded-full`}
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
                    <span>{cat.pct}% of cohort</span>
                    <span>{cat.count} registered</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Main Grid: Assigned Cases (Left 8 cols) & Measurements Due / Alerts (Right 4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (8 cols): Assigned Cases & Priority Action Queue */}
            <div className="lg:col-span-8 space-y-6">
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#BBD5F0]">
                  <div>
                    <h2 className="text-base font-bold text-[#17365D]">
                      Assigned Action Queue ({cases.length})
                    </h2>
                    <p className="text-xs text-[#52708F] mt-0.5">
                      Frontline growth anomalies and follow-up tasks ordered by urgency.
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60 overflow-x-auto">
                    {[
                      { id: 'all', label: `All (${cases.length})` },
                      { id: 'urgent', label: `Urgent (${urgentCount})` },
                      { id: 'verification', label: `Verification (${verifyCount})` },
                      { id: 'referrals', label: `Referrals (${referralCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveQueueTab(tab.id as any)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap tabular-nums ${
                          activeQueueTab === tab.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-[#17365D]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Queue Items */}
                <div className="space-y-3">
                  {filteredPreview.map((item) => (
                    <div
                      key={item.actionId}
                      className="p-4 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <DataBadge variant="beneficiary" className="font-mono">{item.id}</DataBadge>
                          <Link
                            to={`/beneficiaries/${item.id}`}
                            className="text-xs font-bold text-[#17365D] hover:text-blue-600 transition-colors font-mono"
                          >
                            {item.id} <span className="font-normal text-[#52708F]">({item.ageMonths}m · {item.gender})</span>
                          </Link>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${item.priorityColor}`}>
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium leading-relaxed">
                          {item.concernSummary}
                        </p>
                        <div className="text-[11px] text-[#52708F] flex flex-wrap items-center gap-2">
                          <span>Assigned: <DataBadge variant="worker" className="font-mono">{item.assignedAww}</DataBadge></span>
                          <span>·</span>
                          <span>Due: <DataBadge variant="date" className="font-mono">{item.dueDate}</DataBadge></span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                        <Link
                          to={`/queue?search=${item.id}`}
                          className="px-3.5 py-1.5 rounded-full bg-[#F8FBFF] hover:bg-[#E8F2FC] text-[#17365D] border border-[#BBD5F0] text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1"
                        >
                          <span>Review Case</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </Link>
                      </div>
                    </div>
                  ))}

                  {filteredPreview.length === 0 && (
                    <div className="p-4 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] text-center text-xs text-[#52708F] italic">
                      No active casework records in this filter tab.
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#BBD5F0] flex items-center justify-between text-xs text-[#52708F]">
                  <span>Showing top assigned priorities.</span>
                  <Link
                    to="/queue"
                    className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>View All Cases ({cases.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </section>
            </div>

            {/* Right Column (4 cols): Measurements Due & Relevant Alerts */}
            <div className="lg:col-span-4 space-y-6">
              {/* Measurements Due Card */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#BBD5F0] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-sm text-[#17365D]">
                      Measurements Due ({metrics.pendingMeasurements})
                    </h3>
                  </div>
                  <Link
                    to="/measurements"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                  >
                    <span>+ Intake</span>
                  </Link>
                </div>

                <p className="text-[11px] text-[#52708F] leading-relaxed">
                  Children awaiting monthly anthropometric screening (&gt;35 days since last reading).
                </p>

                <div className="space-y-2">
                  {staleChildren.slice(0, 4).map((child) => (
                    <div
                      key={child.id}
                      className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <DataBadge variant="beneficiary">{child.id}</DataBadge>
                          <span className="truncate max-w-[110px]">{child.name}</span>
                        </div>
                        <div className="text-[10px] text-[#52708F] mt-0.5">
                          Last: {child.lastMeasurementDate || 'Never measured'}
                        </div>
                      </div>
                      <Link
                        to={`/measurements?benId=${child.id}`}
                        className="px-2.5 py-1 bg-[#F8FBFF] hover:bg-[#E8F2FC] border border-[#BBD5F0] rounded-md text-[11px] font-semibold text-[#17365D] shadow-2xs"
                      >
                        Measure
                      </Link>
                    </div>
                  ))}

                  {staleChildren.length === 0 && (
                    <div className="p-3 bg-[#F8FBFF] rounded-xl border border-[#BBD5F0] text-center text-xs text-slate-600">
                      ✓ All registered children are up to date with monthly measurements.
                    </div>
                  )}
                </div>
              </section>

              {/* Relevant Alerts & Recommended Next Actions */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#BBD5F0] pb-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-semibold text-sm text-[#17365D]">
                      Alerts & Next Actions
                    </h3>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Poshan 2.0
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {awwFrontlineAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{alert.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${alert.severityColor}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        Target: <span className="font-semibold text-slate-800">{alert.target}</span> · {alert.rule}
                      </div>
                      <div className="p-2 bg-[#F8FBFF] rounded-lg border border-[#BBD5F0] text-[11px] text-[#17365D] leading-relaxed">
                        👉 <strong>Action:</strong> {alert.action}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Field Activity Timeline */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-3.5">
                <h3 className="font-semibold text-sm text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                  Recent Centre Activity
                </h3>
                <div className="space-y-2.5 text-xs">
                  {recentActivity.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 pb-2.5 border-b border-[#BBD5F0] last:border-0">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{act.actionType}</span>
                          <span className="text-[10px] text-slate-400 font-normal font-mono">• {act.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{act.deltaSummary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          ROLE: LS (Lady Supervisor)
          - Sector-level operational summary
          - Cases awaiting supervisor verification
          - Centres requiring attention
          - Overdue follow-ups
         ----------------------------------------------------------------------- */}
      {role === 'LS' && (
        <div className="space-y-6">
          {/* Sector Overview Banner */}
          <div className="p-5 bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-sm text-[#17365D] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Sector 4 Operational Catchment (465 Beneficiaries)</span>
              </div>
              <p className="text-slate-600 mt-1">
                Supervising 3 Anganwadi Centres: <strong>AWC-702</strong> (225), <strong>AWC-703</strong> (134), <strong>AWC-704</strong> (106).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white rounded-full border border-slate-200 text-slate-700 font-semibold font-mono">
                {verifyCount} Verification Spot-Checks Pending
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (8 cols): Cases Awaiting Supervisor Verification & Centres */}
            <div className="lg:col-span-8 space-y-6">
              {/* Cases Awaiting Verification Card */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#BBD5F0] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#17365D] flex items-center gap-2">
                      <span>Cases Awaiting Supervisor Verification ({verifyCount})</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase">
                        Spot-Check Queue
                      </span>
                    </h2>
                    <p className="text-xs text-[#52708F] mt-0.5">
                      Frontline growth anomalies flagged for independent Salter spring scale confirmation.
                    </p>
                  </div>
                  <Link
                    to="/queue"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {cases
                    .filter((c) => c.status === 'Pending Verification' && !c.isVerified)
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.actionId}
                        className="p-4 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <DataBadge variant="beneficiary">{item.id}</DataBadge>
                            <DataBadge variant="centre">{item.centreCode}</DataBadge>
                            <span className="text-xs font-semibold text-slate-800 font-mono">
                              Flagged: {item.flaggedWeight} kg (Prev: {item.prevWeight} kg · Δ {item.weightDelta})
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              {item.ruleCode}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {item.triggerDetail}
                          </p>
                          <div className="text-[11px] text-[#52708F]">
                            Assigned Worker: <span className="font-mono font-semibold text-slate-700">{item.assignedAww}</span> · Due: <span className="font-mono">{item.dueDate}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenVerifyModal(item)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-full text-xs font-semibold shadow-xs transition-transform active:scale-95 shrink-0 inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verify with Scale</span>
                        </button>
                      </div>
                    ))}

                  {cases.filter((c) => c.status === 'Pending Verification' && !c.isVerified).length === 0 && (
                    <div className="p-4 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] text-center text-xs text-[#52708F] italic">
                      ✓ No cases currently awaiting supervisor verification in Sector 4.
                    </div>
                  )}
                </div>
              </section>

              {/* Centres Requiring Attention in Sector 4 */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-semibold text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                  Centres Requiring Attention (Sector 4)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {centreComparisons
                    .filter((c) => ['AWC-702', 'AWC-703', 'AWC-704'].includes(c.code))
                    .map((centre) => (
                      <div
                        key={centre.code}
                        className="p-4 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <DataBadge variant="centre">{centre.code}</DataBadge>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            centre.pendingCases > 5 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {centre.pendingCases} Cases Pending
                          </span>
                        </div>
                        <div className="text-xs text-slate-700">
                          <div>Population: <span className="font-semibold font-mono">{centre.total}</span></div>
                          <div className="mt-0.5">Measurement Compliance: <span className="font-semibold font-mono">{centre.compliance}%</span></div>
                          <div className="mt-0.5 text-[#52708F]">Overdue: {centre.staleCount} children</div>
                        </div>
                        <Link
                          to={`/beneficiaries?centre=${centre.code}`}
                          className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5"
                        >
                          <span>Inspect Centre</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    ))}
                </div>
              </section>
            </div>

            {/* Right Column (4 cols): Overdue Follow-ups & Sector Activity */}
            <div className="lg:col-span-4 space-y-6">
              {/* Overdue Follow-ups */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#BBD5F0] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600" />
                    <h3 className="font-semibold text-sm text-[#17365D]">
                      Overdue Follow-ups
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    SLA Breached
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {allReferrals
                    .filter((r) => r.status !== 'Completed')
                    .slice(0, 4)
                    .map((ref) => (
                      <div
                        key={ref.id}
                        className="p-3 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <DataBadge variant="beneficiary">{ref.beneficiaryId}</DataBadge>
                          <span className="text-[10px] text-rose-700 font-semibold">{ref.status}</span>
                        </div>
                        <p className="text-[11px] text-slate-700 font-medium">{ref.reason}</p>
                        <div className="text-[10px] text-slate-400">
                          Destination: {ref.destination} · Assigned: {ref.owner}
                        </div>
                      </div>
                    ))}

                  {allReferrals.filter((r) => r.status !== 'Completed').length === 0 && (
                    <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] text-center text-xs text-[#52708F] italic">
                      No overdue follow-ups in this sector.
                    </div>
                  )}
                </div>
              </section>

              {/* Sector Activity Summary */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-3.5">
                <h3 className="font-semibold text-sm text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                  Recent Sector Activity
                </h3>
                <div className="space-y-2.5 text-xs">
                  {recentActivity.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 pb-2.5 border-b border-[#BBD5F0] last:border-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{act.actionType}</span>
                          <span className="text-[10px] text-slate-400 font-normal font-mono">• {act.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{act.deltaSummary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          ROLE: CDPO (Child Development Project Officer)
          - Project-wide operational summary
          - Centre-wise performance comparison
          - Pending escalations and referral trends
          - Important operational priorities
         ----------------------------------------------------------------------- */}
      {role === 'CDPO' && (
        <div className="space-y-6">
          {/* Centre-Wise Performance Comparison Table */}
          <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#BBD5F0] gap-2">
              <div>
                <h2 className="text-base font-bold text-[#17365D]">
                  Centre-Wise Operational Performance (5 Anganwadi Centres)
                </h2>
                <p className="text-xs text-[#52708F] mt-0.5">
                  Reconciliation across Sector 4 and Sector 5 catchment areas (Total Enrollment: 600).
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-700 self-start sm:self-auto font-mono">
                Project Central
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#BBD5F0] text-[#52708F] font-medium">
                    <th className="py-2.5 px-3">Centre Code</th>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3 text-right">Beneficiaries</th>
                    <th className="py-2.5 px-3 text-right">Pending Cases</th>
                    <th className="py-2.5 px-3 text-right">Resolved Cases</th>
                    <th className="py-2.5 px-3 text-right">Compliance Rate</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BBD5F0]/60 font-mono">
                  {centreComparisons.map((c) => (
                    <tr key={c.code} className="hover:bg-[#F8FBFF] transition-colors">
                      <td className="py-3 px-3 font-bold text-[#17365D]">
                        <DataBadge variant="centre">{c.code}</DataBadge>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-sans">{c.sector}</td>
                      <td className="py-3 px-3 text-right font-bold text-[#17365D]">{c.total}</td>
                      <td className="py-3 px-3 text-right text-rose-700 font-bold">{c.pendingCases}</td>
                      <td className="py-3 px-3 text-right text-emerald-700">{c.resolvedCases}</td>
                      <td className="py-3 px-3 text-right text-slate-800">{c.compliance}%</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans ${
                          c.pendingCases > 5 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {c.pendingCases > 5 ? 'Needs Support' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (8 cols): Pending Escalations & Clinical Referrals */}
            <div className="lg:col-span-8 space-y-6">
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-semibold text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                  Multi-Tier Escalations & Operational Priorities
                </h3>
                <div className="space-y-3">
                  {cases
                    .filter((c) => c.priority === 'Urgent' || c.tierLevel > 1)
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.actionId}
                        className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <DataBadge variant="beneficiary">{item.id}</DataBadge>
                            <DataBadge variant="centre">{item.centreCode}</DataBadge>
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                              Tier {item.tierLevel} Escalation
                            </span>
                          </div>
                          <p className="text-slate-800 font-medium">{item.concernSummary}</p>
                          <div className="text-[11px] text-[#52708F]">
                            Trigger: {item.triggerDetail}
                          </div>
                        </div>
                        <Link
                          to={`/queue?search=${item.id}`}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 shadow-2xs shrink-0"
                        >
                          Review Case
                        </Link>
                      </div>
                    ))}
                </div>
              </section>

              {/* Clinical Referral Facilities Tracker */}
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-semibold text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                  Clinical Referral Destination Breakdown
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-purple-700 block">District NRC</span>
                    <span className="text-2xl font-bold font-mono">4</span>
                    <p className="text-[11px] text-purple-800">Inpatient therapeutic feeding for SAM cases.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-blue-700 block">Community Health Centre (CHC)</span>
                    <span className="text-2xl font-bold font-mono">2</span>
                    <p className="text-[11px] text-blue-800">Pediatric consultation &amp; medical evaluation.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] text-[#17365D] space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-emerald-700 block">Primary Health Centre (PHC)</span>
                    <span className="text-2xl font-bold font-mono">1</span>
                    <p className="text-[11px] text-emerald-800">Frontline medical officer follow-up.</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column (4 cols): Project Coordination & Audit */}
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-3.5">
                <h3 className="font-semibold text-sm text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                  Project Coordination Hub
                </h3>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                    <span className="font-semibold text-slate-800 block">Monthly Sector Reviews</span>
                    <p className="text-[11px] text-slate-600">Sector 4 and Sector 5 joint monthly verification review completed.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                    <span className="font-semibold text-slate-800 block">Supplementary Nutrition (THR)</span>
                    <p className="text-[11px] text-slate-600">100% quota dispatched across all 5 Anganwadi centres for October 2026.</p>
                  </div>
                </div>
              </section>

              <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-3.5">
                <h3 className="font-semibold text-sm text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                  Recent Project Ledger
                </h3>
                <div className="space-y-2.5 text-xs">
                  {recentActivity.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 pb-2.5 border-b border-[#BBD5F0] last:border-0">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{act.actionType}</span>
                          <span className="text-[10px] text-slate-400 font-normal font-mono">• {act.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{act.deltaSummary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          ROLE: DPO (District Programme Officer)
          - District-level oversight information
          - Centre performance comparisons
          - Screening trends and programme-level statistics
          - Significant escalations and referral trends
          - STRICTLY READ-ONLY: No frontline action buttons, no AWW priority worklist
         ----------------------------------------------------------------------- */}
      {role === 'DPO' && (
        <div className="space-y-6">
          {/* Read-Only Oversight Banner */}
          <div className="p-4 bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] flex items-center justify-between text-xs text-[#17365D]">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span className="font-semibold">District Programme Officer Oversight (Read-Only Mode)</span>
              <span>— Aggregate programme metrics and centre comparisons.</span>
            </div>
            <span className="font-mono text-[#52708F] text-[11px]">District Catchment: 600 Enrolled</span>
          </div>

          {/* Centre Performance Comparisons Matrix (id="centre-performance") */}
          <section id="centre-performance" className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#BBD5F0] gap-2">
              <div>
                <h2 className="text-base font-bold text-[#17365D]">
                  District Centre Performance Comparisons
                </h2>
                <p className="text-xs text-[#52708F] mt-0.5">
                  Comparative performance and verification compliance across all 5 Anganwadi centres.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-800 rounded-full border border-blue-200">
                5 Centres Monitored
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#BBD5F0] text-[#52708F] font-medium">
                    <th className="py-2.5 px-3">Centre</th>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3 text-right">Enrollment</th>
                    <th className="py-2.5 px-3 text-right">SAM/MAM Alerts</th>
                    <th className="py-2.5 px-3 text-right">Spot-Checks Completed</th>
                    <th className="py-2.5 px-3 text-right">Compliance %</th>
                    <th className="py-2.5 px-3 text-center">Supervisory Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BBD5F0]/60 font-mono">
                  {centreComparisons.map((c) => (
                    <tr key={c.code} className="hover:bg-[#F8FBFF] transition-colors">
                      <td className="py-3 px-3 font-bold text-[#17365D]">{c.code}</td>
                      <td className="py-3 px-3 text-slate-600 font-sans">{c.sector}</td>
                      <td className="py-3 px-3 text-right font-bold text-[#17365D]">{c.total}</td>
                      <td className="py-3 px-3 text-right text-rose-700 font-bold">{c.urgentCases}</td>
                      <td className="py-3 px-3 text-right text-emerald-700">{c.resolvedCases}</td>
                      <td className="py-3 px-3 text-right text-slate-800">{c.compliance}%</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans ${
                          c.pendingCases > 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {c.pendingCases > 5 ? 'Moderate Risk' : 'Low Risk'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Screening Trends & Programme Statistics (id="screening-trends", id="beneficiary-statistics") */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Demographic Distribution */}
            <section id="beneficiary-statistics" className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                District Beneficiary Cohort Distribution (600 Total)
              </h3>
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div key={cat.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{cat.label}</span>
                      <span className="font-mono font-bold text-[#17365D]">{cat.count} ({cat.pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Screening Trends & Nutritional Status (id="screening-trends") */}
            <section id="screening-trends" className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-[#17365D] border-b border-[#BBD5F0] pb-2.5">
                Anthropometric Screening & Nutritional Indicators
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#52708F] block">Severe Wasting (SAM)</span>
                  <span className="text-xl font-bold font-mono text-rose-700">4 cases</span>
                  <p className="text-[11px] text-[#52708F]">Referred to District NRC.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#52708F] block">Moderate Wasting (MAM)</span>
                  <span className="text-xl font-bold font-mono text-amber-700">12 cases</span>
                  <p className="text-[11px] text-[#52708F]">Under intensive THR &amp; monitoring.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#52708F] block">Growth Stagnation</span>
                  <span className="text-xl font-bold font-mono text-blue-700">19 cases</span>
                  <p className="text-[11px] text-[#52708F]">Frontline counseling assigned.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#52708F] block">Overall Normal Growth</span>
                  <span className="text-xl font-bold font-mono text-emerald-700">565 (94.2%)</span>
                  <p className="text-[11px] text-[#52708F]">Normal velocity curve.</p>
                </div>
              </div>
            </section>
          </div>

          {/* Significant Escalations & Referral Trends (id="referrals-overview") */}
          <section id="referrals-overview" className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#BBD5F0] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#17365D]">
                  Significant Clinical Escalations & Referral Trends
                </h3>
                <p className="text-xs text-[#52708F] mt-0.5">
                  District hospital and NRC admission status for severe acute cases.
                </p>
              </div>
              <Link
                to="/reports"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>Full Reports</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/80 space-y-1">
                <span className="font-semibold text-purple-900">District NRC Admissions</span>
                <div className="text-2xl font-bold font-mono text-purple-800">4 active</div>
                <p className="text-[11px] text-purple-700">All cases under structured therapeutic feeding protocol.</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                <span className="font-semibold text-blue-900">CHC Clinical Referrals</span>
                <div className="text-2xl font-bold font-mono text-blue-800">2 active</div>
                <p className="text-[11px] text-blue-700">Under pediatric medical officer review.</p>
              </div>
              <div className="p-4 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                <span className="font-semibold text-emerald-900">Completed &amp; Discharged</span>
                <div className="text-2xl font-bold font-mono text-emerald-800">1 verified</div>
                <p className="text-[11px] text-emerald-700">Successfully completed medical rehabilitation.</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          ROLE: System Administrator & Rule Administrator
         ----------------------------------------------------------------------- */}
      {(role === 'System Administrator' || role === 'Rule Administrator') && (
        <div className="space-y-6">
          <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#17365D] border-b border-[#BBD5F0] pb-3">
              {role === 'System Administrator' ? 'System Administration & Organizational Affordances' : 'Screening Rule Engine & Test Bench Console'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <Link
                to="/rules"
                className="p-4 rounded-xl bg-[#F8FBFF] hover:bg-blue-50/60 border border-[#BBD5F0] transition-all space-y-1 group"
              >
                <Sliders className="w-5 h-5 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-[#17365D]">Screening Rule Definitions</div>
                <p className="text-[#52708F]">8 configurable anthropometric heuristic rules (RUL-01 to RUL-08).</p>
              </Link>
              <Link
                to="/reports"
                className="p-4 rounded-xl bg-[#F8FBFF] hover:bg-slate-100 border border-[#BBD5F0] transition-all space-y-1 group"
              >
                <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-[#17365D]">System Audit Trail</div>
                <p className="text-[#52708F]">Immutable ledger logs with cryptographic verification proofs.</p>
              </Link>
              <Link
                to="/profile"
                className="p-4 rounded-xl bg-[#F8FBFF] hover:bg-purple-50/60 border border-[#BBD5F0] transition-all space-y-1 group"
              >
                <Users className="w-5 h-5 text-purple-600 mb-1 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-[#17365D]">Administrative Persona</div>
                <p className="text-[#52708F]">Active role assignment and permission scopes.</p>
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          PUBLIC / UNASSIGNED USER MODE
         ----------------------------------------------------------------------- */}
      {(!role || role === 'User') && (
        <div className="space-y-6">
          {/* 1. Public Overview Context & Aggregate Totals Banner */}
          <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#BBD5F0] gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-[#17365D]">
                    Public Overview — Registered Beneficiary Statistics
                  </h2>
                </div>
                <p className="text-xs text-[#52708F] mt-1">
                  Complete aggregate distribution of all registered beneficiaries across 5 Anganwadi Centres.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-800 rounded-full border border-blue-200 font-mono">
                  Total Enrolled: {metrics.total} Beneficiaries
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200 font-mono">
                  100% Deduplicated
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This public demonstration presents synthetic population health and casework records across 5 Anganwadi centres ({metrics.total} total beneficiaries). All statistics are derived dynamically from the canonical synthetic dataset. Under public privacy governance, individual personal identities, line records, and clinical logs remain strictly restricted.
            </p>

            {/* Quick Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                <span className="text-[10px] font-semibold uppercase text-[#52708F] block">Total Registered</span>
                <div className="text-2xl font-bold font-mono text-[#17365D]">
                  <AnimatedNumber value={metrics.total} />
                </div>
                <span className="text-[11px] text-[#52708F] block">Across 5 Centres</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                <span className="text-[10px] font-semibold uppercase text-[#52708F] block">Children (0–6y)</span>
                <div className="text-2xl font-bold font-mono text-blue-700">
                  <AnimatedNumber value={metrics.totalChildren} />
                </div>
                <span className="text-[11px] text-[#52708F] block">{((metrics.totalChildren / (metrics.total || 1)) * 100).toFixed(1)}% of total</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                <span className="text-[10px] font-semibold uppercase text-[#52708F] block">Adolescent Girls</span>
                <div className="text-2xl font-bold font-mono text-indigo-700">
                  <AnimatedNumber value={metrics.adolescentGirls} />
                </div>
                <span className="text-[11px] text-[#52708F] block">{((metrics.adolescentGirls / (metrics.total || 1)) * 100).toFixed(1)}% of total</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] space-y-1">
                <span className="text-[10px] font-semibold uppercase text-[#52708F] block">Mothers (Preg &amp; Lact)</span>
                <div className="text-2xl font-bold font-mono text-purple-700">
                  <AnimatedNumber value={metrics.totalMothers} />
                </div>
                <span className="text-[11px] text-[#52708F] block">{((metrics.totalMothers / (metrics.total || 1)) * 100).toFixed(1)}% of total</span>
              </div>
            </div>
          </section>

          {/* 2. Beneficiary Type & Category-Wise Distribution */}
          <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#BBD5F0] gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#17365D]">
                  Beneficiary Category Breakdown (All 6 Cohorts)
                </h3>
                <p className="text-xs text-[#52708F] mt-0.5">
                  Proportionate distribution across Poshan 2.0 beneficiary categories.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-700 font-mono self-start sm:self-auto">
                6 Categories · {categories.reduce((acc, c) => acc + c.count, 0)} Total
              </span>
            </div>

            {/* Horizontal Multi-Segment Proportion Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <span>Categorical Cohort Composition</span>
                <span className="font-mono text-[#52708F]">100.0% Distributed</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`${cat.color} transition-all duration-500 hover:opacity-90 relative group`}
                    style={{ width: `${cat.pct}%` }}
                    title={`${cat.label}: ${cat.count} (${cat.pct}%)`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#52708F] pt-1">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                    <span className="font-medium text-slate-700">{cat.label}:</span>
                    <span className="font-mono text-[#17365D] font-bold">{cat.count} ({cat.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6 Category Statistic Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 rounded-2xl bg-[#F8FBFF] border border-[#BBD5F0] hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIllustration
                      type={cat.id}
                      className="w-10 h-10 ring-1 ring-slate-900/5 shadow-xs shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 truncate" title={cat.label}>
                        {cat.label}
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-bold font-mono text-[#17365D] tabular-nums">
                          <AnimatedNumber value={cat.count} />
                        </span>
                        <span className="text-xs text-[#52708F] font-medium ml-1">enrolled</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${cat.color} rounded-full`}
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                      <span>{cat.pct}% of project cohort</span>
                      <span>{cat.count} / {metrics.total}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Centre-Wise Summary (All 5 Centres) */}
          <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#BBD5F0] gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#17365D]">
                  Centre-Wise Beneficiary Distribution (All 5 Centres)
                </h3>
                <p className="text-xs text-[#52708F] mt-0.5">
                  Dynamic enrollment figures across Anganwadi centre catchments in Sector 4 and Sector 5.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-800 rounded-full border border-blue-200 font-mono self-start sm:self-auto">
                5 Centres · Sum: {allCentres.map((c) => mockStore.getMetrics({ role: 'AWW', centreCode: c }).total).reduce((a, b) => a + b, 0)}
              </span>
            </div>

            {/* 5 Centre Statistic Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {allCentres.map((cCode) => {
                const cM = mockStore.getMetrics({ role: 'AWW', centreCode: cCode });
                const sector = ['AWC-702', 'AWC-703', 'AWC-704'].includes(cCode) ? 'Sector-4' : 'Sector-5';
                const pct = ((cM.total / (metrics.total || 1)) * 100).toFixed(1);
                return (
                  <div
                    key={cCode}
                    className="p-4 rounded-xl bg-[#F8FBFF] border border-[#BBD5F0] flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#17365D] font-mono text-sm">{cCode}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                          {sector}
                        </span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#17365D] mt-2">
                        <AnimatedNumber value={cM.total} />
                      </div>
                      <span className="text-[11px] text-[#52708F] block">Beneficiaries</span>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-[#BBD5F0]">
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#52708F] font-mono">
                        <span>Share: {pct}%</span>
                        <span>{cM.totalChildren} ch</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Centre Comparative Summary Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#BBD5F0] text-[#52708F] font-medium">
                    <th className="py-2.5 px-3">Centre Code</th>
                    <th className="py-2.5 px-3">ICDS Sector</th>
                    <th className="py-2.5 px-3 text-right">Children (0–6y)</th>
                    <th className="py-2.5 px-3 text-right">Adolescent Girls</th>
                    <th className="py-2.5 px-3 text-right">Mothers (Preg &amp; Lact)</th>
                    <th className="py-2.5 px-3 text-right font-bold text-[#17365D]">Total Beneficiaries</th>
                    <th className="py-2.5 px-3 text-right">Share of Project</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BBD5F0]/60 font-mono">
                  {allCentres.map((cCode) => {
                    const cM = mockStore.getMetrics({ role: 'AWW', centreCode: cCode });
                    const sector = ['AWC-702', 'AWC-703', 'AWC-704'].includes(cCode) ? 'Sector-4' : 'Sector-5';
                    const pct = ((cM.total / (metrics.total || 1)) * 100).toFixed(1);
                    return (
                      <tr key={cCode} className="hover:bg-[#F8FBFF] transition-colors">
                        <td className="py-3 px-3 font-bold text-[#17365D] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{cCode}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-sans">{sector}</td>
                        <td className="py-3 px-3 text-right text-slate-800">{cM.totalChildren}</td>
                        <td className="py-3 px-3 text-right text-indigo-700">{cM.adolescentGirls}</td>
                        <td className="py-3 px-3 text-right text-purple-700">{cM.pregnantWomen + cM.lactatingMothers}</td>
                        <td className="py-3 px-3 text-right font-bold text-[#17365D] text-sm">{cM.total}</td>
                        <td className="py-3 px-3 text-right font-semibold text-blue-700">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#BBD5F0] font-bold bg-[#F8FBFF] font-mono text-xs">
                    <td className="py-3 px-3 text-[#17365D]" colSpan={2}>
                      Project-Wide Summary Total
                    </td>
                    <td className="py-3 px-3 text-right text-[#17365D]">{metrics.totalChildren}</td>
                    <td className="py-3 px-3 text-right text-indigo-700">{metrics.adolescentGirls}</td>
                    <td className="py-3 px-3 text-right text-purple-700">{metrics.totalMothers}</td>
                    <td className="py-3 px-3 text-right text-[#17365D] text-sm">
                      {allCentres.map((c) => mockStore.getMetrics({ role: 'AWW', centreCode: c }).total).reduce((a, b) => a + b, 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-blue-700">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* 4. Privacy & Demonstration Access Card */}
          <section className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#BBD5F0]">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-[#17365D]">
                Data Privacy Governance & Demonstration Access
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              Public aggregation guarantee: All figures presented above are calculated in real time from canonical synthetic records without storing or transmitting personally identifiable information. Casework intake, individual child growth curves, and physical measurement verification require authenticated staff credentials.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <Link
                to="/signin"
                className="p-4 rounded-xl bg-slate-900 text-white hover:bg-black transition-all space-y-1 group"
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Staff Role Simulation</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-slate-300 text-xs">Switch between AWW, Lady Supervisor, CDPO, and DPO personas.</p>
              </Link>
              <Link
                to="/reports"
                className="p-4 rounded-xl bg-[#F8FBFF] hover:bg-slate-100 border border-[#BBD5F0] transition-all space-y-1 text-[#17365D] group"
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Public Reports &amp; Audit</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[#52708F] text-xs">View aggregate nutritional indicators and verification audit ledger.</p>
              </Link>
              <Link
                to="/dashboard"
                className="p-4 rounded-xl bg-[#F8FBFF] hover:bg-slate-100 border border-[#BBD5F0] transition-all space-y-1 text-[#17365D] group"
              >
                <div className="font-bold flex items-center justify-between">
                  <span>5-Centre Catchment</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[#52708F] text-xs">AWC-702, 703, 704 (Sector 4) and AWC-705, 706 (Sector 5).</p>
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          PHYSICAL VERIFICATION MODAL (Available to LS and authorized supervisors)
         ========================================================================= */}
      <AnimatePresence>
        {selectedCaseToVerify && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="verify-case-modal-title"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[#BBD5F0] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="verify-case-modal-title" className="font-bold text-[#17365D] text-base leading-snug">
                      Calibrated Scale Spot-Check Verification
                    </h3>
                    <p className="text-xs text-[#52708F] mt-0.5">
                      Case {selectedCaseToVerify.actionId} · {selectedCaseToVerify.id} ({selectedCaseToVerify.centreCode})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCaseToVerify(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-semibold">Flagged Anomaly Details:</div>
                <div className="font-mono text-[11px]">
                  Rule: {selectedCaseToVerify.ruleCode} · Flagged Reading: {selectedCaseToVerify.flaggedWeight} kg (Prev: {selectedCaseToVerify.prevWeight} kg)
                </div>
                <p className="text-[11px] text-amber-800">{selectedCaseToVerify.triggerDetail}</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Calibrated Scale Measured Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 10.45"
                    value={verifiedWeightInput}
                    onChange={(e) => setVerifiedWeightInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Measured Height (cm) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 78.5"
                    value={verifiedHeightInput}
                    onChange={(e) => setVerifiedHeightInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Supervisor Verification Findings & Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Confirmed previous scale tare offset. Re-measured with calibrated Salter spring scale. Weight progression normal."
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#BBD5F0]">
                <button
                  type="button"
                  onClick={() => setSelectedCaseToVerify(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVerification}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Resolve Case</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
