import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  UserCheck,
  CalendarCheck,
  Home,
  CheckCircle,
} from 'lucide-react';
import { motion } from 'motion/react';

interface Step {
  number: number;
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  detail: string;
}

const LIFECYCLE_STEPS: Step[] = [
  {
    number: 1,
    title: 'Record',
    badge: 'Field Entry',
    description: 'Staff enter or receive child nutrition measurements and beneficiary information.',
    icon: <FileText className="w-4 h-4" />,
    detail: 'Frontline data ingress from Poshan Tracker or local community weighing days.',
  },
  {
    number: 2,
    title: 'Rule-Based Screening',
    badge: 'Automated Plausibility',
    description: 'Algorithms screen records for potential data-quality concerns and biological plausibility.',
    icon: <Sparkles className="w-4 h-4" />,
    detail: 'Mathematical checks compare values with WHO growth velocity and digit-flip patterns.',
  },
  {
    number: 3,
    title: 'Human Review',
    badge: 'Mandatory Human Gatekeeper',
    description: 'Deterministic demo rules show the trigger and evidence; live AI assistance is not connected. An Anganwadi Worker or Supervisor decides whether a flag is valid.',
    icon: <UserCheck className="w-4 h-4" />,
    detail: 'Zero automated diagnosis or automated overwrites. Decisions remain 100% human-verified.',
  },
  {
    number: 4,
    title: 'Assign Action',
    badge: 'Delegation & SLA',
    description: 'After review, assign an owner, set a due date, and select appropriate action.',
    icon: <CalendarCheck className="w-4 h-4" />,
    detail: 'Specific protocols: Salter re-weighing, maternal counseling, or Lady Supervisor review.',
  },
  {
    number: 5,
    title: 'Follow-up',
    badge: 'Field Visit',
    description: 'Staff record home visit attempts, clinical referrals, caregiver notes, and child progress.',
    icon: <Home className="w-4 h-4" />,
    detail: 'Frontline workers document the physical visit outcome with offline-cached forms.',
  },
  {
    number: 6,
    title: 'Outcome & Closure',
    badge: 'Verified Resolution',
    description: 'Document staff decisions, verify resolution, and close case only after confirmed outcome.',
    icon: <CheckCircle className="w-4 h-4" />,
    detail: 'Casework ends with complete audit records and synchronized operational metrics.',
  },
];

export const LifecycleTimeline: React.FC = () => {
  const [activeStep, setActiveStep] = useState(2); // default Human Review active (step 3, 0-indexed 2)

  return (
    <section id="workflow" className="scroll-mt-28 sm:scroll-mt-32 py-20 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Pill Section Label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
          Operational workflow
        </span>
      </div>

      {/* Two Column Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-16">
        <div className="lg:col-span-7">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight leading-tight">
            Closed-loop operational lifecycle
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            Every flagged metric follows a disciplined, tamper-evident journey from initial village intake to
            verified supervisory closure.
          </p>
        </div>
      </div>

      {/* Main Grid: Steps on Left, Large Photo on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column: Vertical Timeline */}
        <div className="lg:col-span-7 relative">
          {/* Vertical Green Line */}
          <div
            className="absolute left-[23px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-emerald-400 via-teal-300 to-slate-200"
            aria-hidden="true"
          />

          <div className="space-y-6">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <div
                  key={step.title}
                  onClick={() => setActiveStep(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setActiveStep(idx);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isActive}
                  className={`group relative flex items-start gap-5 p-4 sm:p-5 rounded-2xl transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] ${
                    isActive
                      ? 'bg-white shadow-[0_12px_36px_rgba(15,23,42,0.06)] border border-slate-200/80 scale-[1.01]'
                      : 'hover:bg-white/60 opacity-75 hover:opacity-100'
                  }`}
                >
                  {/* Step Circle Icon */}
                  <div
                    className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 shrink-0 ${
                      isActive
                        ? 'bg-[#0F172A] text-white ring-4 ring-emerald-100 shadow-md'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 group-hover:bg-emerald-100'
                    }`}
                  >
                    {step.icon}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        0{step.number}.
                      </span>
                      <h3
                        className={`text-base font-medium tracking-tight transition-colors ${
                          isActive ? 'text-slate-900 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {step.title}
                      </h3>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {step.badge}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {step.description}
                    </p>

                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium bg-slate-50/70 p-2.5 rounded-xl"
                      >
                        <span className="text-slate-800 font-semibold">Standard Operating Procedure: </span>
                        {step.detail}
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Large Photo with Frosted Overlays & Parallax */}
        <div className="lg:col-span-5 relative">
          <div className="relative rounded-[32px] overflow-hidden bg-white p-2.5 shadow-[0_20px_50px_rgba(15,23,42,0.06)] border border-slate-100">
            <div className="relative aspect-[3/4] rounded-[24px] overflow-hidden bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1000&q=80"
                alt="Community health worker checking child growth during home visit"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex flex-col justify-end p-6 text-white">
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1">
                  Step 0{activeStep + 1} Spotlight
                </span>
                <p className="text-sm font-medium leading-snug">
                  {LIFECYCLE_STEPS[activeStep].title}: {LIFECYCLE_STEPS[activeStep].description}
                </p>
                <span className="text-[10px] text-white/70 mt-2">
                  Illustrative image • Poshan Tracker Companion Model
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
