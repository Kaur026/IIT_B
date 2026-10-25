import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  ShieldCheck,
  Building2,
  Calendar,
  RotateCcw,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Award,
  Layers,
  MapPin,
  FileText,
  X,
  Sparkles,
} from 'lucide-react';
import { mockStore, DEMO_TODAY, STORAGE_KEY } from '../store/mockStore.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ROLE_CONFIGS } from '../utils/permissions.ts';

export const StaffProfilePage: React.FC = () => {
  const { showToast } = useToast();
  const { staffUser, role } = useAuth();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const activeRoleConfig = ROLE_CONFIGS[role || 'AWW'];
  const metrics = mockStore.getMetrics({ role, centreCode: staffUser?.centreCode });

  const handleResetData = () => {
    mockStore.resetToDemoSeed();
    setIsResetModalOpen(false);
    showToast(
      'Demo Dataset Restored',
      'Local storage state has been reset to the canonical baseline seed (35 action cases, 133+ beneficiaries).',
      'success'
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
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
            <span className="text-slate-800 font-semibold">Staff Profile & Controls</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Frontline Staff Profile & System Controls
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
            Active operator credentials, catchment sector administrative configuration, and browser demo state management.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsResetModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </motion.div>

      {/* 2. Worker Identity & Station Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Card (7 Cols) */}
        <article className="lg:col-span-7 bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-xl shadow-md">
              {staffUser?.id ? staffUser.id.replace('AWW-', 'W').replace('LS-', 'S').replace('CDPO-', 'C').replace('DPO-', 'D') : 'OP'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-[#0F172A]">{activeRoleConfig.fullTitle}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2457F5] text-[11px] font-semibold border border-blue-200 font-mono">
                  {staffUser?.id || activeRoleConfig.defaultId}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeRoleConfig.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100">
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Anganwadi Centre / Base</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-mono">
                <Building2 className="w-4 h-4 text-[#2457F5]" />
                {staffUser?.centreCode || 'AWC-702'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Administrative Role</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#2457F5]" />
                {activeRoleConfig.label}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Active Scoped Population</span>
              <span className="font-semibold text-slate-800">
                {metrics.total} Beneficiaries ({metrics.totalChildren} Children under 6)
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Simulation Session Date</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#2457F5]" />
                {DEMO_TODAY} (Saturday)
              </span>
            </div>
          </div>

          {/* Operational Hierarchy */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <h3 className="font-semibold text-xs text-[#0F172A] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#2457F5]" />
              <span>Multi-Tier Casework Escalation Lineage</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Tier 2 Supervisor</span>
                <span className="font-semibold text-slate-800">Sector Supervisor (LS-01)</span>
                <span className="text-slate-500 text-[10px] block">Sector Verification Desk</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Tier 3 Medical Officer</span>
                <span className="font-semibold text-slate-800">PHC Medical Officer</span>
                <span className="text-slate-500 text-[10px] block">Sector PHC / ANM Clinical</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Tier 4 District Head</span>
                <span className="font-semibold text-slate-800">District Programme Officer (DPO)</span>
                <span className="text-slate-500 text-[10px] block">District Mission Cell</span>
              </div>
            </div>
          </div>
        </article>

        {/* Demo Persistence & Storage Health Card (5 Cols) */}
        <aside className="lg:col-span-5 space-y-6">
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#2457F5]" />
                <h3 className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">
                  Local Demo Persistence
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                localStorage Active
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              All registrations, physical verifications, clinical referrals, and custom screening thresholds automatically persist in your browser storage.
            </p>

            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Storage Key</span>
                <span className="font-mono text-slate-800 font-semibold text-[11px]">{STORAGE_KEY}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Beneficiary Records</span>
                <span className="font-mono text-slate-900 font-bold tabular-nums">{metrics.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Action Queue Tasks</span>
                <span className="font-mono text-slate-900 font-bold tabular-nums">{metrics.pendingCases}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Resolved Verifications</span>
                <span className="font-mono text-emerald-700 font-bold tabular-nums">{metrics.resolvedCases}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Canonical Baseline Demo Data</span>
              </button>
            </div>
          </div>

          {/* Academic Simulation Notice */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-5 shadow-sm space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Simulated Governance Context</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Student research prototype for academic evaluation of anthropometric plausibility algorithms. Not connected to Ministry of Women & Child Development production APIs.
            </p>
          </div>
        </aside>
      </div>

      {/* 3. RESET CONFIRMATION MODAL */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-semibold text-sm text-[#0F172A]">Confirm Demo Reset</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  Are you sure you want to restore the canonical baseline seed dataset?
                </p>
                <ul className="space-y-1 list-disc list-inside text-slate-500">
                  <li>Resets 35 flagged anthropometric cases</li>
                  <li>Restores initial 248 village records</li>
                  <li>Reverts custom screening rule thresholds</li>
                  <li>Clears temporary session verifications</li>
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm Reset</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
