import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Lock,
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
import { calculateAge, getTodayISODate } from '../utils/casework.ts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const CANONICAL_CENTRES = ['AWC-702', 'AWC-703', 'AWC-704', 'AWC-705', 'AWC-706'];

export const RegisterBeneficiaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { requireStaffAction, staffUser, role } = useAuth();

  const assignedCentre = staffUser?.centreCode || 'AWC-702';
  const [centreCode, setCentreCode] = useState(assignedCentre);
  const [category, setCategory] = useState<'pregnant' | 'lactating' | 'child_under_6' | 'adolescent'>('child_under_6');
  const [dob, setDob] = useState('2025-06-18');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [caregiverKinship, setCaregiverKinship] = useState('Mother');
  const [birthWeight, setBirthWeight] = useState('');
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const calculatedAge = calculateAge(
    dob,
    getTodayISODate(),
    category,
    gender,
  );

  const handleCategoryChange = (nextCategory: typeof category) => {
    setCategory(nextCategory);
    if (nextCategory === 'pregnant' || nextCategory === 'lactating') {
      setGender('Female');
      setCaregiverKinship('Self');
    } else if (nextCategory === 'adolescent') {
      setGender('Female');
      if (caregiverKinship === 'Self') {
        setCaregiverKinship('Mother');
      }
    } else {
      if (caregiverKinship === 'Self') {
        setCaregiverKinship('Mother');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireStaffAction('register real or new beneficiaries into the registry')) {
      return;
    }

    const effectiveCentre = role === 'AWW' ? assignedCentre : centreCode;

    const result = mockStore.addBeneficiary(
      {
        dob,
        gender,
        caregiverKinship: (category === 'pregnant' || category === 'lactating') ? 'Self' : caregiverKinship,
        category,
        centreCode: effectiveCentre,
        birthWeight: category === 'child_under_6' ? Number(birthWeight) : undefined,
        assignedAww: staffUser?.id || 'AWW-409',
      },
      {
        actorId: staffUser?.id || 'AWW-409',
        role: role || 'AWW',
        centreCode: effectiveCentre,
      }
    );

    if (result.error) {
      showToast('Registration Blocked', result.error, 'error');
      return;
    }

    setRegisteredId(result.id);
    showToast(
      'Registration Successful',
      `Beneficiary ${result.id} registered into ${effectiveCentre} registry. Age: ${calculatedAge.ageDisplay}.`,
      'success'
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
            Register Beneficiary
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl font-normal leading-relaxed">
            Record frontline beneficiary attributes to initiate growth tracking, supplementary nutrition rations, and timely clinical follow-ups.
          </p>
        </div>

        {/* Mode Badge & Quick Stat Pill */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2457F5]" />
            <span>New Registration</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CFEFD8]/60 text-slate-800 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {role === 'AWW' ? `Assigned to ${assignedCentre}` : 'Supervisory Desk'}
          </div>
        </div>
      </section>

      {/* 2. Form Workspace */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Primary Data Entry Stack (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* SECTION 1: Category Selection */}
          <article className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Beneficiary Category</h2>
                  <p className="text-xs text-slate-400">Select the Poshan 2.0 beneficiary archetype</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#2457F5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Required
              </span>
            </header>

            {/* Radio Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'child_under_6',
                  title: 'Child under 6 years',
                  desc: 'WHO growth chart tracking, SAM/MAM screening & immunization.',
                },
                {
                  id: 'pregnant',
                  title: 'Pregnant Woman',
                  desc: 'Prenatal checkups, IFA tablets, and maternal weight gain curves.',
                },
                {
                  id: 'lactating',
                  title: 'Lactating Mother',
                  desc: '0-6 months postpartum nutrition, infant feeding & THR supply.',
                },
                {
                  id: 'adolescent',
                  title: 'Adolescent Girl (SAG)',
                  desc: 'Anemia reduction, WIFS supplementation & life skills education.',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={category === opt.id}
                  onClick={() => handleCategoryChange(opt.id as typeof category)}
                  className={`w-full p-4 rounded-2xl border text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] transition-all ${
                    category === opt.id
                      ? 'bg-blue-50/50 border-[#2457F5] shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-xs text-[#0F172A] flex items-center gap-2">
                      <span>{opt.title}</span>
                    </h3>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      category === opt.id ? 'border-[#2457F5] bg-[#2457F5] text-white' : 'border-slate-300'
                    }`}>
                      {category === opt.id && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </article>

          {/* SECTION 2: Personal Details */}
          <article className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Personal & Biological Details</h2>
                  <p className="text-xs text-slate-400">Date of birth, biological sex, and primary caregiver relationship</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#2457F5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Required
              </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Date of Birth */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-[#1F8A83] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Age: {calculatedAge.ageDisplay}
                  </span>
                </div>
                <input
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83]"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                  type="date"
                  max={getTodayISODate()}
                />
              </div>

              {/* Gender Radio Segment */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700">
                  Gender <span className="text-rose-500">*</span>
                </span>
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  {(['Female', 'Male', 'Other'] as const).map((g) => {
                    const isLockedToFemale = category !== 'child_under_6' && g !== 'Female';
                    return (
                      <button
                        key={g}
                        type="button"
                        disabled={isLockedToFemale}
                        aria-pressed={gender === g}
                        onClick={() => setGender(g)}
                        className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                          gender === g
                            ? 'bg-white text-[#0E1B2B] shadow-xs'
                            : isLockedToFemale
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
                {category !== 'child_under_6' && (
                  <p className="text-[10px] text-slate-400">Gender is set to Female for this category.</p>
                )}
              </div>

              {/* Caregiver Kinship */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Primary Caregiver Kinship <span className="text-rose-500">*</span>
                </label>
                {(category === 'pregnant' || category === 'lactating') ? (
                  <input
                    type="text"
                    readOnly
                    value="Self (Beneficiary)"
                    className="w-full bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-700 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={caregiverKinship}
                    onChange={(e) => setCaregiverKinship(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] cursor-pointer"
                  >
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Grandmother">Grandmother</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                    {category === 'adolescent' && <option value="Self">Self</option>}
                  </select>
                )}
              </div>

              {/* Birth Weight (Children Under 6 Only) */}
              {category === 'child_under_6' && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 flex justify-between">
                    <span>Birth Weight (kg) <span className="text-rose-500">*</span></span>
                    <span className="text-slate-400 font-mono text-[10px]">Normal: ≥ 2.5 kg</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="10"
                      required
                      value={birthWeight}
                      onChange={(e) => setBirthWeight(e.target.value)}
                      placeholder="e.g. 2.85"
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 pr-10 focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83]"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-400">
                      KG
                    </span>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* SECTION 3: Administrative Location & Assignment */}
          <article className="bg-[#E8F2FC] rounded-2xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs space-y-6">
            <header className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Administrative Location</h2>
                  <p className="text-xs text-slate-400">Anganwadi Centre catchment zone assignment</p>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Anganwadi Centre (AWC Code) <span className="text-rose-500">*</span></label>
                {role === 'AWW' ? (
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={assignedCentre}
                      className="w-full bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-800 font-mono font-semibold cursor-not-allowed"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Locked to assigned worker centre.</span>
                  </div>
                ) : (
                  <select
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] cursor-pointer"
                    value={centreCode}
                    onChange={(e) => setCentreCode(e.target.value)}
                  >
                    {CANONICAL_CENTRES.map((centre) => (
                      <option key={centre} value={centre}>
                        {centre} (Varanasi Sector {['AWC-702', 'AWC-703', 'AWC-704'].includes(centre) ? '4' : '5'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Assigned Field Worker (AWW) <span className="text-rose-500">*</span></label>
                <input
                  className="w-full bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono"
                  readOnly
                  type="text"
                  value={staffUser?.id || 'AWW-409'}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Sector Jurisdiction</label>
                <input
                  className="w-full bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono"
                  readOnly
                  type="text"
                  value={['AWC-705', 'AWC-706'].includes(role === 'AWW' ? assignedCentre : centreCode) ? 'Sector-5' : 'Sector-4 (Kashi Gramin)'}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">ICDS Project Scope</label>
                <input
                  className="w-full bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl text-slate-900 font-mono"
                  readOnly
                  type="text"
                  value="Project-Central (Varanasi District)"
                />
              </div>
            </div>
          </article>

          {/* Action Buttons & Confirmation */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            {registeredId && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-emerald-900">
                    Beneficiary registered as {registeredId}.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {category === 'child_under_6' && (
                    <Link
                      to={`/measurements?beneficiaryId=${registeredId}`}
                      className="px-3 py-1.5 rounded-full bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition-colors"
                    >
                      + Record First Measurement
                    </Link>
                  )}
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
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register Beneficiary</span>
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
              <span>Client-side validation active. Records are saved to the local session registry.</span>
            </div>
          </div>
        </div>

        {/* Right Column (4 Cols): Registration Context */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Registration Context</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold">Active Session</span>
            </div>
            <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned AWW</span>
                <span className="font-mono text-[#2457F5] font-semibold">{staffUser?.id || 'AWW-409'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Centre</span>
                <span className="text-slate-700 font-medium">{role === 'AWW' ? assignedCentre : centreCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registration Date</span>
                <span className="text-slate-700 font-medium">{getTodayISODate()}</span>
              </div>
            </div>
          </div>

          {/* Field Operational Protocol Helper Card */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2457F5]" />
              <h3 className="font-semibold text-xs text-[#0F172A]">Anganwadi Field SOP</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Infant entry initiates standard monitoring protocols:
            </p>
            <ul className="space-y-2 text-[11px] text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Monthly Stunting Log:</strong> Infant height board assessment scheduled every 30 days.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Wasting Assessment:</strong> Weight-for-Height evaluation against WHO growth standards.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Take-Home Ration (THR):</strong> Micronutrient fortified supplementary nutrition ration allotment.</span>
              </li>
            </ul>
          </div>
        </aside>
      </form>
    </div>
  );
};
