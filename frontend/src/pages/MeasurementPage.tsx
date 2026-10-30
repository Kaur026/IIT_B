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
import { mockStore, BeneficiaryRecord } from '../store/mockStore.ts';
import { calculateAge, evaluateMeasurementEntry, getTodayISODate } from '../utils/casework.ts';
import { runCategorySpecificScreening } from '../services/aiScreeningService.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../utils/permissions.ts';
import { isMockDemoEnabled } from '../utils/demoMode';

const MockMeasurementPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { requireStaffAction, staffUser, role } = useAuth();
  const demoScope = {
    role,
    centreCode: staffUser?.centreCode,
    sectorCode: staffUser?.sectorCode,
    projectCode: staffUser?.projectCode,
    actorId: staffUser?.id,
  };

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRecord[]>([]);
  const [selectedBenId, setSelectedBenId] = useState<string>('');
  const [beneficiarySearch, setBeneficiarySearch] = useState('');

  // Form Fields
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [measurementDate, setMeasurementDate] = useState(getTodayISODate());
  const [posture, setPosture] = useState<'recumbent' | 'standing'>('recumbent');
  const [muacCm, setMuacCm] = useState('');
  const [hasEdema, setHasEdema] = useState(false);
  const [notes, setNotes] = useState('');
  const [tareZeroed, setTareZeroed] = useState(false);
  const [shoesRemoved, setShoesRemoved] = useState(false);

  useEffect(() => {
    const list = mockStore.getBeneficiaries(demoScope);
    setBeneficiaries(list);

    // Read query parameter ?beneficiaryId=BEN-xxxx
    const params = new URLSearchParams(location.search);
    const queryId = params.get('beneficiaryId');
    if (queryId && list.some((b) => b.id === queryId)) {
      setSelectedBenId(queryId);
    } else if (!list.some((beneficiary) => beneficiary.id === selectedBenId)) {
      setSelectedBenId(list[0]?.id || '');
    }

    const unsubscribe = mockStore.subscribe(() => {
      setBeneficiaries(mockStore.getBeneficiaries(demoScope));
    });
    return unsubscribe;
  }, [location.search, role, staffUser, selectedBenId]);

  const selectedBeneficiary = beneficiaries.find((b) => b.id === selectedBenId) || beneficiaries[0];

  // Dynamic age of selected child
  const childAge = selectedBeneficiary
    ? calculateAge(selectedBeneficiary.dob, measurementDate, selectedBeneficiary.category, selectedBeneficiary.gender)
    : null;

  // Previous measurement for comparison
  const previousMeasurement = selectedBeneficiary
    ? mockStore.getMeasurements(selectedBeneficiary.id, demoScope)
      .filter((measurement) => measurement.beneficiaryId === selectedBeneficiary.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined;
  const previousRecord = previousMeasurement
    ? { weight: previousMeasurement.weightKg, height: previousMeasurement.heightCm, date: previousMeasurement.date }
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
        referenceDate: getTodayISODate(),
        dob: selectedBeneficiary.dob,
        previousRecord,
        muacCm: numMuac,
        hasBilateralEdema: hasEdema,
        customRules: mockStore.getRules(),
      })
    : null;

  const isChild = !selectedBeneficiary || selectedBeneficiary.category === 'child_under_6';
  const isAdolescent = selectedBeneficiary?.category === 'adolescent';
  const isPregnant = selectedBeneficiary?.category === 'pregnant';
  const isLactating = selectedBeneficiary?.category === 'lactating';

  const computedBmi = numWeight > 0 && numHeight > 0
    ? Number((numWeight / Math.pow(numHeight / 100, 2)).toFixed(1))
    : null;

  const aiCategoryScreening = selectedBeneficiary && numWeight > 0 && numHeight > 0
    ? runCategorySpecificScreening({
        beneficiaryId: selectedBeneficiary.id,
        category: selectedBeneficiary.category,
        dob: selectedBeneficiary.dob,
        gender: selectedBeneficiary.gender,
        currentWeightKg: numWeight,
        currentHeightCm: numHeight,
        muacCm: numMuac,
        hasBilateralEdema: hasEdema,
        birthWeightKg: selectedBeneficiary.birthWeight,
        previousRecord: previousRecord ? { weightKg: previousRecord.weight, heightCm: previousRecord.height, date: previousRecord.date } : undefined,
        measurementDate,
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
    if (!shoesRemoved) {
      showToast('Protocol Verification Required', 'Confirm the child has removed shoes before measuring stature.', 'warning');
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
            Growth Measurement & Screening Intake
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
            Record monthly weight, height, and MUAC measurements. Automated plausibility screening checks against WHO growth standards.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Link
            to="/queue"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full transition-all shadow-sm flex items-center gap-1.5"
          >
            <ListTodo className="w-3.5 h-3.5 text-[#2457F5]" />
            <span>Action Queue ({mockStore.getCases(demoScope).filter((c) => !c.isVerified).length})</span>
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
                  <h2 className="text-sm font-bold text-[#0F172A]">Select Beneficiary</h2>
                  <p className="text-[11px] text-slate-400">Step 1: Choose beneficiary record across all 6 cohorts for anthropometric intake</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#2457F5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                {staffUser?.centreCode || selectedBeneficiary?.centreCode || 'Assigned Centre'} Active Cohort
              </span>
            </header>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Choose Beneficiary Record</label>
                <input
                  type="search"
                  value={beneficiarySearch}
                  onChange={(event) => setBeneficiarySearch(event.target.value)}
                  placeholder="Search child ID, name, or centre"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30"
                />
                <select
                  value={selectedBenId}
                  onChange={(e) => setSelectedBenId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 focus:border-[#2457F5] cursor-pointer"
                >
                  {beneficiaries.filter((beneficiary) => {
                    const query = beneficiarySearch.trim().toLowerCase();
                    return !query || `${beneficiary.id} ${beneficiary.name} ${beneficiary.centreCode}`.toLowerCase().includes(query);
                  }).map((b) => {
                    const age = calculateAge(b.dob, undefined, b.category, b.gender);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.id} • {b.name} • {age.ageDisplay} • Centre: {b.centreCode}
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
                      {previousRecord ? `${previousRecord.weight.toFixed(2)} kg • ${previousRecord.height.toFixed(1)} cm` : 'No prior reading recorded'}
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
                  <h2 className="text-sm font-bold text-[#0F172A]">Anthropometric Measurements</h2>
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
                  <span className="text-slate-400 text-[10px]">Current date</span>
                </label>
                <input
                  type="date"
                  value={measurementDate}
                  max={getTodayISODate()}
                  onChange={(e) => setMeasurementDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30"
                  required
                />
              </div>

              {/* Stature Position (Children only) OR Adult / SAG Height Indicator */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex justify-between">
                  <span>{isChild ? 'Stature Position' : 'Protocol Posture'} <span className="text-rose-500">*</span></span>
                  <span className="text-[#2457F5] text-[10px] font-semibold">
                    {isChild
                      ? (childAge?.completedMonths && childAge.completedMonths < 24 ? '< 24m: Recumbent Length' : '>= 24m: Standing Height')
                      : 'Stadiometer Standing Height'}
                  </span>
                </label>
                {isChild ? (
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
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">Standing Stadiometer Standard</span>
                    {computedBmi && (
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                        computedBmi < 18.5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Live BMI: {computedBmi}
                      </span>
                    )}
                  </div>
                )}
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
                    min={isChild ? "1.0" : "25.0"}
                    max={isChild ? "45.0" : "160.0"}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder={isChild ? "e.g. 8.90" : "e.g. 52.50"}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 pr-12"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-400">
                    KG
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Prior weight: <span className="font-mono font-medium text-slate-600 tabular-nums">{previousRecord ? `${previousRecord.weight.toFixed(2)} kg (${previousRecord.date})` : 'No prior reading recorded'}</span>
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
                    min={isChild ? "35.0" : "90.0"}
                    max={isChild ? "140.0" : "210.0"}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder={isChild ? "e.g. 77.5" : "e.g. 154.0"}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2457F5]/30 pr-12 tabular-nums"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-400">
                    CM
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Prior height: <span className="font-mono font-medium text-slate-600 tabular-nums">{previousRecord ? `${previousRecord.height.toFixed(1)} cm (${previousRecord.date})` : 'No prior reading recorded'}</span>
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

              {/* Bilateral Edema (Children) OR Specialized Cohort Checkpoint */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  {isChild
                    ? 'Bilateral Pitting Edema'
                    : isPregnant
                    ? 'ANC Gestational Health Status'
                    : isAdolescent
                    ? 'SAG Wellbeing & WIFS Compliance'
                    : 'Postnatal Nutrition Support'}
                </label>
                {isChild ? (
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
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                    <span>
                      {isPregnant
                        ? 'Prenatal ANC Visit Rations & IFA Regular'
                        : isAdolescent
                        ? 'Weekly Iron Folic Acid (WIFS) Dispensed'
                        : 'Postnatal THR & Breastfeeding Counselling'}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Standard Intake
                    </span>
                  </div>
                )}
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
                Automated Plausibility Screening
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
              Suggested actions come from deterministic plausibility rules and require human review. They are not clinical diagnoses.
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Reading matches expected biological growth velocity trajectory.</span>
              </div>
            )}

            {/* AI Protocol Next Action */}
            {aiCategoryScreening && (
              <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#2457F5]" />
                    <span>AI Suggested Action</span>
                  </span>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200">
                    {aiCategoryScreening.suggestedNextAction.priority}
                  </span>
                </div>
                <p className="text-[11px] text-blue-950 font-medium leading-relaxed">
                  {aiCategoryScreening.suggestedNextAction.actionText}
                </p>
                <div className="text-[10px] text-blue-600 font-mono">
                  Role: {aiCategoryScreening.suggestedNextAction.targetRole} · Protocol Simulation
                </div>
              </div>
            )}

            {/* Informational notice: no prior measurement history */}
            {evaluation && evaluation.infoNotes && evaluation.infoNotes.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {evaluation.infoNotes.map((note, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-1 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-[11px] mb-0.5">{note.name}</div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">{note.summary}</p>
                      <p className="text-[10px] text-blue-600 italic pt-1">{note.suggestedAction}</p>
                    </div>
                  </div>
                ))}
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

export const MeasurementPage: React.FC = () => {
  const { supabaseSession, authInitializing } = useAuth();
  if (authInitializing) {
    return <section role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Checking signed-in account…</section>;
  }
  if (supabaseSession) {
    return <section className="rounded-3xl border border-amber-200 bg-white p-6" aria-labelledby="measurement-access-title">
      <h1 id="measurement-access-title" className="text-xl font-semibold text-slate-900">Mock measurements unavailable for provider sessions</h1>
      <p className="mt-2 text-sm text-slate-600">This frontend demo reads and writes only browser-local synthetic records; it does not request or submit measurement data to an external service.</p>
    </section>;
  }
  if (isMockDemoEnabled(import.meta.env)) {
    return <MockMeasurementPage />;
  }
  return <section className="rounded-3xl border border-amber-200 bg-white p-6" aria-labelledby="measurement-access-title">
    <h1 id="measurement-access-title" className="text-xl font-semibold text-slate-900">Mock measurements unavailable</h1>
    <p className="mt-2 text-sm text-slate-600">Browser-local measurement simulation is disabled in this build. No external records are loaded.</p>
    <Link to="/signin" className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Sign in</Link>
  </section>;
};
