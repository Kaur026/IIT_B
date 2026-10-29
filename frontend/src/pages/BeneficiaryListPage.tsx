import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
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
import { PreparedBeneficiaryView } from '../components/portal/PreparedRecordsViews';

const MockBeneficiaryListPage: React.FC = () => {
  const navigate = useNavigate();
  const { isReadOnlyDemo, role, staffUser } = useAuth();

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonitoring, setSelectedMonitoring] = useState<'all' | 'flagged' | 'stale'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchBens = () => {
      setBeneficiaries(mockStore.getBeneficiaries({ role, centreCode: staffUser?.centreCode }));
    };
    fetchBens();
    const unsubscribe = mockStore.subscribe(fetchBens);
    return unsubscribe;
  }, [role, staffUser]);

  // Filter logic
  const filteredList = beneficiaries.filter((item) => {
    const age = calculateAge(item.dob, undefined, item.category);

    // Cohort filter
    if (selectedCohort !== 'all') {
      if (selectedCohort === 'children0to6m' && age.cohort !== 'children0to6m') return false;
      if (selectedCohort === 'children6mTo3y' && age.cohort !== 'children6mTo3y') return false;
      if (selectedCohort === 'children3to6y' && age.cohort !== 'children3to6y') return false;
      if (selectedCohort === 'pregnant' && item.category !== 'pregnant') return false;
      if (selectedCohort === 'lactating' && item.category !== 'lactating') return false;
      if (selectedCohort === 'adolescent' && item.category !== 'adolescent' && age.cohort !== 'adolescentGirls') return false;
    }

    // Status filter
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

    // Monitoring filter
    if (selectedMonitoring === 'flagged' && !item.hasActiveFlag) return false;
    if (selectedMonitoring === 'stale') {
      if (!item.lastMeasurementDate) return true;
      const days = Math.round((new Date('2026-10-24').getTime() - new Date(item.lastMeasurementDate).getTime()) / (1000 * 3600 * 24));
      if (days <= 35) return false;
    }

    // Search query: synthetic ID, centreCode, assignedAww
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.id.toLowerCase().includes(q) ||
        item.centreCode.toLowerCase().includes(q) ||
        item.assignedAww.toLowerCase().includes(q) ||
        item.caregiverKinship.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedBeneficiaries = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const metrics = mockStore.getMetrics({ role, centreCode: staffUser?.centreCode, sectorCode: staffUser?.sectorCode, projectCode: staffUser?.projectCode });

  return (
    <div className="space-y-6 pb-12">
      <Link to="/b1-explorer" className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100">
        Open separate B1 Synthetic Screening Dataset explorer
      </Link>
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
            {isReadOnlyDemo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-semibold text-[#2457F5]">
                <Eye className="w-3 h-3" />
                Demo Mode — Synthetic Aggregates
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            {isReadOnlyDemo ? 'Beneficiary Cohort Demographics' : 'Beneficiary Management Directory'}
          </h1>
          <p className="text-xs text-[#5B6B7C] mt-1 max-w-2xl font-normal leading-relaxed">
            {role
              ? `Operational directory scoped to ${ROLE_CONFIGS[role].scopeLevel} (${staffUser?.centreCode || staffUser?.sectorCode || staffUser?.projectCode || 'District'}). Showing synthetic IDs (BEN-xxxx) and age in months.`
              : 'Synthetic cohort directory. Showing synthetic IDs (BEN-xxxx) and age in months.'}
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
            label: 'Total Registered',
            value: metrics.total,
            subtext: `${metrics.totalChildren} children • ${metrics.totalMothers} mothers`,
            icon: Users,
            color: 'bg-blue-50 text-[#2457F5] border-blue-200/60',
          },
          {
            label: 'Children Under 6 Years',
            value: metrics.totalChildren,
            subtext: `${metrics.children0to6m} infants (0-6m) • ${metrics.children6mTo3y} toddlers`,
            icon: Baby,
            color: 'bg-purple-50 text-purple-700 border-purple-200/60',
          },
          {
            label: 'Active Casework Flags',
            value: metrics.pendingCases,
            subtext: `${metrics.urgentCases} Urgent • ${metrics.attentionCases} Needs Attention`,
            icon: AlertTriangle,
            color: 'bg-rose-50 text-rose-700 border-rose-200/60',
          },
          {
            label: 'Stale Measurements (>35d)',
            value: metrics.staleCount,
            subtext: 'Requires monthly home visit recall',
            icon: Clock,
            color: 'bg-amber-50 text-amber-700 border-amber-200/60',
          },
        ].map((card, idx) => (
          <div
            key={idx}
            className="bg-white/90 backdrop-blur-md rounded-[24px] border border-slate-200/80 p-5 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-light tracking-tight text-[#0F172A] tabular-nums">
              <AnimatedNumber value={card.value} />
            </div>
            <p className="text-[11px] text-slate-400 font-normal">{card.subtext}</p>
          </div>
        ))}
      </div>

      {/* 3. Search & Interactive Filter Bar */}
      <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box / Mode Indicator */}
          {isReadOnlyDemo ? (
            <div className="flex-1 flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#2457F5]" />
                <span className="font-medium text-slate-700">Demographic Aggregate Filter Mode</span>
                <span className="text-slate-400">• Child identities anonymized</span>
              </div>
              <span className="text-[10px] bg-blue-50 text-[#2457F5] font-semibold px-2 py-0.5 rounded border border-blue-200">
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
                placeholder="Search by ID (e.g. BEN-0142), centre code, or worker..."
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Case Statuses</option>
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
              className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Intake States</option>
              <option value="flagged">Active Screening Anomaly</option>
              <option value="stale">Stale (Overdue Measurement)</option>
            </select>
          </div>
        </div>

        {/* Cohort Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 pt-3">
          {[
            { id: 'all', label: `All Cohorts (${beneficiaries.length})` },
            { id: 'children0to6m', label: `Infants 0–6m (${metrics.children0to6m})` },
            { id: 'children6mTo3y', label: `Toddlers 6m–3y (${metrics.children6mTo3y})` },
            { id: 'children3to6y', label: `Children 3–6y (${metrics.children3to6y})` },
            { id: 'pregnant', label: `Pregnant Women (${metrics.pregnantWomen})` },
            { id: 'lactating', label: `Lactating Mothers (${metrics.lactatingMothers})` },
            { id: 'adolescent', label: `Adolescent Girls (${metrics.adolescentGirls})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedCohort(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCohort === tab.id
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
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
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  Demographic Cohort Breakdown (Aggregates)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Centre-wide distribution across official ICDS programme categories. Safe, non-identifying data.
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
                  {[
                    {
                      id: 'children0to6m',
                      title: 'Infants (0–6 Months)',
                      code: 'ICDS-INF-06',
                      count: metrics.children0to6m,
                      females: 9,
                      males: 9,
                      share: `${((metrics.children0to6m / metrics.total) * 100).toFixed(1)}%`,
                      protocol: 'Recumbent Length (Infantometer) • Calibrated Spring Scale',
                      status: '15 Active • 3 Under Monitoring',
                      flags: '2 Velocity Outliers • 1 Stale >35d',
                      color: 'bg-sky-50 text-sky-800 border-sky-200',
                    },
                    {
                      id: 'children6mTo3y',
                      title: 'Toddlers (6 Months – 3 Years)',
                      code: 'ICDS-TOD-36',
                      count: metrics.children6mTo3y,
                      females: 22,
                      males: 20,
                      share: `${((metrics.children6mTo3y / metrics.total) * 100).toFixed(1)}%`,
                      protocol: 'Recumbent (<24m) or Standing (>24m) • MUAC Screening',
                      status: '32 Active • 8 Under Monitoring • 2 NRC Referrals',
                      flags: '6 Velocity Outliers • 3 Stale >35d • 2 Negative Steps',
                      color: 'bg-blue-50 text-blue-800 border-blue-200',
                    },
                    {
                      id: 'children3to6y',
                      title: 'Preschool Children (3–6 Years)',
                      code: 'ICDS-PRE-72',
                      count: metrics.children3to6y,
                      females: 17,
                      males: 19,
                      share: `${((metrics.children3to6y / metrics.total) * 100).toFixed(1)}%`,
                      protocol: 'Standing Height (Stadiometer) • Growth Monitoring Chart',
                      status: '30 Active • 5 Under Monitoring • 1 PHC Referral',
                      flags: '3 Velocity Outliers • 2 Stale >35d • 2 Negative Steps',
                      color: 'bg-amber-50 text-amber-800 border-amber-200',
                    },
                    {
                      id: 'pregnant',
                      title: 'Pregnant Women',
                      code: 'ICDS-MAT-PW',
                      count: metrics.pregnantWomen,
                      females: 14,
                      males: 0,
                      share: `${((metrics.pregnantWomen / metrics.total) * 100).toFixed(1)}%`,
                      protocol: 'ANC Weight Velocity • Iron-Folic Acid Tracking',
                      status: '12 Active • 2 Special Monitoring',
                      flags: '1 Weight Gain Anomaly • 1 Stale >35d',
                      color: 'bg-rose-50 text-rose-800 border-rose-200',
                    },
                    {
                      id: 'lactating',
                      title: 'Lactating Mothers (0–6 Months Postpartum)',
                      code: 'ICDS-MAT-LM',
                      count: metrics.lactatingMothers,
                      females: 16,
                      males: 0,
                      share: `${((metrics.lactatingMothers / metrics.total) * 100).toFixed(1)}%`,
                      protocol: 'Postnatal Nutrition Support • Exclusive Breastfeeding Tracking',
                      status: '15 Active • 1 Dietary Counseling',
                      flags: '0 Anomalies • 0 Stale',
                      color: 'bg-purple-50 text-purple-800 border-purple-200',
                    },
                    {
                      id: 'adolescent',
                      title: 'Adolescent Girls (Out of School)',
                      code: 'ICDS-ADL-AG',
                      count: metrics.adolescentGirls,
                      females: 7,
                      males: 0,
                      share: `${((metrics.adolescentGirls / metrics.total) * 100).toFixed(1)}%`,
                      protocol: 'BMI-for-Age Screening • Hemoglobin Surveillance',
                      status: '6 Active • 1 Dietary Guidance',
                      flags: '0 Anomalies • 0 Stale',
                      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    },
                  ]
                    .filter((row) => selectedCohort === 'all' || row.id === selectedCohort)
                    .map((row) => (
                      <tr key={row.code} className="hover:bg-slate-50/70 transition-colors">
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
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-[28px] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2457F5]" />
                <h3 className="font-semibold text-sm text-[#0F172A]">
                  Safe Synthetic Casework Archetype [ANON-DEMO-SAMPLE]
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Training &amp; Workflow Archetype • No Identifiable Child
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold block">
                  Demographic Archetype
                </span>
                <div className="font-semibold text-slate-800">Toddler Cohort (6m–3y)</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Age: 14 completed months • Birth weight: 3.10 kg • Centre: AWC #702 Kashi Gramin (synthetic).
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold block">
                  Data-Quality Screening Trigger
                </span>
                <div className="font-semibold text-rose-700">RUL-01 Velocity Outlier (+3.8 kg)</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Recorded weight jumped unexpectedly from 10.4 kg to 14.2 kg. Flagged as probable scale tare or digit typo.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
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
        <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 shadow-sm overflow-hidden">
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
                <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200/60">
                  <tr>
                    <th className="py-3 px-4">Beneficiary</th>
                    <th className="py-3 px-4">Age / Cohort</th>
                    <th className="py-3 px-4">Caregiver</th>
                    <th className="py-3 px-4">Latest Anthropometry</th>
                    <th className="py-3 px-4">Casework Status</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedBeneficiaries.map((ben) => {
                    const age = calculateAge(ben.dob, undefined, ben.category);
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
                        {/* Synthetic ID */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-[#0E1B2B] font-mono font-bold flex items-center justify-center text-[11px] shrink-0 group-hover:bg-[#1F8A83] group-hover:text-white transition-colors">
                              {ben.id.replace('BEN-', '')}
                            </div>
                            <div>
                              <div className="font-semibold font-mono text-slate-900 group-hover:text-[#1F8A83] transition-colors flex flex-wrap items-center gap-1.5">
                                <DataBadge variant="beneficiary">{ben.id}</DataBadge>
                                {ben.gender === 'Female' ? (
                                  <span className="text-[10px] text-pink-500 font-medium">(F)</span>
                                ) : (
                                  <span className="text-[10px] text-blue-500 font-medium">(M)</span>
                                )}
                              </div>
                              <div className="mt-1"><DataBadge variant="worker" className="font-mono">{ben.assignedAww}</DataBadge></div>
                            </div>
                          </div>
                        </td>

                        {/* Dynamic Age */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 tabular-nums">{age.ageDisplay} ({age.completedMonths}m)</div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            {age.cohortLabel}
                          </span>
                        </td>

                        {/* Kinship & Centre */}
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="font-medium text-slate-800">{ben.caregiverKinship}</div>
                          <div className="mt-1"><DataBadge variant="centre" className="font-mono">{ben.centreCode}</DataBadge></div>
                        </td>

                        {/* Latest Measurement */}
                        <td className="py-3.5 px-4">
                          {ben.lastWeight ? (
                            <div className="space-y-0.5">
                              <div className="inline-flex rounded-lg border border-[#A9C6D9] bg-[#E5EFF6] px-2 py-1 font-mono font-medium text-[#293F59] tabular-nums">
                                {ben.lastWeight.toFixed(2)} kg • {ben.lastHeight?.toFixed(1)} cm
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <Calendar className="w-3 h-3 text-slate-300" />
                                <DataBadge variant="date" className="font-mono">{ben.lastMeasurementDate}</DataBadge>
                                {isStale && (
                                  <span className="text-amber-600 font-semibold ml-1">
                                    (Stale &gt;35d)
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No readings logged</span>
                          )}
                        </td>

                        {/* Status */}
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
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                Action Queue Flagged
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quick Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/measurements?beneficiaryId=${ben.id}`}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition-colors flex items-center gap-1"
                              title="Record new measurement"
                            >
                              <Scale className="w-3 h-3 text-[#2457F5]" />
                              <span className="hidden sm:inline">Measure</span>
                            </Link>
                            <Link
                              to={`/beneficiaries/${ben.id}`}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span className="hidden sm:inline">Profile</span>
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

export const BeneficiaryListPage: React.FC = () => {
  const { supabaseSession, authInitializing } = useAuth();
  if (authInitializing) {
    return <section role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Checking signed-in account…</section>;
  }
  if (supabaseSession) {
    return <PreparedBeneficiaryView accessToken={supabaseSession.access_token} />;
  }
  if (isMockDemoEnabled(import.meta.env)) {
    return <MockBeneficiaryListPage />;
  }
  return <section className="rounded-3xl border border-amber-200 bg-white p-6" aria-labelledby="beneficiary-access-title">
    <h1 id="beneficiary-access-title" className="text-xl font-semibold text-slate-900">Prepared beneficiaries unavailable</h1>
    <p className="mt-2 text-sm text-slate-600">Sign in with an account that has trusted backend authorization. Browser-local demonstration records are disabled in this build.</p>
    <Link to="/signin" className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Sign in</Link>
  </section>;
};
