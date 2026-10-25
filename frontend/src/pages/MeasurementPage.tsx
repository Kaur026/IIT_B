import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale,
  Ruler,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  User,
  ArrowLeft,
  Info,
  Check,
  Sparkles,
  FileText,
  AlertCircle,
  HelpCircle,
  Clock,
  ListTodo,
} from 'lucide-react';
import { mockStore, BeneficiaryRecord, DEMO_TODAY } from '../store/mockStore.ts';
import { calculateAge, evaluateMeasurementEntry, getDaysBetween } from '../utils/casework.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../utils/permissions.ts';

export const MeasurementPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { requireStaffAction, staffUser, role } = useAuth();

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRecord[]>([]);
  const [selectedBenId, setSelectedBenId] = useState<string>('BEN-0142');

  // Form Fields
  const [weightKg, setWeightKg] = useState('8.90');
  const [heightCm, setHeightCm] = useState('77.5');
  const [measurementDate, setMeasurementDate] = useState(DEMO_TODAY);
  const [posture, setPosture] = useState<'recumbent' | 'standing'>('recumbent');
  const [muacCm, setMuacCm] = useState('14.2');
  const [hasEdema, setHasEdema] = useState(false);
  const [notes, setNotes] = useState('Monthly anthropometric monitoring at centre.');
  const [tareZeroed, setTareZeroed] = useState(true);
  const [shoesRemoved, setShoesRemoved] = useState(true);

  useEffect(() => {
    const list = mockStore.getBeneficiaries({ role, centreCode: staffUser?.centreCode });
    setBeneficiaries(list);

    // Read query parameter ?beneficiaryId=BEN-xxxx
    const params = new URLSearchParams(location.search);
    const queryId = params.get('beneficiaryId');
    if (queryId && list.some((b) => b.id === queryId)) {
      setSelectedBenId(queryId);
    }

    const unsubscribe = mockStore.subscribe(() => {
      setBeneficiaries(mockStore.getBeneficiaries({ role, centreCode: staffUser?.centreCode }));
    });
    return unsubscribe;
  }, [location.search, role, staffUser]);

  const selectedBeneficiary = beneficiaries.find((b) => b.id === selectedBenId) || beneficiaries[0];

  // Dynamic age of selected child
  const childAge = selectedBeneficiary
    ? calculateAge(selectedBeneficiary.dob, measurementDate, selectedBeneficiary.category)
    : null;

  // Previous measurement for comparison
  const previousRecord = selectedBeneficiary
    ? {
        weight: selectedBeneficiary.lastWeight || selectedBeneficiary.birthWeight,
        height: selectedBeneficiary.lastHeight || 50.0,
        date: selectedBeneficiary.lastMeasurementDate || selectedBeneficiary.registrationDate,
      }
    : undefined;

  // Set recommended posture on child change
  useEffect(() => {
    if (childAge) {
      setPosture(childAge.recommendedMeasurementPosture);
    }
  }, [selectedBenId]);

  // Live evaluation against active screening rules
  const numWeight = parseFloat(weightKg) || 0;
  const numHeight = parseFloat(heightCm) || 0;
  const numMuac = parseFloat(muacCm) || undefined;

  const evaluation = selectedBeneficiary && numWeight > 0 && numHeight > 0
    ? evaluateMeasurementEntry({
        currentWeight: numWeight,
        currentHeight: numHeight,
        measurementDate,
        dob: selectedBeneficiary.dob,
        previousRecord,
        muacCm: numMuac,
        hasBilateralEdema: hasEdema,
        customRules: mockStore.getRules(),
      })
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!requireStaffAction('record frontline anthropometric intake')) {
      return;
    }

    if (role && !canPerformAction(role, 'record_measurement')) {
      showToast('Permission Restricted', `Role ${role} cannot record anthropometric measurements directly.`, 'error');
      return;
    }

    if (!selectedBeneficiary) {
      showToast('Error', 'Please select a beneficiary.', 'error');
      return;
    }

    if (!tareZeroed) {
      showToast('Protocol Verification Required', 'Confirm scale tare is zeroed (0.00 kg) before submitting.', 'warning');
      return;
    }

    const actorId = staffUser?.id || 'AWW-409';
    const result = mockStore.recordMeasurement(
      {
        beneficiaryId: selectedBeneficiary.id,
        weightKg: numWeight,
        heightCm: numHeight,
        measurementDate,
        posture,
        muacCm: numMuac,
        hasEdema,
        notes,
        actor: actorId,
      },
      { actorId, role }
    );

    if (!result.success) {
      showToast('Validation Blocked', result.error || 'Invalid measurement values.', 'error');
      return;
    }

    if (result.caseCreated) {
      showToast(
        'Measurement Logged & Anomaly Flagged',
        `Recorded ${numWeight.toFixed(2)} kg / ${numHeight.toFixed(1)} cm. Case ${result.caseCreated} added to Action Queue.`,
        'warning'
      );
    } else {
      showToast(
        'Measurement Successfully Recorded',
        `Logged verified milestone for ${selectedBeneficiary.id} (${numWeight.toFixed(2)} kg / ${numHeight.toFixed(1)} cm).`,
        'success'
      );
    }

    navigate(`/beneficiaries/${selectedBeneficiary.id}`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Breadcrumb */}
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
            <span className="text-slate-800 font-semibold">Screening & Anthropometry</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Growth Measurement & Screening Intake
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
            Record monthly weight, height, and MUAC measurements. Deterministic demo rules check implausible changes; live AI assistance is not connected yet.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Link
            to="/queue"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5"
          >
            <ListTodo className="w-3.5 h-3.5 text-[#2457F5]" />
            <span>Action Queue ({mockStore.getCases().filter((c) => !c.isVerified).length})</span>
          </Link>
        </div>
      </motion.div>

      {/* 2. Primary Form Grid (8 Cols Form + 4 Cols Live Preview & SOP) */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Form (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section A: Beneficiary Selection & Context */}
          <article className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-7 shadow-sm space-y-5">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A]">Select Beneficiary</h2>
                  <p className="text-[11px] text-slate-400">Choose child or mother for monthly anthropometric intake</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#2457F5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                AWC #702 Active Cohort
              </span>
            </header>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Choose Beneficiary Record</label>
                <select
                  value={selectedBenId}
                  onChange={(e) => setSelectedBenId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 focus:border-[#2457F5] cursor-pointer"
                >
                  {beneficiaries.map((b) => {
                    const age = calculateAge(b.dob, undefined, b.category);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.id} • {age.ageDisplay} • Caregiver: {b.caregiverKinship} • Centre: {b.centreCode}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedBeneficiary && childAge && (
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Beneficiary & Centre</span>
                    <span className="font-semibold text-slate-900 font-mono">{selectedBeneficiary.id}</span>
                    <span className="text-slate-500 text-[11px] block">{selectedBeneficiary.dob} • {selectedBeneficiary.centreCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Current Age & Cohort</span>
                    <span className="font-semibold text-[#2457F5]">{childAge.ageDisplay}</span>
                    <span className="text-slate-500 text-[11px] block">{childAge.cohortLabel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Prior Reading</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {previousRecord?.weight.toFixed(2)} kg • {previousRecord?.height.toFixed(1)} cm
                    </span>
                    <span className="text-slate-400 text-[11px] block">{previousRecord?.date}</span>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* Section B: Biometric Measurements */}
          <article className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-7 shadow-sm space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A]">Anthropometric Measurements</h2>
                  <p className="text-[11px] text-slate-400">Record current weight, stature, and screening indicators</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Calibrated Scale Mode
              </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Measurement Date */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex justify-between">
                  <span>Measurement Date <span className="text-rose-500">*</span></span>
                  <span className="text-slate-400 text-[10px]">Demo baseline: 24 Oct 2026</span>
                </label>
                <input
                  type="date"
                  value={measurementDate}
                  onChange={(e) => setMeasurementDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30"
                  required
                />
              </div>

              {/* Measurement Posture */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex justify-between">
                  <span>Stature Position <span className="text-rose-500">*</span></span>
                  <span className="text-[#2457F5] text-[10px]">
                    {childAge?.completedMonths && childAge.completedMonths < 24 ? '< 24m: Recumbent' : '>= 24m: Standing'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPosture('recumbent')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      posture === 'recumbent'
                        ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Recumbent Length (Board)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosture('standing')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      posture === 'standing'
                        ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Standing Height (Stadiometer)
                  </button>
                </div>
              </div>

              {/* Weight (kg) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex justify-between">
                  <span>Weight (kg) <span className="text-rose-500">*</span></span>
                  <span className="text-slate-400 font-mono text-[10px]">Precision: 0.05 kg</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="45.0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 8.90"
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 pr-12"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-400">
                    KG
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Prior weight: <span className="font-mono font-medium text-slate-600 tabular-nums">{previousRecord?.weight.toFixed(2)} kg</span> <span className="tabular-nums">({previousRecord?.date})</span>
                </p>
              </div>

              {/* Height / Length (cm) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex justify-between">
                  <span>Height / Length (cm) <span className="text-rose-500">*</span></span>
                  <span className="text-slate-400 font-mono text-[10px]">Precision: 0.1 cm</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="35.0"
                    max="140.0"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="e.g. 77.5"
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 pr-12 tabular-nums"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-400">
                    CM
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Prior height: <span className="font-mono font-medium text-slate-600 tabular-nums">{previousRecord?.height.toFixed(1)} cm</span> <span className="tabular-nums">({previousRecord?.date})</span>
                </p>
              </div>

              {/* MUAC (cm) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex justify-between">
                  <span>Mid-Upper Arm Circumference (MUAC)</span>
                  <span className="text-slate-400 font-mono text-[10px]">Optional (6–59m)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="8.0"
                    max="22.0"
                    value={muacCm}
                    onChange={(e) => setMuacCm(e.target.value)}
                    placeholder="e.g. 13.8"
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-400">
                    CM
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] pt-0.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  <span className="text-slate-500">&lt;11.5cm (SAM)</span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block ml-1" />
                  <span className="text-slate-500">11.5–12.5cm (MAM)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-1" />
                  <span className="text-slate-500">&gt;12.5cm Normal</span>
                </div>
              </div>

              {/* Bilateral Edema Checkbox */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Bilateral Pitting Edema</label>
                <div
                  onClick={() => setHasEdema(!hasEdema)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                    hasEdema
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasEdema}
                      onChange={() => {}}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold text-xs">
                      {hasEdema ? 'Bilateral Edema Detected (Kwashiorkor Alert)' : 'No Edema Present (Normal)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Thumb pressure test</span>
                </div>
              </div>

              {/* Notes */}
              <div className="md:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700">Clinical / Field Observation Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record child appetite, fever history, weighing conditions..."
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30"
                />
              </div>
            </div>
          </article>

          {/* Section C: Field Protocol & Tare Verification */}
          <article className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-xs text-[#0F172A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2457F5]" />
              <span>Standard Operating Procedure (SOP) Checklist</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tareZeroed}
                  onChange={(e) => setTareZeroed(e.target.checked)}
                  className="rounded text-[#2457F5] focus:ring-[#2457F5]"
                />
                <span className="text-slate-700 font-medium">Spring/digital scale calibrated at 0.00 kg</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shoesRemoved}
                  onChange={(e) => setShoesRemoved(e.target.checked)}
                  className="rounded text-[#2457F5] focus:ring-[#2457F5]"
                />
                <span className="text-slate-700 font-medium">Footwear, socks, and heavy clothing removed</span>
              </label>
            </div>
          </article>

          {/* Action Buttons */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Submit & Record Measurement</span>
            </button>

            <Link
              to={selectedBeneficiary ? `/beneficiaries/${selectedBeneficiary.id}` : '/beneficiaries'}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 py-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cancel / Back to Profile</span>
            </Link>
          </div>
        </div>

        {/* Right: Live Plausibility Analysis & Anomaly Preview (4 Cols) */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Live Plausibility Analysis Card */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Rule-Based Demo Screening
              </span>
              {evaluation?.flags.length === 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                  Plausible
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-semibold">
                  {evaluation?.flags.length} Anomaly Flags
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              Suggested actions come from deterministic demo rules and require human review. They are not diagnoses.
            </p>

            {/* Delta metrics */}
            {evaluation && (
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Elapsed Time</span>
                  <span className="font-medium text-slate-800">{evaluation.daysElapsed} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Weight Delta</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {evaluation.weightDeltaKg > 0 ? `+${evaluation.weightDeltaKg}` : evaluation.weightDeltaKg} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Velocity Rate</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {evaluation.velocityPerMonthKg > 0 ? `+${evaluation.velocityPerMonthKg}` : evaluation.velocityPerMonthKg} kg / 30d
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Height Delta</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {evaluation.heightDeltaCm > 0 ? `+${evaluation.heightDeltaCm}` : evaluation.heightDeltaCm} cm
                  </span>
                </div>
              </div>
            )}

            {/* List of Active Heuristic Flags */}
            {evaluation && evaluation.flags.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Triggers Activated:</span>
                </div>
                {evaluation.flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      flag.type === 'clinical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px]">{flag.name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full font-semibold border bg-white">
                        {flag.type === 'data_quality' ? 'Data Quality Warning' : 'Clinical Malnutrition'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">{flag.summary}</p>
                    <p className="text-[10px] text-slate-500 italic pt-1">{flag.suggestedAction}</p>
                    <div className="text-[9px] text-slate-400 pt-0.5 font-medium">
                      (Illustrative demo rule • Demo simulation)
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Reading matches expected biological growth velocity trajectory.</span>
              </div>
            )}
          </div>

          {/* Illustrative Simulation Notice */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-5 shadow-sm space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Sparkles className="w-4 h-4 text-[#2457F5]" />
              <span>Supervisor Verification Workflow</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              When an anomaly is flagged, the original measurement is recorded in the child's audit ledger, and a task is dispatched to the Action Queue for Lady Supervisor physical re-weighing.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
};
