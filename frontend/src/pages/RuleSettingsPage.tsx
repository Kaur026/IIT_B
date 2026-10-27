import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ChevronRight,
  X,
  Check,
  Info,
  Scale,
  History,
  AlertTriangle,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Plus,
  Eye,
  Lock,
} from 'lucide-react';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DataBadge } from '../components/common/DataBadge';
import { mockStore, RuleDefinition } from '../store/mockStore';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../utils/permissions.ts';

export const RuleSettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const { requireStaffAction, role, staffUser } = useAuth();

  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'velocity' | 'negative' | 'stagnation' | 'clumping'>('all');
  const [selectedRule, setSelectedRule] = useState<RuleDefinition | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const canEdit = canPerformAction(role, 'edit_rules');

  // Sandbox simulation test state
  const [testPrevWeight, setTestPrevWeight] = useState('8.50');
  const [testCurrWeight, setTestCurrWeight] = useState('12.30');
  const [ruleThreshold, setRuleThreshold] = useState(2.5);

  // New Rule Form
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<'velocity' | 'negative' | 'stagnation' | 'clumping'>('velocity');
  const [newRuleTarget, setNewRuleTarget] = useState('Children (0–59m)');
  const [newRuleThreshold, setNewRuleThreshold] = useState(2.0);
  const [newRuleAction, setNewRuleAction] = useState('Generates Verification Alert');

  useEffect(() => {
    setRules(mockStore.getRules());
    const unsubscribe = mockStore.subscribe(() => {
      setRules(mockStore.getRules());
    });
    return unsubscribe;
  }, []);

  // Esc key dismiss for Rule Inspector drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRule) setSelectedRule(null);
        if (isCreateModalOpen) setIsCreateModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRule, isCreateModalOpen]);

  const testDelta = (parseFloat(testCurrWeight) || 0) - (parseFloat(testPrevWeight) || 0);
  const willFire = testDelta > ruleThreshold;

  const toggleRule = (ruleId: string) => {
    if (!requireStaffAction('modify screening rules or toggle heuristic thresholds')) {
      return;
    }
    if (role && !canPerformAction(role, 'edit_rules')) {
      showToast('Permission Restricted', `Role ${role} cannot toggle screening rules. Restricted to CDPO (view-only for other roles).`, 'error');
      return;
    }
    const r = rules.find((x) => x.id === ruleId);
    if (!r) return;
    mockStore.toggleRule(ruleId, { actorId: staffUser?.id, role });
    showToast(
      !r.isActive ? 'Rule Enabled' : 'Rule Paused',
      `Screening heuristic ${ruleId} (${r.name}) is now ${!r.isActive ? 'ACTIVE' : 'MUTED'}.`,
      'info'
    );
  };

  const filteredRules = rules.filter((r) => {
    if (activeCategory === 'all') return true;
    return r.category === activeCategory;
  });

  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);

  const handleSaveRuleConfig = () => {
    if (!selectedRule) return;
    if (role && !canPerformAction(role, 'edit_rules')) {
      showToast('Permission Restricted', `Role ${role} cannot edit screening rules. Restricted to CDPO.`, 'error');
      return;
    }
    if (ruleThreshold <= 0 || ruleThreshold > 50) {
      showToast('Validation Error', 'Threshold must be a positive value under 50.', 'error');
      return;
    }
    setIsConfirmSaveOpen(true);
  };

  const handleConfirmedSave = () => {
    if (!selectedRule) return;
    if (role && !canPerformAction(role, 'edit_rules')) {
      showToast('Permission Restricted', `Role ${role} cannot edit screening rules. Restricted to CDPO.`, 'error');
      return;
    }
    mockStore.updateRuleThreshold(selectedRule.id, ruleThreshold, { actorId: staffUser?.id, role });
    setIsConfirmSaveOpen(false);
    setSelectedRule(null);
    showToast(
      'Rule Threshold Updated',
      `Rule ${selectedRule.id} parameter updated to ${ruleThreshold.toFixed(1)}. Connected to subsequent measurement screening.`,
      'success'
    );
  };

  const handleCreateNewRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (role && !canPerformAction(role, 'edit_rules')) {
      showToast('Permission Restricted', `Role ${role} cannot create screening rules. Restricted to CDPO.`, 'error');
      return;
    }
    if (!newRuleName.trim()) return;

    if (newRuleThreshold <= 0 || newRuleThreshold > 50) {
      showToast('Validation Error', 'Rule threshold must be positive and under 50.', 'error');
      return;
    }

    const createdId = mockStore.createRule({
      name: newRuleName,
      category: newRuleCategory,
      targetGroup: newRuleTarget,
      condition: `Monthly delta variance > ${newRuleThreshold} (Example rule • Demo)`,
      actionGenerated: newRuleAction,
      severity: 'Needs Attention',
      thresholdValue: newRuleThreshold,
      isActive: true,
    });

    setIsCreateModalOpen(false);
    setNewRuleName('');
    showToast(
      'Screening Rule Created',
      `Custom rule ${createdId} added to active sector heuristic catalog.`,
      'success'
    );
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[11px] font-semibold text-blue-800 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#2457F5]" />
            Non-Clinical Screening Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Data Quality & Rule Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
            Parametric threshold heuristics for Sector Rampur. Automatically intercepts biometric entry typos, rapid weight shifts, and scale clumping before official consolidation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Read-only notice for LS / DPO */}
          {!canEdit && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>View Only — Rule editing requires CDPO access</span>
            </div>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Rule</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* 4 Staggered Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Configured Active Rules',
            value: rules.filter((r) => r.isActive).length,
            suffix: ' rules',
            subtext: '100% human-verified alerts',
            icon: Sliders,
            badgeColor: 'bg-emerald-100 text-emerald-800',
          },
          {
            label: 'Anomalies Caught (30d)',
            value: 47,
            suffix: ' triggers',
            subtext: '42 typos fixed • 5 clinical escalations',
            icon: ShieldAlert,
            badgeColor: 'bg-blue-100 text-blue-800',
          },
          {
            label: 'False Positive Ratio',
            value: 4.2,
            isDecimal: true,
            suffix: '%',
            subtext: 'Down from 12.8% after tuning',
            icon: CheckCircle2,
            badgeColor: 'bg-purple-100 text-purple-800',
          },
          {
            label: 'Supervisor SLA Compliance',
            value: 98.1,
            isDecimal: true,
            suffix: '%',
            subtext: 'Verified within 48h turnaround',
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
                  {card.isDecimal ? <span>{card.value}</span> : <AnimatedNumber value={card.value} />}
                  <span className="text-xs font-normal text-slate-500">{card.suffix}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">{card.subtext}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Rules Table with Sliding Category Pills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 shadow-sm overflow-hidden"
      >
        {/* Category Filter Pills */}
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 relative bg-slate-100/80 p-1.5 rounded-full border border-slate-200/60">
            {[
              { id: 'all', label: `All Rules (${rules.length})` },
              { id: 'velocity', label: 'Velocity' },
              { id: 'negative', label: 'Negative Growth' },
              { id: 'stagnation', label: 'Stagnation' },
              { id: 'clumping', label: 'Digit Bias' },
            ].map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id as any)}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] ${
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="ruleCategoryTabPill"
                      className="absolute inset-0 bg-[#0F172A] rounded-full -z-10 shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Active in AWC #702 • Updated by Supervisor Rajesh
          </div>
        </div>

        {/* Rules Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Rule ID & Name</th>
                <th className="py-3 px-4">Target Cohort</th>
                <th className="py-3 px-4">Screening Threshold & Heuristic Logic</th>
                <th className="py-3 px-4">Generated Action</th>
                <th className="py-3 px-4">30d Alerts</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRules.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => setSelectedRule(r)}
                >
                  <td className="py-4 px-5">
                    <div className="font-semibold text-[#0F172A] flex items-center gap-2">
                      <DataBadge variant="rule" className="font-mono">{r.id}</DataBadge>
                      <span>{r.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-600 font-medium">{r.targetGroup}</td>
                  <td className="py-4 px-4 max-w-sm">
                    <p className="text-slate-800 font-medium">{r.condition}</p>
                  </td>
                  <td className="py-4 px-4 text-slate-600 max-w-xs">{r.actionGenerated}</td>
                  <td className="py-4 px-4">
                    <span className="font-mono font-semibold text-slate-800 tabular-nums">{r.triggers30d}</span>
                    <span className="text-slate-400 text-[10px] ml-1">triaged</span>
                  </td>
                  {/* Status Toggle (CDPO only) / Read-only badge (LS / DPO) */}
                  <td className="py-4 px-4">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRule(r.id);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          r.isActive ? 'bg-[#0F172A]' : 'bg-slate-300'
                        }`}
                        aria-label={`Toggle rule ${r.id}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            r.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        r.isActive
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {r.isActive ? 'Active' : 'Paused'}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRule(r);
                        }}
                        className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <Settings2 className="w-3 h-3" />
                        <span>Configure</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRule(r);
                        }}
                        className="px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-xs transition-colors inline-flex items-center gap-1 border border-slate-200"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Rule Inspector & Interactive Sandbox Drawer with Esc Close */}
      <AnimatePresence>
        {selectedRule && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSelectedRule(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              aria-hidden="true"
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-slate-200"
              >
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <DataBadge variant="rule" className="font-mono">{selectedRule.id}</DataBadge>
                    </div>
                    <div>
                      <h2 className="font-semibold text-lg text-[#0F172A]">
                        {selectedRule.name}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Parametric configuration for AWC #702
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRule(null)}
                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form & Sandbox */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="bg-[#F6FAFF] border border-blue-100 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold text-[#0F172A]">Operational Intent: </span>
                    Intercepts extreme biometric outliers and digit transposition errors (e.g. keying 12.30 kg instead of 8.90 kg). Generates human-in-the-loop verification tasks for supervisors before data enters permanent state registers.
                  </div>

                  {/* Threshold Parameter Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800">
                        Maximum Allowable Monthly Weight Gain Ceiling
                      </label>
                      <span className="text-sm font-bold text-[#2457F5] font-mono">
                        +{ruleThreshold.toFixed(1)} kg / month
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.5"
                      max="4.0"
                      step="0.1"
                      value={ruleThreshold}
                      onChange={(e) => setRuleThreshold(parseFloat(e.target.value))}
                      className="w-full accent-[#0F172A] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Strict (+1.5 kg)</span>
                      <span>Recommended (+2.5 kg • Demo)</span>
                      <span>Permissive (+4.0 kg)</span>
                    </div>
                  </div>

                  {/* Interactive Test Sandbox */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                        Live Heuristic Sandbox Simulator
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Simulate how this rule responds to sample test values before saving:
                    </p>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Prior Month Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={testPrevWeight}
                          onChange={(e) => setTestPrevWeight(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Current Month Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={testCurrWeight}
                          onChange={(e) => setTestCurrWeight(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A]"
                        />
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        willFire
                          ? 'bg-rose-50 border-rose-200 text-rose-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {willFire ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                        <span>
                          Biometric Delta: <strong>+{testDelta.toFixed(2)} kg</strong>
                        </span>
                      </div>
                      <span className="font-semibold uppercase tracking-wider text-[10px]">
                        {willFire ? 'RULE WILL FIRE (FLAGGED)' : 'PASSES (NORMAL)'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">Audit Compliance Notice:</p>
                    <p>Modifications to screening thresholds are permanently timestamped and cryptographically logged in the Sector Governance Audit Ledger.</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRule(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-full"
                  >
                    {canEdit ? 'Cancel' : 'Close'}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleSaveRuleConfig}
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-full shadow-sm transition-transform active:scale-95 flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Parametric Rule</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* "+ Create Rule" Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2457F5]" />
                  <h3 className="font-semibold text-base text-[#0F172A]">
                    Configure New Screening Rule
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewRule} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rule Name / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="e.g. Rapid Height Step Anomaly"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newRuleCategory}
                      onChange={(e) => setNewRuleCategory(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A]"
                    >
                      <option value="velocity">Velocity</option>
                      <option value="negative">Negative Step</option>
                      <option value="stagnation">Stagnation</option>
                      <option value="clumping">Digit Bias</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Threshold Parameter
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newRuleThreshold}
                      onChange={(e) => setNewRuleThreshold(parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Cohort
                  </label>
                  <input
                    type="text"
                    value={newRuleTarget}
                    onChange={(e) => setNewRuleTarget(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Action Generated
                  </label>
                  <input
                    type="text"
                    value={newRuleAction}
                    onChange={(e) => setNewRuleAction(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[#0F172A]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-full bg-slate-100 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-[#0F172A] text-white font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save New Rule</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Threshold Confirmation Dialog */}
      <AnimatePresence>
        {isConfirmSaveOpen && selectedRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Settings2 className="w-4 h-4 text-[#2457F5]" />
                  <span>Confirm Threshold Update</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmSaveOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  You are updating the trigger threshold for <strong>{selectedRule.name}</strong> ({selectedRule.id}) to:
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-xl font-bold font-mono text-[#2457F5]">{ruleThreshold.toFixed(1)}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Subsequent field measurements will be screened against this value</p>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  Note: All thresholds are illustrative demo parameters for academic research simulation.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmSaveOpen(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmedSave}
                  className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Confirm & Save Parameter</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
