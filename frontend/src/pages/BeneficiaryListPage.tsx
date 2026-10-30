import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Building2,
  Search,
  Filter,
  UserPlus,
  Scale,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowRight,
  Baby,
  Heart,
  Activity,
  Lock,
} from 'lucide-react';
import { mockStore, BeneficiaryRecord } from '../store/mockStore.ts';
import { calculateAge, DemographicCohort } from '../utils/casework.ts';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DataBadge } from '../components/common/DataBadge';
import { useAuth } from '../context/AuthContext';
import { ROLE_CONFIGS } from '../utils/permissions';
import { isMockDemoEnabled } from '../utils/demoMode';
import { filterBeneficiaries, paginateBeneficiaries } from '../utils/beneficiaryDirectory';

interface BeneficiaryListPageProps {
  initialView?: 'beneficiaries' | 'centres';
}

const MockBeneficiaryListPage: React.FC<BeneficiaryListPageProps> = ({ initialView }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReadOnlyDemo, role, staffUser } = useAuth();
  const [activeView, setActiveView] = useState<'beneficiaries' | 'centres'>(() => {
    if (initialView === 'centres') return 'centres';
    if (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('view') === 'centres' || window.location.pathname === '/centres')) return 'centres';
    return 'beneficiaries';
  });

  useEffect(() => {
    if (initialView === 'centres' || location.pathname === '/centres' || new URLSearchParams(location.search).get('view') === 'centres') {
      setActiveView('centres');
    }
  }, [initialView, location.pathname, location.search]);
  const demoScope = {
    role,
    centreCode: staffUser?.centreCode,
    sectorCode: staffUser?.sectorCode,
    projectCode: staffUser?.projectCode,
    actorId: staffUser?.id,
  };

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonitoring, setSelectedMonitoring] = useState<'all' | 'flagged' | 'stale'>('all');
  const [selectedCentre, setSelectedCentre] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchBens = () => {
      setBeneficiaries(mockStore.getBeneficiaries(demoScope));
    };
    fetchBens();
    const unsubscribe = mockStore.subscribe(fetchBens);
    return unsubscribe;
  }, [role, staffUser]);

  const baseFiltered = filterBeneficiaries(beneficiaries, {
    search: searchQuery,
    cohort: selectedCohort,
    status: selectedStatus,
    monitoring: selectedMonitoring,
  });

  const filteredList = selectedCentre === 'all'
    ? baseFiltered
    : baseFiltered.filter((b) => b.centreCode === selectedCentre);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedBeneficiaries = paginateBeneficiaries(filteredList, currentPage, itemsPerPage);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCohort('all');
    setSelectedStatus('all');
    setSelectedMonitoring('all');
    setSelectedCentre('all');
    setCurrentPage(1);
  };

  const availableCentres = Array.from(new Set(beneficiaries.map((b) => b.centreCode))).sort();

  const metrics = mockStore.getMetrics(demoScope);
  const cohortSummaries = mockStore.getCohortSummaries(demoScope);
  const cohortRows = [
    { id: 'children0to6m', title: 'Infants (0–6 Months)', code: 'ICDS-INF-06', protocol: 'Recumbent Length (Infantometer) • Calibrated Spring Scale', color: 'bg-sky-50 text-sky-800 border-sky-200' },
    { id: 'children6mTo3y', title: 'Toddlers (6 Months – 3 Years)', code: 'ICDS-TOD-36', protocol: 'Recumbent (<24m) or Standing (>24m) • MUAC Screening', color: 'bg-blue-50 text-blue-800 border-blue-200' },
    { id: 'children3to6y', title: 'Preschool Children (3–6 Years)', code: 'ICDS-PRE-72', protocol: 'Standing Height (Stadiometer) • Growth Monitoring Chart', color: 'bg-amber-50 text-amber-800 border-amber-200' },
    { id: 'adolescentGirls', title: 'Adolescent Girls (10–19 Years)', code: 'ICDS-ADO-1019', protocol: 'Adolescent Nutrition Counselling • Health and Wellbeing Follow-up', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { id: 'pregnant', title: 'Pregnant Women', code: 'ICDS-MAT-PW', protocol: 'ANC Weight Velocity • Iron-Folic Acid Tracking', color: 'bg-rose-50 text-rose-800 border-rose-200' },
    { id: 'lactating', title: 'Lactating Mothers', code: 'ICDS-MAT-LM', protocol: 'Postnatal Nutrition Support • Exclusive Breastfeeding Tracking', color: 'bg-purple-50 text-purple-800 border-purple-200' },
  ].map((row) => {
    const summary = cohortSummaries.find((item) => item.id === row.id);
    const status = summary
      ? [summary.active && `${summary.active} Active`, summary.underMonitoring && `${summary.underMonitoring} Under Monitoring`, summary.referred && `${summary.referred} Referred`]
        .filter(Boolean).join(' • ') || 'No current records'
      : 'No current records';
    return {
      ...row,
      count: summary?.count || 0,
      females: summary?.females || 0,
      males: summary?.males || 0,
      share: `${(((summary?.count || 0) / Math.max(1, metrics.total)) * 100).toFixed(1)}%`,
      status,
      flags: `${summary?.caseCount || 0} cases • ${summary?.stale || 0} stale >35d • ${summary?.openReferralCount || 0} open referrals`,
    };
  });

  const allCentresList = ['AWC-702', 'AWC-703', 'AWC-704', 'AWC-705', 'AWC-706'];
  const centreDetails = allCentresList.map((cCode) => {
    const cMetrics = mockStore.getMetrics({ role: 'CDPO', centreCode: cCode });
    const cCases = mockStore.getCases({ role: 'CDPO', centreCode: cCode });
    const pending = cCases.filter((c) => !c.isVerified).length;
    const resolved = cCases.filter((c) => c.isVerified).length;
    const sector = ['AWC-702', 'AWC-703', 'AWC-704'].includes(cCode) ? 'Sector-4' : 'Sector-5';
    const workers = cCode === 'AWC-702' ? ['AWW-409', 'AWW-412']
      : cCode === 'AWC-703' ? ['AWW-405']
      : cCode === 'AWC-704' ? ['AWW-410']
      : cCode === 'AWC-705' ? ['AWW-417']
      : ['AWW-421'];
    const compliance = cMetrics.total > 0 ? Math.round(((cMetrics.total - cMetrics.pendingMeasurements) / cMetrics.total) * 100) : 100;
    return {
      code: cCode,
      sector,
      total: cMetrics.total,
      children: cMetrics.totalChildren,
      mothers: cMetrics.totalMothers,
      pendingCases: pending,
      resolvedCases: resolved,
      urgentCases: cMetrics.urgentCases,
      openReferrals: cMetrics.openReferrals,
      compliance,
      staleCount: cMetrics.staleCount,
      workers,
    };
  });
  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions */}
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
            <span className="text-slate-800 font-semibold">
              {isReadOnlyDemo ? 'Beneficiary Demographic Breakdown' : 'Beneficiary Management Directory'}
            </span>
          </nav>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700">
              {role === 'AWW'
                ? `Assigned Centre: ${staffUser?.centreCode || 'AWC-702'}`
                : isReadOnlyDemo
                ? 'Public Overview'
                : ROLE_CONFIGS[role || 'User'].label}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
            {isReadOnlyDemo ? 'Beneficiary Cohort Demographics' : 'Beneficiary Management Directory'}
          </h1>
          <p className="text-xs text-[#5B6B7C] mt-1 max-w-2xl font-normal leading-relaxed">
            {role === 'AWW'
              ? `Showing ${beneficiaries.length} beneficiaries assigned to ${staffUser?.centreCode || 'AWC-702'}, out of ${mockStore.getBeneficiaries().length} project-wide beneficiaries.`
              : role === 'LS'
              ? `Showing ${beneficiaries.length} beneficiaries across assigned Sector (${staffUser?.sectorCode || 'Sector-4'}), out of ${mockStore.getBeneficiaries().length} project-wide beneficiaries.`
              : role === 'CDPO'
              ? `Showing all ${beneficiaries.length} project-wide beneficiaries across all 5 Anganwadi Centres.`
              : `Showing aggregated cohort distributions for ${metrics.total} project-wide beneficiaries across 6 demographic categories.`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isReadOnlyDemo ? (
            <>
              <Link
                to="/dashboard"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>← Dashboard</span>
              </Link>
              <Link
                to="/signin"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Staff Sign In</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/measurements"
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
                title="Record new measurement"
              >
                <Scale className="w-3.5 h-3.5 text-[#2457F5]" />
                <span>+ Record Measurement</span>
              </Link>
              <Link
                to="/beneficiaries/register"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] active:scale-95"
                title="Register new beneficiary"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Register Beneficiary</span>
              </Link>
            </>
          )}
        </div>
      </motion.div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Beneficiaries',
            value: metrics.total,
            subtext: `${metrics.totalChildren} children · ${metrics.totalMothers} mothers`,
            icon: Users,
            color: 'bg-blue-50 text-blue-700 border-blue-200/80',
          },
          {
            label: 'Children Under 6',
            value: metrics.totalChildren,
            subtext: `${metrics.children0to6m} infants · ${metrics.children6mTo3y} toddlers`,
            icon: Baby,
            color: 'bg-purple-50 text-purple-700 border-purple-200/80',
          },
          {
            label: 'Active Casework Flags',
            value: metrics.pendingCases,
            subtext: `${metrics.urgentCases} Urgent · ${metrics.attentionCases} Needs Attention`,
            icon: AlertTriangle,
            color: 'bg-rose-50 text-rose-700 border-rose-200/80',
          },
          {
            label: 'Stale (>35 Days)',
            value: metrics.staleCount,
            subtext: 'Weigh-in overdue for monthly check',
            icon: Clock,
            color: 'bg-amber-50 text-amber-700 border-amber-200/80',
          },
        ].map((card, idx) => (
          <div
            key={idx}
            className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-5 shadow-xs space-y-2 flex flex-col justify-between min-h-[130px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
                <AnimatedNumber value={card.value} />
              </div>
              <p className="text-xs text-slate-500 mt-1 font-normal truncate">{card.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Search & Compact Interactive Filter Toolbar */}
      <div className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box / Mode Indicator */}
          {isReadOnlyDemo ? (
            <div className="flex-1 flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-slate-700">Demographic Aggregate Filter Mode</span>
                <span className="text-slate-400">· Individual records protected</span>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200">
                Aggregates Only
              </span>
            </div>
          ) : (
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by ID (e.g. BEN-0142), name, or centre..."
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-16 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 px-1 py-0.5"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Quick Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {availableCentres.length > 1 && (
              <select
                value={selectedCentre}
                onChange={(e) => {
                  setSelectedCentre(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Centres ({availableCentres.length})</option>
                {availableCentres.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Under Monitoring">Under Monitoring</option>
              <option value="Referred">Referred (PHC/NRC)</option>
            </select>

            <select
              value={selectedMonitoring}
              onChange={(e) => {
                setSelectedMonitoring(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Screening States</option>
              <option value="flagged">Active Anomaly Flags</option>
              <option value="stale">Stale (&gt;35d Weigh-in)</option>
            </select>

            {(searchQuery || selectedCohort !== 'all' || selectedStatus !== 'all' || selectedMonitoring !== 'all' || selectedCentre !== 'all') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200/70"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Cohort Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 pt-3">
          {[
            { id: 'all', label: `All Cohorts (${beneficiaries.length})` },
            { id: 'children0to6m', label: `Infants 0–6m (${metrics.children0to6m})` },
            { id: 'children6mTo3y', label: `Toddlers 6m–3y (${metrics.children6mTo3y})` },
            { id: 'children3to6y', label: `Children 3–6y (${metrics.children3to6y})` },
            { id: 'adolescentGirls', label: `Adolescent Girls (${metrics.adolescentGirls})` },
            { id: 'pregnant', label: `Pregnant Women (${metrics.pregnantWomen})` },
            { id: 'lactating', label: `Lactating Mothers (${metrics.lactatingMothers})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedCohort(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCohort === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Content: Public Aggregate Cohort Breakdown OR Authenticated Staff Directory */}
      {isReadOnlyDemo ? (
        <div className="space-y-6">
          {/* Demographic Cohort Aggregates Table */}
          <div className="bg-[#E8F2FC] rounded-[28px] border border-[#BBD5F0] shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  Demographic Cohort Breakdown (Aggregates)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Centre-wide distribution across the synthetic demonstration cohorts. Safe, non-identifying data.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{metrics.total} Beneficiaries Reconciled</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200/60">
                  <tr>
                    <th className="py-3 px-4">Cohort &amp; Program Group</th>
                    <th className="py-3 px-4">Cohort Size</th>
                    <th className="py-3 px-4">Gender Breakdown</th>
                    <th className="py-3 px-4">Measurement Protocol</th>
                    <th className="py-3 px-4">Casework Status</th>
                    <th className="py-3 px-4 text-right">Anomalies &amp; Stale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cohortRows
                    .filter((row) => selectedCohort === 'all' || row.id === selectedCohort)
                    .map((row) => (
                      <tr key={row.code} className="hover:bg-[#F8FBFF] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{row.title}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{row.code}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 font-mono text-xs">{row.count}</div>
                          <div className="text-[10px] text-slate-400">{row.share} of center</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {row.males > 0 ? (
                            <span>{row.females} F / {row.males} M</span>
                          ) : (
                            <span>{row.females} Female</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                          <div className="truncate" title={row.protocol}>
                            {row.protocol}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${row.color}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-medium text-slate-700 text-[11px]">
                            {row.flags}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing aggregated cohort distributions. Individual records are protected.</span>
              <span className="font-semibold text-slate-700">Total: {metrics.total} Beneficiaries</span>
            </div>
          </div>

          {/* Safe Anonymized Archetype Example Card */}
          <div className="bg-[#E8F2FC] border border-[#BBD5F0] rounded-[28px] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2457F5]" />
                <h3 className="font-semibold text-sm text-[#0F172A]">
                  Standard Nutrition Casework Protocol
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Casework Workflow Example
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#F8FBFF] rounded-2xl border border-[#BBD5F0] shadow-xs space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold block">
                  Demographic Cohort
                </span>
                <div className="font-semibold text-slate-800">Toddler Cohort (6m–3y)</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Age: 14 completed months • Birth weight: 3.10 kg • Centre: AWC-702.
                </p>
              </div>

              <div className="p-4 bg-[#F8FBFF] rounded-2xl border border-[#BBD5F0] shadow-xs space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold block">
                  Data-Quality Screening Trigger
                </span>
                <div className="font-semibold text-rose-700">RUL-01 Velocity Outlier (+3.8 kg)</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Recorded weight jumped unexpectedly from 10.4 kg to 14.2 kg. Flagged as probable scale tare or digit typo.
                </p>
              </div>

              <div className="p-4 bg-[#F8FBFF] rounded-2xl border border-[#BBD5F0] shadow-xs space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold block">
                  Closed-Loop Casework Action
                </span>
                <div className="font-semibold text-emerald-700">Calibrated Re-weigh Countersigned</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Physical spot-check confirms 10.60 kg. Typo resolved, original raw record preserved, and ledger sealed.
                </p>
              </div>
            </div>

            {/* Governance Callout */}
            <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/70 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2">
                <Lock className="w-4 h-4 text-[#2457F5] shrink-0" />
                <span>
                  <strong>Frontline Privacy Governance:</strong> Individual child names, family records, biometrics, and longitudinal history are accessible only to authenticated staff.
                </span>
              </div>
              <Link
                to="/signin"
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 shrink-0 shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Sign In as Staff</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Authenticated Staff Directory: Full Beneficiary Management Table */
        <div className="bg-[#E8F2FC] rounded-[28px] border border-[#BBD5F0] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-600">
              Showing {filteredList.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, filteredList.length)} of {filteredList.length} records
            </div>
            <div className="text-[11px] text-slate-400">
              Click any row to open full growth chart &amp; verification ledger
            </div>
          </div>

          {paginatedBeneficiaries.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-700">No beneficiaries matched the filter</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Try adjusting your search keywords, clearing cohort filters, or register a new beneficiary.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCohort('all');
                  setSelectedStatus('all');
                  setSelectedMonitoring('all');
                }}
                className="text-xs text-[#2457F5] font-semibold hover:underline"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Beneficiary</th>
                    <th className="py-3.5 px-4 font-semibold">Age / Category</th>
                    <th className="py-3.5 px-4 font-semibold">Gender</th>
                    <th className="py-3.5 px-4 font-semibold">Anganwadi Centre</th>
                    <th className="py-3.5 px-4 font-semibold">Latest Measurements</th>
                    <th className="py-3.5 px-4 font-semibold">Screening / Case Status</th>
                    <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedBeneficiaries.map((ben) => {
                    const age = calculateAge(ben.dob, undefined, ben.category, ben.gender);
                    const isStale =
                      ben.lastMeasurementDate &&
                      Math.round(
                        (new Date('2026-10-24').getTime() - new Date(ben.lastMeasurementDate).getTime()) /
                          (1000 * 3600 * 24)
                      ) > 35;

                    return (
                      <tr
                        key={ben.id}
                        onClick={() => navigate(`/beneficiaries/${ben.id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* 1. Beneficiary (ID & Name) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-mono font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors">
                              {ben.id.replace('BEN-', '')}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <DataBadge variant="beneficiary" className="font-mono">{ben.id}</DataBadge>
                                <span className="font-semibold text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition-colors">
                                  {ben.name}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Caregiver: <span className="text-slate-700 font-medium">{ben.caregiverKinship}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Age / Category */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900 text-xs tabular-nums">{age.ageDisplay}</div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {age.cohortLabel}
                          </span>
                        </td>

                        {/* 3. Gender */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                            ben.gender === 'Female' ? 'bg-pink-50 text-pink-700 border border-pink-200/80' : 'bg-sky-50 text-sky-700 border border-sky-200/80'
                          }`}>
                            {ben.gender}
                          </span>
                        </td>

                        {/* 4. Anganwadi Centre */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <DataBadge variant="centre" className="font-mono">{ben.centreCode}</DataBadge>
                            <div className="text-[11px] text-slate-500">
                              Worker: <span className="font-mono text-slate-700 font-medium">{ben.assignedAww}</span>
                            </div>
                          </div>
                        </td>

                        {/* 5. Latest Measurements */}
                        <td className="py-3.5 px-4">
                          {ben.lastWeight ? (
                            <div className="space-y-1">
                              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                                {ben.lastWeight.toFixed(2)} kg · {ben.lastHeight?.toFixed(1)} cm
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span className="font-mono">{ben.lastMeasurementDate}</span>
                                {isStale && (
                                  <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[9px]">
                                    Stale &gt;35d
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No readings logged</span>
                          )}
                        </td>

                        {/* 6. Screening / Case Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                ben.status === 'Referred'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : ben.status === 'Under Monitoring'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {ben.status}
                            </span>
                            {ben.hasActiveFlag && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-500" />
                                Action Queue Flagged
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 7. Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/measurements?beneficiaryId=${ben.id}`}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-full transition-colors inline-flex items-center gap-1"
                              title="Record new measurement"
                            >
                              <Scale className="w-3 h-3 text-blue-600" />
                              <span>Measure</span>
                            </Link>
                            <Link
                              to={`/beneficiaries/${ben.id}`}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition-colors inline-flex items-center gap-1 shadow-2xs"
                              title="View beneficiary profile"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>Profile</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 5. Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const BeneficiaryListPage: React.FC<BeneficiaryListPageProps> = (props) => {
  const { supabaseSession, authInitializing } = useAuth();
  if (authInitializing) {
    return <section role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Checking signed-in account…</section>;
  }
  if (supabaseSession) {
    return <section className="rounded-3xl border border-amber-200 bg-white p-6" aria-labelledby="beneficiary-access-title">
      <h1 id="beneficiary-access-title" className="text-xl font-semibold text-slate-900">Mock beneficiary data unavailable for provider sessions</h1>
      <p className="mt-2 text-sm text-slate-600">This frontend demo reads only its browser-local synthetic dataset and does not request beneficiary records from an external service.</p>
    </section>;
  }
  if (isMockDemoEnabled(import.meta.env)) {
    return <MockBeneficiaryListPage {...props} />;
  }
  return <section className="rounded-3xl border border-amber-200 bg-white p-6" aria-labelledby="beneficiary-access-title">
    <h1 id="beneficiary-access-title" className="text-xl font-semibold text-slate-900">Mock beneficiaries unavailable</h1>
    <p className="mt-2 text-sm text-slate-600">Browser-local demonstration records are disabled in this build. No external records are loaded.</p>
    <Link to="/signin" className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Sign in</Link>
  </section>;
};
