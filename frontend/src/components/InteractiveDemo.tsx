import React, { useState, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  RotateCcw,
  UserCheck,
  XCircle,
  Edit3,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SAMPLE_CASES, CaseRecord, calculateWeightDifference } from '../utils/casework';

interface InteractiveDemoProps {
  onOpenDemo?: () => void;
}

export const InteractiveDemo: React.FC<InteractiveDemoProps> = ({ onOpenDemo }) => {
  const [cases, setCases] = useState<CaseRecord[]>(SAMPLE_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-1');
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0 to 100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);

  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(5, Math.min(95, pos));
    setSliderPosition(clamped);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleSliderMove(e.clientX);
    }
  };

  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineWeight, setInlineWeight] = useState('');

  const getStatusChip = (status: CaseRecord['status']) => {
    switch (status) {
      case 'verified_assigned':
        return { label: 'Follow-up assigned', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'dismissed':
        return { label: 'Dismissed as normal', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'edited':
        return { label: 'Measurement edited', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      default:
        return { label: 'Awaiting human review', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
  };

  const handleAction = (status: CaseRecord['status'], actionName: string) => {
    if (status === 'edited') {
      setIsEditingInline(true);
      setInlineWeight(activeCase.verifiedReading.weightKg.toString());
      return;
    }
    setIsEditingInline(false);
    setCases((prev) =>
      prev.map((c) => (c.id === activeCase.id ? { ...c, status } : c))
    );
    setFeedbackMessage(
      `Case ${activeCase.beneficiaryId}: ${actionName}. Record updated in session.`
    );
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  const handleSaveInline = () => {
    const val = parseFloat(inlineWeight) || activeCase.verifiedReading.weightKg;
    setCases((prev) =>
      prev.map((c) =>
        c.id === activeCase.id
          ? {
              ...c,
              status: 'edited',
              verifiedReading: {
                ...c.verifiedReading,
                weightKg: val,
                note: `Measurement updated inline to ${val.toFixed(2)} kg.`,
              },
            }
          : c
      )
    );
    setIsEditingInline(false);
    setFeedbackMessage(`Case ${activeCase.beneficiaryId}: Measurement updated inline to ${val.toFixed(2)} kg.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const weightDiff = calculateWeightDifference(
    activeCase.originalReading.weightKg,
    activeCase.verifiedReading.weightKg
  );

  return (
    <section id="how-it-works" className="scroll-mt-28 sm:scroll-mt-32 py-20 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Pill Section Label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#2457F5]">
          Interactive casework demo
        </span>
      </div>

      {/* Two Column Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-12">
        <div className="lg:col-span-7">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#0F172A] tracking-tight leading-tight">
            From flag to resolved case
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            Drag the before/after slider to compare the raw Poshan Tracker biometric entry against the
            supervisor's physical re-measurement.
          </p>
        </div>
      </div>

      {/* Main Interactive Demo Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sample Cases Tabs (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Select Field Scenario (Demo)
          </span>

          {cases.map((c, index) => {
            const isSelected = c.id === selectedCaseId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCaseId(c.id)}
                className={`w-full text-left p-4 rounded-2xl transition-all duration-200 border flex flex-col gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] ${
                  isSelected
                    ? 'bg-white shadow-[0_8px_25px_rgba(15,23,42,0.06)] border-[#2457F5]/40 ring-1 ring-[#2457F5]/30'
                    : 'bg-white/60 hover:bg-white border-slate-200/60 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    {c.beneficiaryId}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                      c.status === 'awaiting_review'
                        ? 'bg-amber-100 text-amber-800'
                        : c.status === 'verified_assigned'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {c.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-sm font-semibold text-slate-900 mt-0.5 font-mono">
                  {c.beneficiaryId} ({c.ageMonths}m, {c.gender})
                </div>

                <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {c.flagTitle}
                </div>
              </button>
            );
          })}

          {/* Core Principle Callout */}
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50/60 border border-emerald-100 text-xs text-slate-600 leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 mb-1">
              <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Immutable Ledger Principle</span>
            </div>
            Original readings remain preserved in the central record for retrospective audit. Human
            corrections exist as companion verification entries.
          </div>
        </div>

        {/* Right Column: Large Interactive Card with Before/After Slider (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-[28px] p-6 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)] border border-slate-100 flex flex-col gap-6">
          {/* Top Metadata Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-400">
                  {activeCase.beneficiaryId}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-600">
                  Age: {activeCase.ageMonths} months ({activeCase.gender})
                </span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">
                  Demo Record
                </span>
              </div>
              <h3 className="text-xl font-medium text-slate-900 tracking-tight mt-1">
                {activeCase.flagTitle}
              </h3>
            </div>

            {/* Status Pill */}
            <div className="self-start sm:self-auto flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Current state:</span>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider border ${
                  getStatusChip(activeCase.status).color
                }`}
              >
                {getStatusChip(activeCase.status).label}
              </span>
            </div>
          </div>

          {/* Interactive Before/After Split Comparison View */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
              <span className="text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Original Reading (Flagged Outlier)
              </span>
              <span className="text-slate-400 font-normal hidden sm:inline">
                Drag slider or use arrow keys
              </span>
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                After Physical Verification
              </span>
            </div>

            {/* Draggable Slider Container */}
            <div
              ref={sliderContainerRef}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
              tabIndex={0}
              role="slider"
              aria-label="Comparison between original and verified measurement"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={sliderPosition}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setSliderPosition((p) => Math.max(5, p - 5));
                if (e.key === 'ArrowRight') setSliderPosition((p) => Math.min(95, p + 5));
              }}
              className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden select-none cursor-ew-resize bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2457F5]"
            >
              {/* Left Side: Original reading (Rose/Warm tint) */}
              <div className="absolute inset-0 bg-gradient-to-br from-rose-50/60 via-amber-50/40 to-slate-50 p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 font-semibold text-xs">
                    Original Entry
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {activeCase.originalReading.date}
                  </span>
                </div>

                <div className="my-auto max-w-xs">
                  <div className="text-3xl sm:text-4xl font-light text-slate-900 tabular-nums">
                    {activeCase.originalReading.weightKg} <span className="text-base text-slate-500">kg</span>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Height: <span className="font-medium">{activeCase.originalReading.heightCm} cm</span>
                  </div>
                  <p className="text-xs text-rose-700 bg-rose-100/70 p-2.5 rounded-xl mt-3 font-medium leading-snug">
                    {activeCase.originalReading.note}
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Rule Trigger: {activeCase.threshold}
                </div>
              </div>

              {/* Right Side: Verified reading (clipped by sliderPosition) */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-slate-50 p-6 flex flex-col justify-between"
                style={{
                  clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-xs ml-auto">
                    Verified Measurement
                  </span>
                </div>

                <div className="my-auto ml-auto max-w-xs text-right">
                  <div className="text-3xl sm:text-4xl font-light text-slate-900 tabular-nums">
                    {activeCase.verifiedReading.weightKg} <span className="text-base text-slate-500">kg</span>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Height: <span className="font-medium">{activeCase.verifiedReading.heightCm} cm</span>
                    <span className="ml-2 font-mono text-xs font-semibold text-emerald-700">
                      (Correction: {weightDiff.formatted})
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 bg-emerald-100/70 p-2.5 rounded-xl mt-3 font-medium leading-snug text-left">
                    {activeCase.verifiedReading.note}
                  </p>
                </div>

                <div className="text-[11px] text-emerald-700 font-mono text-right">
                  Verified by: {activeCase.assignedTo} on {activeCase.verifiedReading.date}
                </div>
              </div>

              {/* Draggable Divider Handle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(0,0,0,0.3)] pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg cursor-ew-resize">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-900">Why was this flagged?</span>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {activeCase.flagDescription}
            </p>
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Rule-Based Demo Suggestion:</span>
              <span>{activeCase.suggestedAction}</span>
            </div>
          </div>

          {/* Inline Measurement Editing Field */}
          {isEditingInline && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                  New Weight (kg):
                </span>
                <input
                  type="number"
                  step="0.05"
                  value={inlineWeight}
                  onChange={(e) => setInlineWeight(e.target.value)}
                  className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]"
                  placeholder="e.g. 8.90"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsEditingInline(false)}
                  className="px-3.5 py-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveInline}
                  className="px-4 py-1.5 rounded-full bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Save Measurement
                </button>
              </div>
            </div>
          )}

          {/* Interactive Casework Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleAction('verified_assigned', 'Verified & assigned follow-up')}
                className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-medium px-4 sm:px-5 py-2.5 rounded-full transition-colors active:scale-95 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
              >
                <UserCheck className="w-4 h-4" />
                <span>Verify & assign follow-up</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction('dismissed', 'Flag dismissed as normal variance')}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium px-4 py-2.5 rounded-full transition-colors active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
              >
                <XCircle className="w-4 h-4 text-slate-500" />
                <span>Dismiss flag</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction('edited', 'Measurement updated with re-test value')}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium px-4 py-2.5 rounded-full transition-colors active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
              >
                <Edit3 className="w-4 h-4 text-slate-500" />
                <span>Edit measurement</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSliderPosition(50);
                setCases(SAMPLE_CASES);
                setFeedbackMessage('Demo cases reset to initial state.');
                setTimeout(() => setFeedbackMessage(null), 3000);
              }}
              className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 py-1"
              title="Reset slider position & case states"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Feedback Toast */}
          <AnimatePresence>
            {feedbackMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feedbackMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MANDATORY DISCLAIMER LINE */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              Rule-based demo flags are not diagnoses. Live AI assistance is not connected. Original readings are never overwritten.
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              100% Synthetic Demo Dataset
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
