import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Lock,
  Save,
  UserPlus,
  ArrowLeft,
  Store,
  Phone,
  Info,
  Check,
  BookOpen,
  Headphones,
  Scale,
} from 'lucide-react';
import { mockStore } from '../store/mockStore.ts';
import { calculateAge } from '../utils/casework.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const RegisterBeneficiaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { requireStaffAction, staffUser, role } = useAuth();

  const [beneficiaryId, setBeneficiaryId] = useState('BEN-8842');
  const [dob, setDob] = useState('2025-06-18');
  const [gender, setGender] = useState<'female' | 'male' | 'other'>('female');
  const [category, setCategory] = useState<'pregnant' | 'lactating' | 'child_under_6' | 'adolescent'>('child_under_6');
  const [caregiverKinship, setCaregiverKinship] = useState('Mother');
  const [centreCode, setCentreCode] = useState(staffUser?.centreCode || 'AWC-702');
  const [birthWeight, setBirthWeight] = useState('2.90');
  const [deliveryType, setDeliveryType] = useState<'institutional' | 'home'>('institutional');
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const calculatedAge = calculateAge(dob, undefined, category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireStaffAction('register real or new beneficiaries into the registry')) {
      return;
    }
    const result = mockStore.addBeneficiary(
      {
        dob,
        gender: gender === 'female' ? 'Female' : gender === 'male' ? 'Male' : 'Other',
        caregiverKinship,
        category,
        centreCode,
        birthWeight: parseFloat(birthWeight) || 2.9,
        customId: beneficiaryId,
        assignedAww: staffUser?.id || 'AWW-409',
      },
      { actorId: staffUser?.id || 'AWW-409', role: role || 'AWW' }
    );

    if (result.error) {
      showToast('Registration Blocked', result.error, 'error');
      return;
    }

    setRegisteredId(result.id);
    showToast(
      'Registration Successful',
      `Beneficiary ${result.id} registered into ${centreCode} database. Age: ${calculatedAge.ageDisplay} (${calculatedAge.completedMonths}m).`,
      'success'
    );

    const rand = Math.floor(1000 + Math.random() * 9000);
    setBeneficiaryId(`BEN-${rand}`);
  };

  const handleSaveDraft = () => {
    showToast(
      'Draft Retained',
      'All currently keyed field parameters stored in browser local state.',
      'info'
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Context Area */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider mb-1">
            <Link to="/" className="hover:text-[#2457F5] transition-colors">Home</Link>
            <span>&gt;</span>
            <Link to="/dashboard" className="hover:text-[#2457F5] transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-semibold">Beneficiary Registration</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#0F172A]">
            Register Beneficiary
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl font-normal leading-relaxed">
            Record frontline beneficiary attributes to initiate growth faltering alerts, supplementary nutrition rations, and timely clinical follow-ups.
          </p>
        </div>

        {/* Mode Badge & Quick Stat Pill */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2457F5]" />
            <span>Form Mode: New Record (Demo)</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CFEFD8]/60 text-slate-800 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            AWW Desk #04
          </div>
        </div>
      </section>

      {/* 2. Privacy & Demo Safety Banner */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2457F5] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-[#0F172A]">
              National Privacy Sandbox • Academic Simulation
            </h2>
            <p className="text-xs text-slate-500">
              Use synthetic demo data only. Do not input real citizen Aadhaar or PII. Not synchronized with live MoWCD Poshan Tracker servers.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium shrink-0">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Zero Data Duplication Protected</span>
        </div>
      </section>

      {/* 3. Form Workspace: Asymmetric High-Efficiency Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Primary Data Entry Stack (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* SECTION 1: Personal Details */}
          <article className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[#0F172A]">Personal Details</h2>
                  <p className="text-xs text-slate-400">Core biological, biological age, and identity attributes</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#2457F5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Required Section
              </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Beneficiary ID Readonly Placeholder */}
              <div className="md:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">System Beneficiary Identifier (identity token)</label>
                  <span className="text-slate-400 font-mono text-[11px]">Auto-Generated Token</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    className="w-full bg-slate-50 font-mono font-medium text-[#2457F5] px-3.5 py-2.5 rounded-xl border border-slate-200 cursor-not-allowed"
                    readOnly
                    type="text"
                    value={beneficiaryId}
                  />
                  <span className="absolute right-3 px-2 py-0.5 rounded bg-blue-100 text-[#2457F5] text-[10px] uppercase font-mono">
                    Simulated UUID
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Unique cryptographic reference key for Anganwadi local cluster tracking.</p>
              </div>

              {/* Demographic Category */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Target Beneficiary Category <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] cursor-pointer"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  required
                >
                  <option value="child_under_6">Child (0–59 months)</option>
                  <option value="pregnant">Pregnant Woman (PW)</option>
                  <option value="lactating">Lactating Mother (LM)</option>
                  <option value="adolescent">Adolescent Girl (AG)</option>
                </select>
              </div>

              {/* Date of Birth */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-[#1F8A83] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Age: {calculatedAge.ageDisplay} ({calculatedAge.cohortLabel})
                  </span>
                </div>
                <input
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83]"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                  type="date"
                />
              </div>

              {/* Gender Radio Segment */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700">Gender Identity <span className="text-rose-500">*</span></span>
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  {(['female', 'male', 'other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                        gender === g
                          ? 'bg-white text-[#0E1B2B] shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caregiver Kinship */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Primary Caregiver Kinship <span className="text-rose-500">*</span>
                </label>
                <select
                  value={caregiverKinship}
                  onChange={(e) => setCaregiverKinship(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] cursor-pointer"
                >
                  <option>Mother</option>
                  <option>Father</option>
                  <option>Grandmother</option>
                  <option>Legal Guardian</option>
                </select>
              </div>
            </div>
          </article>

          {/* SECTION 2: Contact & Location */}
          <article className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[#0F172A]">Contact & Location</h2>
                  <p className="text-xs text-slate-400">Administrative jurisdiction and Anganwadi catchment zone</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Catchment Synced
              </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Anganwadi Centre (AWC Code) <span className="text-rose-500">*</span></label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] cursor-pointer"
                  value={centreCode}
                  onChange={(e) => setCentreCode(e.target.value)}
                >
                  <option value="AWC-702">AWC-702 (Varanasi Sector 4)</option>
                  <option value="AWC-703">AWC-703 (Varanasi Sector 4)</option>
                  <option value="AWC-704">AWC-704 (Varanasi Sector 4)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Assigned Field Worker (AWW) <span className="text-rose-500">*</span></label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono"
                  readOnly
                  type="text"
                  value={staffUser?.id || 'AWW-409'}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Sector Jurisdiction</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono"
                  readOnly
                  type="text"
                  value="Sector-4 (Kashi Gramin)"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">ICDS Project Scope</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono"
                  readOnly
                  type="text"
                  value="Project-Central (Varanasi District)"
                />
              </div>
            </div>
          </article>

          {/* SECTION 3: Beneficiary Category & Dynamic Sub-Form */}
          <article className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[#0F172A]">Beneficiary Category</h2>
                  <p className="text-xs text-slate-400">Poshan 2.0 nutrition tracking protocol classification</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">Select one archetype</span>
            </header>

            {/* Radio Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'pregnant',
                  title: 'Pregnant Woman',
                  desc: 'Prenatal checkups, IFA tablets, and maternal weight gain curves.',
                },
                {
                  id: 'lactating',
                  title: 'Lactating Mother',
                  desc: '0-6 months postpartum nutrition, colostrum feeds & THR supply.',
                },
                {
                  id: 'child_under_6',
                  title: 'Child under 6 years',
                  desc: 'WHO growth chart tracking, SAM/MAM screening & immunization.',
                  badge: 'Active Profile',
                },
                {
                  id: 'adolescent',
                  title: 'Adolescent Girl (SAG)',
                  desc: 'Anemia reduction, WIFS supplementation & life skills training.',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setCategory(opt.id as any)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    category === opt.id
                      ? 'bg-blue-50/50 border-[#2457F5] shadow-sm'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-xs text-[#0F172A] flex items-center gap-2">
                      <span>{opt.title}</span>
                      {opt.badge && (
                        <span className="text-[10px] bg-blue-100 text-[#2457F5] px-2 py-0.5 rounded-full font-mono font-medium">
                          {opt.badge}
                        </span>
                      )}
                    </h3>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      category === opt.id ? 'border-[#2457F5] bg-[#2457F5] text-white' : 'border-slate-300'
                    }`}>
                      {category === opt.id && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{opt.desc}</p>
                </div>
              ))}
            </div>

            {/* Dynamic Child Fields */}
            {category === 'child_under_6' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-4 pt-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <h4 className="font-semibold text-xs text-[#0F172A] flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-[#2457F5]" />
                    <span>Child Caregiver & Birth Biomarkers</span>
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    WHO Growth Engine Ready (Demo)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Caregiver Kinship <span className="text-rose-500">*</span></label>
                    <select
                      value={caregiverKinship}
                      onChange={(e) => setCaregiverKinship(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900"
                    >
                      <option>Mother</option>
                      <option>Father</option>
                      <option>Grandmother</option>
                      <option>Legal Guardian</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 flex justify-between">
                      <span>Birth Weight (kg) <span className="text-rose-500">*</span></span>
                      <span className="text-slate-400 font-mono text-[10px]">Normal: ≥ 2.5 kg</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        value={birthWeight}
                        onChange={(e) => setBirthWeight(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 pr-10"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-400">
                        KG
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Delivery Setting <span className="text-rose-500">*</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryType('institutional')}
                        className={`py-2 px-3 rounded-xl border text-center transition-all ${
                          deliveryType === 'institutional'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        Institutional
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('home')}
                        className={`py-2 px-3 rounded-xl border text-center transition-all ${
                          deliveryType === 'home'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        Home Delivery
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </article>

          {/* Action Buttons & Disclaimer */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
            {registeredId && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-emerald-900">
                    Beneficiary registered as {registeredId}. What would you like to do next?
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/measurements?beneficiaryId=${registeredId}`}
                    className="px-3 py-1.5 rounded-full bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition-colors"
                  >
                    + Record First Measurement
                  </Link>
                  <Link
                    to={`/beneficiaries/${registeredId}`}
                    className="px-3 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-800 font-semibold text-xs hover:bg-emerald-50 transition-colors"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register Beneficiary</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="w-full sm:w-auto px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Draft</span>
                </button>
              </div>

              <Link
                to="/beneficiaries"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 py-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Beneficiary Directory</span>
              </Link>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Demo prototype mode • Client-side validation only. Data is stored in session memory.</span>
            </div>
          </div>
        </div>

        {/* Right Column (4 Cols): Live Status Ring, SOP Card, Hosted Photo */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Live Intake Status Card with 75% SVG Ring */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Intake Validation</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">Ready</span>
            </div>

            <div className="flex items-center gap-4 py-1">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                  />
                  <path
                    className="text-[#2457F5] transition-all duration-700"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray="75, 100"
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-[#0F172A]">
                  75%
                </div>
              </div>

              <div>
                <div className="font-semibold text-xs text-[#0F172A]">3 of 4 Tiers Complete</div>
                <div className="text-[11px] text-slate-400">Caregiver vitals ready for synchronization</div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Biological UID</span>
                <span className="font-mono text-[#2457F5] font-semibold">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AWC Geo-Allocation</span>
                <span className="text-slate-700 font-medium">Assigned</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Growth Anthropometry</span>
                <span className="text-emerald-600 font-semibold">Active Mode</span>
              </div>
            </div>
          </div>

          {/* Field Operational Protocol Helper Card */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2457F5]" />
              <h3 className="font-semibold text-xs text-[#0F172A]">Anganwadi Field SOP</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Under National Nutrition Mission mandate, every infant entry automatically initiates:
            </p>
            <ul className="space-y-2 text-[11px] text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Monthly Stunting Log:</strong> Infant height board assessment scheduled every 30 days.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Wasting (Weight-for-Height):</strong> Salter scale or infant hanging balance calibration.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Take-Home Ration (THR):</strong> Micronutrient fortified porridge ration allotment token.</span>
              </li>
            </ul>
          </div>

          {/* Field Worker Photo Dispatch Preview (Hosted photo with Illustrative image caption) */}
          <div className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-4 shadow-sm space-y-2">
            <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80"
                alt="Indian community health worker gently weighing infant at rural anganwadi center"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-3 text-white">
                <div>
                  <span className="text-[10px] text-emerald-300 font-semibold block">AWC #702 Kashi Gramin (demo)</span>
                  <span className="text-xs font-semibold">Field Anthropometry Desk</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>Ensure scale zeroed at 0.00 kg before weighing.</span>
              <span className="font-medium text-slate-500 italic">Illustrative image</span>
            </div>
          </div>

          {/* Quick Assistance Card */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Headphones className="w-5 h-5 text-[#2457F5] shrink-0" />
              <div>
                <div className="text-xs font-semibold text-[#0F172A]">Sector Supervisor Help</div>
                <div className="text-[10px] text-slate-400">Toll-free 00000 assistance (demo)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => showToast('Help Desk connected', 'Connected to Varanasi District POSHAN Mission Cell (+91 00000 00000 demo)', 'info')}
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-[11px] font-semibold"
            >
              Contact
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
};
