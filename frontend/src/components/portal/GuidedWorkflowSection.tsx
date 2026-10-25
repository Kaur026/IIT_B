import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale,
  AlertTriangle,
  ListTodo,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Info,
  Sparkles,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Building2,
  FileText,
} from 'lucide-react';

export const GuidedWorkflowSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [selectedScenario, setSelectedScenario] = useState<'typo' | 'sam'>('typo');

  const steps = [
    {
      num: 1,
      title: 'Measurement & Quality Check',
      short: 'Quality Check',
      icon: Scale,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      activeRing: 'ring-blue-500',
      actionTitle: 'Automated Plausibility Screening',
      desc: 'When an Anganwadi worker enters weight or height, algorithms screen against historical velocity and physiological bounds (e.g. sudden +3.8 kg in 28 days or negative height step).',
      note: 'Crucial principle: Data-quality flags are screening alerts for human attention, NOT medical diagnoses.',
      scenarios: {
        typo: {
          badge: 'Trigger: RUL-01 Velocity Outlier',
          detail: 'Recorded 14.20 kg (+3.8 kg spike from last month’s 10.40 kg in an infant). Flagged as probable 10.4 kg -> 14.2 kg digit typo.',
          status: 'Flagged for Supervisory Check',
        },
        sam: {
          badge: 'Trigger: CLIN-01 Severe Malnutrition',
          detail: 'MUAC tape reading < 11.5 cm with severe weight-for-height stagnation over 60 days.',
          status: 'Flagged for Immediate Clinical Triage',
        },
      },
    },
    {
      num: 2,
      title: 'Flag for Human Review',
      short: 'Human Review',
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      activeRing: 'ring-amber-500',
      actionTitle: 'Frontline Priority Notification',
      desc: 'The discrepancy is queued in the centre’s action dashboard with an explanation of why it was flagged, previous measurements, and suggested physical check steps.',
      note: 'Supervisors and frontline workers inspect the context before taking field action.',
      scenarios: {
        typo: {
          badge: 'Queue: Priority Triage',
          detail: 'Alert displayed on worker dashboard: "Probable keyboard typo or uncalibrated spring scale tare offset."',
          status: 'Awaiting Field Verification',
        },
        sam: {
          badge: 'Queue: High Clinical Alert',
          detail: 'Supervisor alerted to schedule home visit and coordinate emergency nutritional screening.',
          status: 'Triage Assigned to AWW & ANM',
        },
      },
    },
    {
      num: 3,
      title: 'Assign Follow-up Task',
      short: 'Assign Task',
      icon: ListTodo,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      activeRing: 'ring-indigo-500',
      actionTitle: 'Accountable Role Assignment',
      desc: 'A specific follow-up task is dispatched to the designated frontline worker (AWW / ASHA) with a concrete task description and service deadline (SLA).',
      note: 'Clear accountability: Every flagged child has a named owner and target completion date.',
      scenarios: {
        typo: {
          badge: 'Task: Physical Re-weigh with Calibrated Scale',
          detail: 'Assigned to: Anganwadi Worker (AWW) • SLA: 5 Days • Tool: Salter spring scale with 5 kg standard tare weight.',
          status: 'Field Visit Scheduled',
        },
        sam: {
          badge: 'Task: Caregiver Home Visit & Assessment',
          detail: 'Assigned to: AWW + ANM • SLA: 48 Hours • Action: Appetite test, check for bilateral edema.',
          status: 'Home Counseling Active',
        },
      },
    },
    {
      num: 4,
      title: 'Escalation When Overdue',
      short: 'Escalate Overdue',
      icon: Clock,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      activeRing: 'ring-rose-500',
      actionTitle: 'Multi-Tier Operational Escalation',
      desc: 'If a pending follow-up is not logged within the operational window, the case automatically escalates to Sector Supervisor (LS) or Child Development Project Officer (CDPO).',
      note: 'Zero dropped cases: Prevents critical interventions from slipping through administrative cracks.',
      scenarios: {
        typo: {
          badge: 'Tier 2 Escalation (Day 6)',
          detail: 'Reminder sent to Sector Supervisor: "AWC re-weigh overdue by 24h. Supervisory spot-check required."',
          status: 'Escalated to Sector Supervisor',
        },
        sam: {
          badge: 'Urgent Clinical Escalation (Day 3)',
          detail: 'Emergency escalation to Medical Officer (PHC) and CDPO: "Clinical follow-up SLA elapsed."',
          status: 'Escalated to CDPO & PHC Doctor',
        },
      },
    },
    {
      num: 5,
      title: 'Record Referral or Outcome',
      short: 'Document Outcome',
      icon: ShieldCheck,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      activeRing: 'ring-purple-500',
      actionTitle: 'Verifiable Outcome Documentation',
      desc: 'Worker or supervisor enters verified field results: either a corrected physical measurement, nutritional counseling notes, or formal medical admission at NRC/PHC.',
      note: 'Original readings remain preserved in audit history; verified values are marked as countersigned.',
      scenarios: {
        typo: {
          badge: 'Verified Measurement Logged',
          detail: 'Calibrated scale reading confirms true weight is 10.60 kg. Typo (+3.8 kg) corrected with supervisor justification.',
          status: 'Physical Verification Countersigned',
        },
        sam: {
          badge: 'Formal NRC Admission Logged',
          detail: 'Child admitted to District Nutrition Rehabilitation Centre (NRC) for therapeutic stabilization & feeding protocol.',
          status: 'Referred to Clinical Care',
        },
      },
    },
    {
      num: 6,
      title: 'Close Task & Audit Trail',
      short: 'Close & Audit',
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      activeRing: 'ring-emerald-500',
      actionTitle: 'Immutable Closure & Learning',
      desc: 'The task is formally resolved and archived with a tamper-evident audit ledger entry, cryptographic proof hash, and resolution timestamp.',
      note: 'Closed-loop complete: Data is reconciled, metrics are updated, and lessons feed back to centre training.',
      scenarios: {
        typo: {
          badge: 'Ledger Hash #4f9c1b • Status: Resolved',
          detail: 'Case closed. Spring scale recalibrated. Growth chart normalized. Monthly sector report updated.',
          status: 'Case Closed & Reconciled',
        },
        sam: {
          badge: 'Ledger Hash #8e3a2f • Status: Monitored',
          detail: 'Case transferred to active medical surveillance. Discharge follow-up scheduled in 14 days.',
          status: 'Clinical Loop Completed',
        },
      },
    },
  ];

  const currentStepData = steps[activeStep - 1];
  const scenarioData = currentStepData.scenarios[selectedScenario];

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
      {/* 1. Header & Value Proposition */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[11px] font-semibold text-[#2457F5] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Casework Tour • 6-Step Closed-Loop Lifecycle</span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-[#0F172A] tracking-tight">
            How Poshan Action Layer Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Most nutrition information systems stop at displaying static statistics. Poshan Action Layer converts recorded data and anomalies into <strong className="text-slate-800 font-semibold">accountable, human-verified actions</strong>—from initial entry through supervisor escalation and documented medical referral.
          </p>
        </div>

        {/* Prototype & Disclaimer Badges */}
        <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            <Info className="w-3 h-3 text-[#2457F5]" />
            Synthetic sandbox • No real child data
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            Flags are not medical diagnoses
          </span>
          <span className="text-[10px] text-slate-400">
            Academic simulation • Not live Poshan Tracker
          </span>
        </div>
      </div>

      {/* 2. Interactive Scenario Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Choose a synthetic example:</span>
          <span className="text-[11px] text-slate-400 hidden md:inline">• Safe sandbox walkthrough</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedScenario('typo');
              setActiveStep(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              selectedScenario === 'typo'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scenario 1: Scale Tare / Typo (+3.8 kg)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedScenario('sam');
              setActiveStep(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              selectedScenario === 'sam'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scenario 2: Severe Malnutrition (SAM)
          </button>
        </div>
      </div>

      {/* 3. The 6-Step Visual Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
        {steps.map((st) => {
          const isCurrent = activeStep === st.num;
          const isDone = activeStep > st.num;
          const Icon = st.icon;

          return (
            <button
              key={st.num}
              type="button"
              onClick={() => setActiveStep(st.num)}
              className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] group ${
                isCurrent
                  ? 'bg-white border-[#2457F5] shadow-sm ring-2 ring-[#2457F5]/20'
                  : isDone
                  ? 'bg-slate-50/90 border-slate-200 hover:bg-white'
                  : 'bg-white/60 border-slate-200/60 hover:bg-slate-50 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
                    isCurrent
                      ? 'bg-[#0F172A] text-white'
                      : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  {isDone ? '✓' : st.num}
                </span>
                <div className={`p-1 rounded-lg ${st.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="mt-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Step 0{st.num}
                </div>
                <div
                  className={`text-xs font-semibold leading-tight mt-0.5 ${
                    isCurrent ? 'text-[#0F172A]' : 'text-slate-700'
                  }`}
                >
                  {st.short}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Active Step Deep Dive Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedScenario}-${activeStep}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-xs ${currentStepData.color}`}>
                <currentStepData.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                    Workflow Stage {currentStepData.num} of 6
                  </span>
                  <span className="text-xs font-bold text-[#0F172A]">
                    {currentStepData.title}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-800 mt-0.5">
                  {currentStepData.actionTitle}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs">
                Status: <strong className="text-slate-900">{scenarioData.status}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Explanation & Governance Principle (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                {currentStepData.desc}
              </p>
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>{currentStepData.note}</span>
              </div>
            </div>

            {/* Right: Simulated Scenario Detail Box (5 cols) */}
            <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Synthetic Simulation Example
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2457F5] border border-blue-200">
                  {scenarioData.badge}
                </span>
              </div>

              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                {scenarioData.detail}
              </p>

              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                <span>Center: AWC #702 (Synthetic Archetype)</span>
                <span className="font-mono text-[10px]">Step {activeStep} / 6</span>
              </div>
            </div>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
            <button
              type="button"
              disabled={activeStep === 1}
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeStep === 1
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-700 hover:bg-white border border-slate-200 shadow-xs'
              }`}
            >
              ← Previous Step
            </button>

            <div className="flex items-center gap-1.5">
              {steps.map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setActiveStep(s.num)}
                  aria-label={`Jump to step ${s.num}`}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    activeStep === s.num ? 'bg-[#0F172A] w-6' : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

            {activeStep < 6 ? (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => Math.min(6, prev + 1))}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 shadow-xs flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <span>Next Step: {steps[activeStep].short}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 shadow-xs flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                <span>Restart Casework Tour</span>
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
