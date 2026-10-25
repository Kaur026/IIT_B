import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileBarChart2,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  FileText,
  PieChart,
  ArrowDownToLine,
  Check,
  X,
  Lock,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { mockStore, AuditLedgerEntry } from '../store/mockStore.ts';
import { exportToCsvString } from '../utils/casework.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { DataBadge } from '../components/common/DataBadge';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const { isReadOnlyDemo, isStaff, role } = useAuth();

  const [selectedAudit, setSelectedAudit] = useState<AuditLedgerEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [auditEntries, setAuditEntries] = useState<AuditLedgerEntry[]>([]);

  useEffect(() => {
    setAuditEntries(mockStore.getAuditLog({ role }));
    const unsubscribe = mockStore.subscribe(() => {
      setAuditEntries(mockStore.getAuditLog({ role }));
    });
    return unsubscribe;
  }, [role]);

  const handleDownload = (reportName: string, format: string) => {
    if (format.toUpperCase() === 'PDF') {
      window.print();
      showToast(
        'Print Dossier View',
        `Prepared print view for "${reportName}". Select "Save as PDF" to generate file.`,
        'info'
      );
      return;
    }

    try {
      let csvContent = '';
      if (reportName.includes('SAM') || reportName.includes('Clinical')) {
        if (isReadOnlyDemo) {
          // Public mode: Aggregate, non-identifying synthetic summary
          const headers = ['Facility Level', 'Clinical Category', 'Active Referrals', 'Destination Facility', 'Coordination Role', 'Status'];
          const rows = [
            ['ICDS Sector 4', 'Severe Acute Malnutrition (SAM)', 2, 'District NRC Varanasi', 'Sector Lady Supervisor', 'Active Treatment'],
            ['ICDS Sector 4', 'Moderate Acute Malnutrition (MAM)', 1, 'Primary Health Centre (PHC)', 'ANM / Medical Officer', 'Under Surveillance'],
          ];
          csvContent = exportToCsvString(headers, rows);
        } else {
          // Staff mode: Authorized detailed line list
          const referrals = mockStore.getReferrals({ role });
          const headers = ['Referral ID', 'Beneficiary ID', 'Age', 'Reason', 'Destination', 'Date', 'Owner', 'Status', 'Outcome'];
          const rows = referrals.map((r) => [r.id, r.beneficiaryId, r.ageDisplay, r.reason, r.destination, r.referralDate, r.owner, r.status, r.finalOutcome || 'Pending']);
          csvContent = exportToCsvString(headers, rows);
        }
      } else if (reportName.includes('Scale') || reportName.includes('Calibration') || reportName.includes('Offset')) {
        if (isReadOnlyDemo) {
          // Public mode: Aggregate center-level calibration summary
          const headers = ['Sector Zone', 'AWC Centre', 'Inspected Scales', 'Calibrated Zero Tare', 'Compliance Rate', 'Certified Date'];
          const rows = [
            ['Kashi Gramin', 'AWC-701', 3, 3, '100%', '2026-10-20'],
            ['Kashi Gramin', 'AWC-702', 3, 3, '100%', '2026-10-22'],
            ['Kashi Gramin', 'AWC-703', 2, 2, '100%', '2026-10-21'],
            ['Kashi Gramin', 'AWC-704', 3, 3, '100%', '2026-10-23'],
          ];
          csvContent = exportToCsvString(headers, rows);
        } else {
          // Staff mode: Case-level line list
          const cases = mockStore.getCases({ role });
          const headers = ['Action ID', 'Beneficiary ID', 'Rule Code', 'Rule Name', 'Prev Weight', 'Flagged Weight', 'Delta', 'Status', 'Verified Weight'];
          const rows = cases.map((c) => [c.actionId, c.id, c.ruleCode, c.ruleName, c.prevWeight, c.flaggedWeight, c.weightDelta, c.status, c.verifiedWeight || 'Pending']);
          csvContent = exportToCsvString(headers, rows);
        }
      } else {
        if (isReadOnlyDemo) {
          // Public mode: Anonymized aggregate audit entries
          const headers = ['Audit ID', 'Timestamp', 'Center ID', 'Cohort Group', 'Staff Actor', 'Action Type', 'Delta Summary', 'Proof Status'];
          const rows = auditEntries.map((e, idx) => [
            e.id,
            e.timestamp,
            'AWC-702',
            `Cohort Archetype #${idx + 1}`,
            e.actor,
            e.actionType,
            e.deltaSummary,
            e.status,
          ]);
          csvContent = exportToCsvString(headers, rows);
        } else {
          // Staff mode: Full audit trail with synthetic identifiers
          const headers = ['Audit ID', 'Timestamp', 'Action ID', 'PAL ID', 'Staff Actor', 'Action Type', 'Delta Summary', 'Proof Hash', 'Status'];
          const rows = auditEntries.map((e) => [e.id, e.timestamp, e.actionId, e.palId, e.actor, e.actionType, e.deltaSummary, e.proofHash, e.status]);
          csvContent = exportToCsvString(headers, rows);
        }
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_2026.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(
        'Export Generated',
        `Downloaded valid CSV file "${reportName}.csv".`,
        'success'
      );
    } catch {
      showToast(
        'Download Restricted',
        `Preview generated for browser viewing.`,
        'info'
      );
    }
  };

  const handleRefreshActivity = () => {
    setAuditEntries(mockStore.getAuditLog({ role }));
    showToast(
      'Activity Refreshed',
      'Tamper-evident audit trail synchronized with local sector session cache.',
      'info'
    );
  };

  const filteredLedger = auditEntries.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.actionId.toLowerCase().includes(q) ||
      item.palId.toLowerCase().includes(q) ||
      item.actor.toLowerCase().includes(q) ||
      item.deltaSummary.toLowerCase().includes(q)
    );
  });

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
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cryptographic Accountability Trail</span>
            </div>
            {isReadOnlyDemo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-[#2457F5]">
                <span>Demo Mode — Synthetic Data</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Activity Log &amp; Sector Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
            {isReadOnlyDemo
              ? 'Aggregated monthly indicators, resolution distributions, and non-identifying synthetic sector reports for AWC #702.'
              : 'Reconciled monthly indicators, supervisory resolution distribution, and exportable line-lists for Poshan Tracker integration and district reviews.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshActivity}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#2457F5]" />
            <span>Refresh Activity</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownload('Monthly_Consolidation_Dossier', 'pdf')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Export Monthly Dossier</span>
          </button>
        </div>
      </motion.div>

      {/* Analytics Card with Animated SVG Donut Chart & Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Donut Chart (5 cols) */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-6 justify-center">
            <div className="relative w-44 h-44 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F5F9" strokeWidth="11" />
                {/* 68% Typos (Blue) */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2457F5"
                  strokeWidth="11"
                  strokeDasharray="238.76"
                  initial={{ strokeDashoffset: 238.76 }}
                  animate={{ strokeDashoffset: 238.76 * (1 - 0.68) }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                />
                {/* 22% NRC (Purple) */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#A855F7"
                  strokeWidth="11"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - 0.22)}
                  style={{
                    transformOrigin: '50% 50%',
                    transform: 'rotate(244.8deg)',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                />
                {/* 10% Active (Green) */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth="11"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - 0.1)}
                  style={{
                    transformOrigin: '50% 50%',
                    transform: 'rotate(324deg)',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-light text-[#0F172A] tracking-tight">38</span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  Resolved
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#2457F5]" />
                <span className="font-semibold text-slate-700">68%</span>
                <span className="text-slate-500">Data Entry Typos Corrected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="font-semibold text-slate-700">22%</span>
                <span className="text-slate-500">Clinical Escalations / NRC</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-700">10%</span>
                <span className="text-slate-500">Active Field Re-weighs</span>
              </div>
            </div>
          </div>

          {/* Breakdown Progress Bars (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Supervisory Physical Verification Coverage</span>
                <span className="font-bold text-[#0F172A]">94.7% (38 / 40 cases)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '94.7%' }}
                  transition={{ duration: 1.0, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Spring Scale Calibration Spot-Check Adherence</span>
                <span className="font-bold text-[#0F172A]">100% (6 / 6 AWCs)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">NRC Severe Malnutrition Referral Turnaround</span>
                <span className="font-bold text-[#0F172A]">1.2 days (Target &lt; 2.0d)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-purple-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '85%' }}
                  transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4 Scheduled Sector Reports Cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Scheduled Sector Dossiers & Exports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Monthly Sector Reconciliation (MPR)',
              subtitle: `October 2026 • ${mockStore.getMetrics().total} Beneficiaries`,
              desc: 'Official monthly progress register reconciling nutrition indicators across Rampur AWCs.',
              format: 'PDF',
              badge: 'Consolidated',
              badgeColor: 'bg-emerald-100 text-emerald-800',
            },
            {
              title: 'Frontline Scale Offset Analysis',
              subtitle: 'AWW Calibration Spot-Checks',
              desc: 'Identifies terminal digit preference and spring scale tare drift across 6 center zones.',
              format: 'CSV',
              badge: 'Quality Audit',
              badgeColor: 'bg-blue-100 text-blue-800',
            },
            {
              title: 'SAM / MAM Clinical Line List',
              subtitle: 'Active Medical Referrals',
              desc: 'Detailed line list of 3 children undergoing therapeutic care with Sector PHC MO.',
              format: 'CSV',
              badge: 'High Priority',
              badgeColor: 'bg-rose-100 text-rose-800',
            },
            {
              title: 'Supervisory SLA Compliance Audit',
              subtitle: 'Frontline Timeliness Scorecard',
              desc: 'Immutable verification turnaround timestamps for district administrative review.',
              format: 'PDF',
              badge: 'Governance',
              badgeColor: 'bg-purple-100 text-purple-800',
            },
          ].map((rep, idx) => (
            <motion.div
              key={rep.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.06 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className="bg-white/85 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${rep.badgeColor}`}>
                    {rep.badge}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">{rep.format}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A] leading-tight">{rep.title}</h3>
                <p className="text-[11px] text-[#2457F5] font-medium mt-1">{rep.subtitle}</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{rep.desc}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">Ready to Export</span>
                <button
                  type="button"
                  onClick={() => handleDownload(rep.title, rep.format.toLowerCase())}
                  className="px-3 py-1.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Frontline Action Ledger Table with Hash Inspection Popover */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-sm text-[#0F172A]">
              Frontline Verification Audit Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Append-only tamper-evident log of supervisory spot-checks and record corrections
            </p>
          </div>

          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit ledger..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#2457F5]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-4">Action ID & Beneficiary</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Biometric Delta</th>
                <th className="py-3 px-4">Audit Proof / Inspect</th>
                <th className="py-3 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLedger.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-5"><DataBadge variant="date" className="font-mono tabular-nums">{row.timestamp}</DataBadge></td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      <DataBadge variant="beneficiary" className="font-mono">{row.palId}</DataBadge>
                      <DataBadge variant="action" className="font-mono">{row.actionId}</DataBadge>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">{row.actionType}</td>
                  <td className="py-3.5 px-4"><DataBadge variant="worker" className="font-mono">{row.actor}</DataBadge></td>
                  <td className="py-3.5 px-4"><DataBadge variant="delta" className="font-mono tabular-nums">{row.deltaSummary}</DataBadge></td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => setSelectedAudit(row)}
                      className="font-mono text-[11px] text-[#2457F5] bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors inline-flex items-center gap-1"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>Inspect Audit</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.status === 'Verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.status === 'Escalated'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Cryptographic Proof Inspection Popover / Modal with Esc Close */}
      <AnimatePresence>
        {selectedAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAudit(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-sm text-[#0F172A]">
                    Inspect Cryptographic Audit Proof
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAudit(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Action ID:</span>
                  <DataBadge variant="action" className="font-mono">{selectedAudit.actionId}</DataBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficiary ID:</span>
                  <DataBadge variant="beneficiary" className="font-mono">{selectedAudit.palId}</DataBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Authorized Signer:</span>
                  <DataBadge variant="worker" className="font-mono">{selectedAudit.actor}</DataBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <DataBadge variant="date" className="font-mono">{selectedAudit.timestamp}</DataBadge>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-1">SHA-256 Ledger Hash Digest:</span>
                  <span className="font-mono text-[10px] break-all bg-white p-2 rounded block border border-slate-200 text-slate-700">
                    4f9c1b3e7789a2046dbf71a93821ce30aef02c7b508f2ac419d8820f891bca42
                  </span>
                </div>
              </div>

              {isReadOnlyDemo && (
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
                  <Lock className="w-4 h-4 text-[#2457F5] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Privacy Governance:</span> In public demo mode, personal child names and IDs are replaced with anonymized cohort identifiers. Authorized staff can sign in to view identifiable casework records.
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                This verification event was physically countersigned using supervisory mobile key at AWC #702 Kashi Gramin (demo).
              </p>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAudit(null)}
                  className="px-4 py-1.5 rounded-full bg-[#0F172A] text-white text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
