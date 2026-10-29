import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DataBadge } from '../components/common/DataBadge';
import { mockStore, POPULATION_METRICS, BeneficiaryCase } from '../store/mockStore';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { GuidedWorkflowSection } from '../components/portal/GuidedWorkflowSection';
import { CategoryIllustration, CategoryType } from '../components/portal/CategoryIllustrations';
import { canPerformAction } from '../utils/permissions';
import { isMockDemoEnabled } from '../utils/demoMode';
import { PreparedDatasetSummaryCard } from '../components/portal/PreparedDatasetSummaryCard';
import { getDashboardUnavailableState } from '../services/dashboardPreview';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isReadOnlyDemo, requireStaffAction, role, staffUser, supabaseSession } = useAuth();
  const mockDemoEnabled = isMockDemoEnabled(import.meta.env);
  const canReadMockDemo = mockDemoEnabled && !supabaseSession;
  const isAggregateOnly = isReadOnlyDemo || role === 'User' || role === 'DPO';
  const canVerifyCases = canPerformAction(role, 're_measure');
  const canRecordMeasurements = canPerformAction(role, 'record_measurement');
  const canRegisterBeneficiaries = role === 'AWW';
  const canViewQueue = role === 'AWW' || role === 'LS' || role === 'CDPO';
  const canViewRules = role === 'LS' || role === 'CDPO' || role === 'Rule Administrator';
  const canViewReports = role === 'LS' || role === 'CDPO' || role === 'DPO';

  const [activeQueueTab, setActiveQueueTab] = useState<'all' | 'urgent' | 'verification' | 'referrals'>('all');
  const [cases, setCases] = useState<BeneficiaryCase[]>([]);
  const [selectedCaseToVerify, setSelectedCaseToVerify] = useState<BeneficiaryCase | null>(null);
  const [verifiedWeightInput, setVerifiedWeightInput] = useState('');
  const [verifiedHeightInput, setVerifiedHeightInput] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');

  useEffect(() => {
    if (!canReadMockDemo) {
      setCases([]);
      return undefined;
    }
    const fetch = () => {
      setCases(mockStore.getCases({ role, centreCode: staffUser?.centreCode }));
    };
    fetch();
    const unsubscribe = mockStore.subscribe(fetch);
    return unsubscribe;
  }, [role, staffUser, canReadMockDemo]);

  const handleOpenVerifyModal = (item: BeneficiaryCase) => {
    if (!canVerifyCases) return;
    setSelectedCaseToVerify(item);
    setVerifiedWeightInput('');
    setVerifiedHeightInput('');
    setVerificationNotes('');
  };

  const handleConfirmVerification = () => {
    if (!selectedCaseToVerify) return;
    if (!canVerifyCases) {
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

  if (!canReadMockDemo) {
    const apiConfigured = Boolean(import.meta.env.VITE_B2_API_URL?.trim());
    const preview = getDashboardUnavailableState({
      apiConfigured,
      providerSessionActive: Boolean(supabaseSession),
    });

    return (
      <div className="space-y-6 pb-8">
        <PreparedDatasetSummaryCard />
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-labelledby="dashboard-unavailable-title">
          <div className="bg-gradient-to-br from-[#0E1B2B] via-[#173A55] to-[#1F8A83] px-6 py-8 text-white sm:px-9 sm:py-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-white">
              <Eye className="h-3.5 w-3.5" /> OVERVIEW DASHBOARD · PREVIEW
            </div>
            <h1 id="dashboard-unavailable-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Overview Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
              A preview of the dashboard experience. This deployment has no verified operational metrics to display.
            </p>
          </div>

          <div className="grid gap-0 lg:grid-cols-2">
            <section className="border-b border-slate-200 p-6 sm:p-8 lg:border-b-0 lg:border-r" aria-labelledby="dashboard-integration-title" aria-live="polite">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-900">
                <Clock className="h-3.5 w-3.5" /> {preview.statusLabel}
              </div>
              <h2 id="dashboard-integration-title" className="mt-4 text-xl font-semibold text-slate-900">Connect trusted dashboard data</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{preview.message}</p>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Still required</div>
                <p className="mt-1 text-sm font-medium text-slate-800">{preview.missingIntegration}</p>
              </div>
              <Link to="/signin" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0E1B2B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#173A55] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83] focus-visible:ring-offset-2">
                Staff Sign-in <ChevronRight className="h-4 w-4" />
              </Link>
            </section>

            <section className="p-6 sm:p-8" aria-labelledby="dashboard-capabilities-title">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-800">
                <Sparkles className="h-3.5 w-3.5" /> AFTER TRUSTED INTEGRATION
              </div>
              <h2 id="dashboard-capabilities-title" className="mt-4 text-xl font-semibold text-slate-900">What this dashboard is designed to show</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">After approved backend data sources, identity, role, and scope checks are in place, this view can present:</p>
              <ul className="mt-5 space-y-3">
                {[
                  'Beneficiary and measurement summaries from approved backend records',
                  'Centre-scoped task and referral activity',
                  'Data source and freshness details returned by the backend',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1F8A83]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs leading-relaxed text-slate-600 sm:px-8" role="note">
            No operational counts, beneficiary records, or clinical values are shown here. The prepared synthetic dataset card above remains a separate API-backed aggregate and reports its own connection state.
          </div>
        </section>
      </div>
    );
  }

  const metrics = mockStore.getMetrics({ role, centreCode: staffUser?.centreCode });
  const totalPop = Math.max(1, metrics.total);

  const categories: {
    id: CategoryType;
    label: string;
    count: number;
    pct: number;
    color: string;
  }[] = [
    { id: 'pregnant', label: 'Pregnant Women', count: metrics.pregnantWomen, pct: Number(((metrics.pregnantWomen / totalPop) * 100).toFixed(1)), color: 'bg-rose-500' },
    { id: 'lactating', label: 'Lactating Mothers', count: metrics.lactatingMothers, pct: Number(((metrics.lactatingMothers / totalPop) * 100).toFixed(1)), color: 'bg-purple-500' },
    { id: 'children0to6m', label: 'Children (0–6 months)', count: metrics.children0to6m, pct: Number(((metrics.children0to6m / totalPop) * 100).toFixed(1)), color: 'bg-sky-500' },
    { id: 'children6mTo3y', label: 'Children (6 months–3 years)', count: metrics.children6mTo3y, pct: Number(((metrics.children6mTo3y / totalPop) * 100).toFixed(1)), color: 'bg-blue-600' },
    { id: 'children3to6y', label: 'Children (3–6 years)', count: metrics.children3to6y, pct: Number(((metrics.children3to6y / totalPop) * 100).toFixed(1)), color: 'bg-amber-500' },
    { id: 'adolescent', label: 'Adolescent Girls', count: metrics.adolescentGirls, pct: Number(((metrics.adolescentGirls / totalPop) * 100).toFixed(1)), color: 'bg-emerald-500' },
  ];

  const urgentCount = cases.filter((c) => c.priority === 'Urgent' && !c.isVerified).length;
  const verifyCount = cases.filter((c) => (c.category === 'urgent' || c.category === 'drift') && !c.isVerified).length;
  const referralCount = cases.filter((c) => c.category === 'sam' && !c.isVerified).length;

  const filteredPreview = cases
    .filter((item) => {
      if (activeQueueTab === 'urgent') return item.priority === 'Urgent';
      if (activeQueueTab === 'verification') return item.category === 'urgent' || item.category === 'drift';
      if (activeQueueTab === 'referrals') return item.category === 'sam';
      return true;
    })
    .slice(0, 4);

  if (role === 'System Administrator' || role === 'Rule Administrator') {
    return (
      <div className="space-y-6">
        <PreparedDatasetSummaryCard />
        <section className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm" aria-labelledby="role-dashboard-title">
          <div className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Demo scope: administration only</div>
          <h1 id="role-dashboard-title" className="mt-4 text-2xl font-semibold text-slate-900">No administrative workflow is available yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Account administration is unavailable. Rule changes cannot be submitted; approval remains disabled. Case and beneficiary records are not shown for this role.</p>
          {role === 'Rule Administrator' && <Link to="/rules" className="mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">View rule settings</Link>}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PreparedDatasetSummaryCard />
      {/* Screen Title & Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-xs font-semibold text-[#2457F5] mb-2 shadow-xs">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-slate-600 font-normal">Varanasi District • AWC #702 (Sector Aggregates)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Supervisor Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-normal leading-relaxed">
            {isAggregateOnly
              ? 'Public aggregate overview of nutrition monitoring, data-quality screening anomalies, and casework triage.'
              : 'Browser-local synthetic casework for nutrition records, measurement flags, and referrals. No backend connection is active.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {import.meta.env.DEV && <Link to="/synthetic-operations" className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-full">B2 backend briefing and workflows</Link>}
          {isAggregateOnly ? (
            <>
              <span className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-full flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#2457F5]" />
                <span>Beneficiary aggregate: {metrics.total}</span>
              </span>
              {role === 'DPO' && <Link
                to="/reports"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
              >
                <FileBarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>District Reports</span>
              </Link>}
              {isMockDemoEnabled(import.meta.env) ? <Link
                to="/signin"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] active:scale-95"
              >
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Staff Sign In</span>
              </Link> : <span className="px-3.5 py-2 text-xs text-slate-500">Sign-in is not configured</span>}
            </>
          ) : (
            <>
              {canRecordMeasurements && <Link
                to="/measurements"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
                title="Record new measurement"
              >
                <Scale className="w-3.5 h-3.5 text-[#2457F5]" />
                <span>+ Measure</span>
              </Link>}
              {canRegisterBeneficiaries && <Link
                to="/beneficiaries/register"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] active:scale-95"
                title="Register new beneficiary"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Register</span>
              </Link>}
              {canViewQueue && <Link
                to="/queue"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5"
              >
                <ListTodo className="w-3.5 h-3.5 text-[#2457F5]" />
                <span>Action Queue ({metrics.pendingCases})</span>
              </Link>}
            </>
          )}
        </div>
      </motion.div>

      {/* 4 Staggered KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Beneficiaries',
            value: metrics.total,
            subtext: metrics.subtext,
            icon: Users,
            badgeColor: 'bg-blue-100 text-blue-800',
          },
          {
            label: 'Active Casework Queue',
            value: metrics.pendingCases,
            suffix: ' cases',
            subtext: `${metrics.urgentCases} Urgent • ${metrics.attentionCases} Needs Attention • ${metrics.openReferrals} Referrals`,
            icon: AlertTriangle,
            badgeColor: 'bg-rose-100 text-rose-800',
          },
          {
            label: 'Resolved Spot-Checks',
            value: metrics.resolvedCases,
            suffix: ' verified',
            subtext: 'Calibrated scale confirmations',
            icon: CheckCircle2,
            badgeColor: 'bg-emerald-100 text-emerald-800',
          },
          {
            label: 'Overdue / Stale Monitoring',
            value: metrics.staleCount,
            suffix: ' children',
            subtext: 'No recorded measurement in >35 days',
            icon: Clock,
            badgeColor: 'bg-amber-100 text-amber-800',
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
                  <AnimatedNumber value={card.value} />
                  {card.suffix && <span className="text-xs font-normal text-slate-500">{card.suffix}</span>}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                  {card.subtext}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Population Category Progress Meters (Adding up to 248) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              Beneficiary Category Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active centre demographic distribution across the six official ICDS programme categories.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-700 self-start sm:self-auto tabular-nums">
            ● Centre Total: {metrics.total} Beneficiaries
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-5">
          {categories.map((cat, i) => (
            <div
              key={cat.label}
              className="group p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <CategoryIllustration
                  type={cat.id}
                  className="w-11 h-11 ring-1 ring-slate-900/5 shadow-xs shrink-0 group-hover:scale-105 transition-transform duration-200"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate" title={cat.label}>
                      {cat.label}
                    </span>
                    <span className="font-mono text-slate-900 font-bold tabular-nums text-sm ml-2">
                      {cat.count}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${cat.color} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${cat.pct}%` }}
                  transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
                <span>{cat.pct}%</span>
                <span>of cohort</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[11px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">
          ℹ️ Note: All 6 programme categories sum to the {metrics.total} beneficiaries monitored in the active centre cohort ({metrics.subtext}).
        </p>
      </motion.div>

      {/* Guided Workflow Experience (Unobtrusive closed-loop casework walkthrough) */}
      <GuidedWorkflowSection />

      {/* Main Grid: Public Aggregate Casework Overview OR Authenticated Staff Priority Queue */}
      {isAggregateOnly ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Public Left Column: Operational Casework & Follow-up Aggregates (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    Casework Status & Operational Triage (Aggregates)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Centre-wide distribution of active follow-ups, supervisory verifications, and clinical escalations
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-3 py-1 bg-blue-50 text-[#2457F5] rounded-full border border-blue-200/80 self-start sm:self-auto">
                  {metrics.pendingCases} Active Sector Cases
                </span>
              </div>

              {/* 4 Status Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-900">Urgent Casework Triage</span>
                    <span className="text-lg font-bold text-rose-700 font-mono">{urgentCount}</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    High-velocity growth anomalies &amp; acute screening alerts awaiting frontline review.
                  </p>
                  <div className="text-[10px] text-rose-600 font-medium pt-1">
                    Turnaround Target: &lt; 48 hours
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-900">Physical Verification Required</span>
                    <span className="text-lg font-bold text-amber-700 font-mono">{verifyCount}</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Probable scale tare drift or digit typos requiring calibrated Salter spring scale spot-check.
                  </p>
                  <div className="text-[10px] text-amber-600 font-medium pt-1">
                    SLA: 5 working days
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-900">Clinical Referrals (NRC / PHC)</span>
                    <span className="text-lg font-bold text-purple-700 font-mono">{referralCount}</span>
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Severe acute malnutrition (SAM / MAM) coordinated with Medical Officer and Nutrition Rehabilitation Centre.
                  </p>
                  <div className="text-[10px] text-purple-600 font-medium pt-1">
                    Multi-agency medical supervision
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900">Verified &amp; Resolved</span>
                    <span className="text-lg font-bold text-emerald-700 font-mono">{metrics.resolvedCases}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Physical verifications confirmed with calibrated scales and logged in immutable sector ledger.
                  </p>
                  <div className="text-[10px] text-emerald-600 font-medium pt-1">
                    94.7% monthly coverage
                  </div>
                </div>
              </div>

              {/* Anomaly Trigger Summary Table */}
              <div className="pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Screening Anomaly Rules Distribution
                </h4>
                <div className="space-y-2 text-xs">
                  {[
                    { code: 'RUL-01', name: 'Rapid Growth Velocity Outlier (>2.0 kg/mo)', count: 11, category: 'Data Quality Check', share: '31%' },
                    { code: 'RUL-02', name: 'Negative Height / Length Step (< -0.5 cm)', count: 4, category: 'Equipment Check', share: '11%' },
                    { code: 'RUL-03', name: 'Spring Scale Tare & Terminal Digit Drift', count: 10, category: 'Calibration Check', share: '29%' },
                    { code: 'RUL-04', name: 'Growth Stagnation & Stale Weigh-in (>35d)', count: 7, category: 'Monitoring Recall', share: '20%' },
                    { code: 'CLIN-01', name: 'MUAC Tape (<11.5cm) / Severe Malnutrition', count: 3, category: 'Clinical Referral', share: '9%' },
                  ].map((rule) => (
                    <div
                      key={rule.code}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {rule.code}
                        </span>
                        <span className="font-medium text-slate-800">{rule.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400 font-normal">{rule.category}</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">{rule.count} cases</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Privacy Notice Banner */}
              <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/70 text-xs text-slate-700 flex items-start gap-2.5 leading-relaxed">
                <Shield className="w-4 h-4 text-[#2457F5] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-semibold">Demo Mode — Data Privacy Governance:</strong>{' '}
                  Individual child names, beneficiary IDs, photographs, individual measurements, and longitudinal timelines are protected under frontline privacy governance. In public demo mode, all displays are limited to sector aggregates. Chart clicks and summaries do not expose individual records.
                </div>
              </div>
            </div>

            {/* Public Quick Exploration Links */}
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-3">
                Explore Demo Sections
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <Users className="w-4 h-4 text-[#2457F5] mb-2" />
                  <div className="text-xs font-semibold text-[#0F172A]">Beneficiary Cohorts</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Aggregate demographic breakdowns above</div>
                </div>

                {role === 'DPO' && <Link
                  to="/reports"
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/70 transition-all text-left group"
                >
                  <FileBarChart2 className="w-4 h-4 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-semibold text-[#0F172A]">Sector Reports</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Aggregated audit &amp; reconciliation reports</div>
                </Link>}

                {isMockDemoEnabled(import.meta.env) ? <Link
                  to="/signin"
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/70 transition-all text-left group"
                >
                  <Lock className="w-4 h-4 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-semibold text-[#0F172A]">Staff Authentication</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Sign in for casework management</div>
                </Link> : <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-500">Staff sign-in is not configured.</div>}
              </div>
            </div>
          </div>

          {/* Public Right Column: AI Screening Overview & Aggregated Activity (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* AI Screening Overview Card */}
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2457F5]" />
                  <h3 className="font-semibold text-sm text-[#0F172A]">
                    Rule-Based Demo Screening
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Sample Content · Demo Rules
                </span>
              </div>

              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed">
                ℹ️ Suggested flags — human review required. No automated diagnosis or clinical alterations.
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Sample overview content with illustrative counts from deterministic demo rules. Live AI assistance is not connected yet.</p>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A]">Potential data-quality concerns</div>
                    <div className="text-[10px] text-slate-400">Growth velocity outliers</div>
                  </div>
                  <span className="text-base font-bold text-slate-800 font-mono">11</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A]">Missing / stale measurements</div>
                    <div className="text-[10px] text-slate-400">No weigh-in in &gt; 35 days</div>
                  </div>
                  <span className="text-base font-bold text-slate-800 font-mono">7</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A]">Unusual measurement changes</div>
                    <div className="text-[10px] text-slate-400">Weight drop or height step</div>
                  </div>
                  <span className="text-base font-bold text-slate-800 font-mono">4</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                System flags discrepancies for field validation. Frontline workers and supervisors make all final clinical decisions.
              </p>
            </div>

            {/* Aggregated Field Activity Feed (No individual names/IDs) */}
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-[#0F172A]">
                  Sector Activity Summary
                </h3>
                <span className="text-[10px] text-slate-400">Updated today</span>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    title: 'Calibrated Scale Spot-Check Logged',
                    time: '25 mins ago',
                    desc: 'Physical verification logged with calibrated spring scale; velocity anomaly confirmed resolved.',
                    dot: 'bg-emerald-500',
                  },
                  {
                    title: 'Frontline Follow-up Assigned',
                    time: '2 hours ago',
                    desc: 'Infant home visit assigned for 6-month weaning assessment and growth tracking.',
                    dot: 'bg-blue-500',
                  },
                  {
                    title: 'Clinical Referral Coordinated',
                    time: '4 hours ago',
                    desc: 'Severe malnutrition case escalated to District NRC with supplementary nutrition plan.',
                    dot: 'bg-purple-500',
                  },
                  {
                    title: 'Spring Scale Calibration Completed',
                    time: 'Yesterday',
                    desc: 'Zero-tare adherence certified across 6 sector Anganwadi centres with 5 kg standard weight.',
                    dot: 'bg-amber-500',
                  },
                ].map((act, i) => (
                  <div key={i} className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100 last:border-0">
                    <span className={`w-2 h-2 rounded-full ${act.dot} shrink-0 mt-1.5`} />
                    <div>
                      <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <span>{act.title}</span>
                        <span className="text-[10px] text-slate-400 font-normal">• {act.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{act.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Authenticated Staff Mode: Full Priority Action Queue & Operations */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Priority Action Queue Preview (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    Priority Action Queue
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Frontline follow-ups ordered by urgency and operational service agreements
                  </p>
                </div>

                {/* Sliding Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/60 overflow-x-auto">
                  {[
                    { id: 'all', label: `All (${cases.length})` },
                    { id: 'urgent', label: `Urgent (${urgentCount})` },
                    { id: 'verification', label: `Needs Verification (${verifyCount})` },
                    { id: 'referrals', label: `Pending Referrals (${referralCount})` },
                  ].map((tab) => {
                    const isActive = activeQueueTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveQueueTab(tab.id as any)}
                        className={`relative px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap z-10 tabular-nums ${
                          isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="dashboardQueuePill"
                            className="absolute inset-0 bg-[#0F172A] rounded-full -z-10 shadow-sm"
                            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          />
                        )}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Queue Items */}
              <div className="space-y-3 pt-2">
                <AnimatePresence mode="popLayout">
                  {filteredPreview.map((item, idx) => (
                    <motion.div
                      key={item.actionId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25, delay: idx * 0.05 }}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <DataBadge variant="beneficiary" className="font-mono tabular-nums">{item.id}</DataBadge>
                          <Link
                            to={`/beneficiaries/${item.id}`}
                            className="text-xs font-bold text-[#0F172A] hover:text-[#2457F5] transition-colors font-mono"
                          >
                            {item.id} ({item.ageMonths}m • {item.gender})
                          </Link>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${item.priorityColor}`}>
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed">
                          {item.concernSummary}
                        </p>
                        <div className="text-[11px] text-slate-400">
                          Assigned to: <DataBadge variant="worker" className="font-mono">{item.assignedAww}</DataBadge> • Due: <DataBadge variant="date" className="font-mono">{item.dueDate}</DataBadge>
                        </div>
                      </div>

                      {canVerifyCases && <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenVerifyModal(item)}
                          className="px-3.5 py-1.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95 inline-flex items-center gap-1"
                        >
                          {item.isVerified ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Verified</span>
                            </>
                          ) : (
                            <span>Verify Now</span>
                          )}
                        </button>
                      </div>}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="leading-relaxed">Showing prioritized synthetic cases. Academic simulation.</span>
                <Link
                  to="/queue"
                  className="font-semibold text-[#2457F5] hover:text-blue-700 flex items-center gap-1"
                >
                  <span>View Full Queue ({cases.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-3">
                Frontline Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {canRegisterBeneficiaries && <Link
                  to="/beneficiaries/register"
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/70 transition-all text-left group"
                >
                  <UserPlus className="w-4 h-4 text-[#2457F5] mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-semibold text-[#0F172A]">Register Beneficiary</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">New intake record</div>
                </Link>}

                {canViewQueue && <Link
                  to="/queue"
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-rose-50/60 border border-slate-200/70 transition-all text-left group"
                >
                  <ListTodo className="w-4 h-4 text-rose-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-semibold text-[#0F172A]">Open Action Queue</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{metrics.pendingCases} active cases</div>
                </Link>}

                {canViewRules && <Link
                  to="/rules"
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200/70 transition-all text-left group"
                >
                  <Sparkles className="w-4 h-4 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-semibold text-[#0F172A]">Review Data Quality</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Active anomaly checks</div>
                </Link>}

                {canViewReports && <Link
                  to="/reports"
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/70 transition-all text-left group"
                >
                  <FileBarChart2 className="w-4 h-4 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-semibold text-[#0F172A]">Reports &amp; Trends</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Monthly reconciliation</div>
                </Link>}
              </div>
            </div>
          </div>

          {/* Right Column: AI Screening Overview & Activity Feed (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* AI Screening Overview Card */}
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2457F5]" />
                  <h3 className="font-semibold text-sm text-[#0F172A]">
                    Rule-Based Demo Screening
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Sample Content · Demo Rules
                </span>
              </div>

              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed">
                ℹ️ Suggested flags — human review required. No automated diagnosis or clinical alterations.
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Sample overview content with illustrative counts from deterministic demo rules. Live AI assistance is not connected yet.</p>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A]">Potential data-quality concerns</div>
                    <div className="text-[10px] text-slate-400">Growth velocity outliers</div>
                  </div>
                  <span className="text-base font-bold text-slate-800">11</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A]">Missing / stale measurements</div>
                    <div className="text-[10px] text-slate-400">No weigh-in in &gt; 35 days</div>
                  </div>
                  <span className="text-base font-bold text-slate-800">7</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A]">Unusual measurement changes</div>
                    <div className="text-[10px] text-slate-400">Weight drop or height step</div>
                  </div>
                  <span className="text-base font-bold text-slate-800">4</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                System flags discrepancies for field validation. Frontline workers and supervisors make all final clinical decisions.
              </p>
            </div>

            {/* Staff Activity Feed with individual IDs */}
            <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-[#0F172A]">
                  Recent Field Activity
                </h3>
                <span className="text-[10px] text-slate-400">Updated today</span>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    title: 'Measurement Flagged for Verification',
                    time: '25 mins ago',
                    desc: 'Beneficiary BEN-0142 flagged for rapid velocity anomaly (+3.8 kg).',
                    dot: 'bg-rose-500',
                  },
                  {
                    title: 'Follow-up Assigned',
                    time: '2 hours ago',
                    desc: 'Routine home visit assigned to AWW-409 for 6-month weaning check.',
                    dot: 'bg-blue-500',
                  },
                  {
                    title: 'Referral Outcome Updated',
                    time: '4 hours ago',
                    desc: 'NRC follow-up logged by CDPO Sector 4; supplementary nutrition adjusted.',
                    dot: 'bg-purple-500',
                  },
                  {
                    title: 'Beneficiary Intake Completed',
                    time: 'Yesterday',
                    desc: 'New lactating mother profile registered under synthetic sandbox cohort.',
                    dot: 'bg-emerald-500',
                  },
                ].map((act, i) => (
                  <div key={i} className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100 last:border-0">
                    <span className={`w-2 h-2 rounded-full ${act.dot} shrink-0 mt-1.5`} />
                    <div>
                      <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <span>{act.title}</span>
                        <span className="text-[10px] text-slate-400 font-normal">• {act.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{act.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal / Drawer */}
      <AnimatePresence>
        {selectedCaseToVerify && canVerifyCases && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCaseToVerify(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white rounded-[28px] p-6 max-w-lg w-full shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#2457F5]" />
                  <h3 className="font-semibold text-base text-[#0F172A]">
                    Supervisory Verification Spot-Check
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCaseToVerify(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-[#0F172A] font-mono">
                  Beneficiary {selectedCaseToVerify.id} ({selectedCaseToVerify.gender})
                </div>
                <div className="text-slate-500">
                  Trigger: <span className="font-medium text-rose-700">{selectedCaseToVerify.concernSummary}</span>
                </div>
              </div>

              {isAggregateOnly && (
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Public Read-Only Demo</span>: Physical verification countersigning and casework mutations require frontline staff credentials. You can inspect values, triggers, and calibration checklists in read-only mode.
                  </div>
                </div>
              )}

              {(canVerifyCases || isAggregateOnly) ? <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Verified Physical Weight (kg)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      required
                      step="0.05"
                      disabled={isAggregateOnly}
                      value={verifiedWeightInput}
                      onChange={(e) => setVerifiedWeightInput(e.target.value)}
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A] font-semibold ${
                        isAggregateOnly ? 'cursor-not-allowed opacity-80' : ''
                      }`}
                    />
                    <Scale className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Verified Height (cm)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      required
                      step="0.1"
                      disabled={isAggregateOnly}
                      value={verifiedHeightInput}
                      onChange={(e) => setVerifiedHeightInput(e.target.value)}
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A] font-semibold ${
                        isAggregateOnly ? 'cursor-not-allowed opacity-80' : ''
                      }`}
                    />
                    <Ruler className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 font-medium mb-1">
                  Supervisor Notes & Justification
                </label>
                <textarea
                  rows={2}
                  placeholder="Record observations after verification (optional)"
                  disabled={isAggregateOnly}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  className={`w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[#0F172A] ${
                    isAggregateOnly ? 'cursor-not-allowed opacity-80' : ''
                  }`}
                />
              </div>
              </> : (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  View-only access: this role can inspect case details but cannot complete physical verification.
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Safety Guarantee: Original readings are never deleted. Physical verification is recorded as an independent supervisory audit event.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedCaseToVerify(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-full"
                >
                  {isAggregateOnly ? 'Close Inspection' : 'Cancel'}
                </button>
                {isAggregateOnly ? (
                  <Link
                    to="/signin"
                    onClick={() => setSelectedCaseToVerify(null)}
                    className="px-5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full flex items-center gap-1.5 shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Staff Sign In to Confirm</span>
                  </Link>
                ) : canVerifyCases ? (
                  <button
                    type="button"
                    onClick={handleConfirmVerification}
                    className="px-5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Physical Verification</span>
                  </button>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
