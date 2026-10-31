import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Heart,
  Scale,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  User,
  Info,
  Apple,
  Utensils,
  Droplets,
  Award,
  ChevronRight,
  Phone,
  Home,
  Baby,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockStore, BeneficiaryRecord, MeasurementRecord, DemoHomeVisitRecord } from '../store/mockStore';
import { calculateAge, getDaysUntilDate, getTodayISODate } from '../utils/casework';

export const FamilyDashboardPage: React.FC = () => {
  const { staffUser } = useAuth();
  const location = useLocation();

  const [activeChartTab, setActiveChartTab] = useState<'weight' | 'height'>('weight');

  // Load explicitly linked child record
  const linkedIds = staffUser?.linkedBeneficiaryIds || [];
  const primaryChildId = linkedIds.length > 0 ? linkedIds[0] : undefined;

  const child: BeneficiaryRecord | undefined = primaryChildId
    ? mockStore.getBeneficiaryById(primaryChildId, {
        role: 'Parent/Family',
        linkedBeneficiaryIds: linkedIds,
      })
    : undefined;

  const measurements: MeasurementRecord[] = primaryChildId
    ? mockStore
        .getMeasurements(primaryChildId, {
          role: 'Parent/Family',
          linkedBeneficiaryIds: linkedIds,
        })
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    : [];

  const homeVisits: DemoHomeVisitRecord[] = primaryChildId
    ? mockStore.getHomeVisits({
        role: 'Parent/Family',
        linkedBeneficiaryIds: linkedIds,
      })
    : [];

  // Scroll to hash section if present in URL
  useEffect(() => {
    if (location.hash) {
      const target = location.hash.slice(1);
      const el = document.getElementById(target);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [location.hash]);

  // Clean empty state if family has no linked child
  if (!child || !primaryChildId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#E8F2FC] rounded-3xl p-8 border border-[#BBD5F0] text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#F8FBFF] text-[#17365D] flex items-center justify-center mx-auto mb-4 border border-[#BBD5F0]">
            <Baby className="w-8 h-8 text-[#2457F5]" />
          </div>
          <h2 className="text-xl font-bold text-[#17365D]">
            No Child Record Linked Yet
          </h2>
          <p className="text-sm text-[#52708F] mt-2 leading-relaxed">
            Your family account ({staffUser?.id || 'FAM-0142'}) is active, but is not currently linked to an Anganwadi beneficiary registration.
          </p>
          <div className="mt-6 p-4 bg-[#F8FBFF] rounded-2xl border border-[#BBD5F0] text-left text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#17365D] font-semibold">
              <Info className="w-4 h-4 text-[#2457F5] shrink-0" />
              <span>How to link your child:</span>
            </div>
            <p className="text-[#52708F]">
              1. Visit your local Anganwadi Centre (AWC-702).
            </p>
            <p className="text-[#52708F]">
              2. Share your family registration ID with your Anganwadi Worker (AWW).
            </p>
            <p className="text-[#52708F]">
              3. Once linked, you will see real-time growth curves, nutrition advice, and visit schedules here.
            </p>
          </div>
          <div className="mt-6">
            <Link
              to="/profile"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#17365D] text-white text-xs font-semibold hover:bg-black transition-colors"
            >
              <span>View Family Account</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ageCalc = calculateAge(child.dob, getTodayISODate(), child.category, child.gender);
  const ageStr = ageCalc.ageDisplay;
  const latestMeas = measurements[measurements.length - 1];

  // WHO Child Growth Standards (Median benchmarks for boys and girls)
  const getWhoMedian = (ageMonths: number, gender: string, metric: 'weight' | 'height'): number => {
    const isGirl = gender === 'Female';
    if (metric === 'weight') {
      const table: Record<number, number> = isGirl
        ? { 10: 8.5, 11: 8.7, 12: 8.9, 13: 9.2, 14: 9.4 }
        : { 10: 9.2, 11: 9.4, 12: 9.6, 13: 9.9, 14: 10.1 };
      return table[ageMonths] ?? (isGirl ? 9.0 : 9.5);
    } else {
      const table: Record<number, number> = isGirl
        ? { 10: 71.5, 11: 72.8, 12: 74.0, 13: 75.2, 14: 76.4 }
        : { 10: 73.3, 11: 74.5, 12: 75.7, 13: 76.9, 14: 78.0 };
      return table[ageMonths] ?? (isGirl ? 73.0 : 75.0);
    }
  };

  // Dynamically map chart points strictly from real stored measurements
  const chartPoints = measurements.map((m) => {
    const d = new Date(m.date);
    const monthName = Number.isFinite(d.getTime())
      ? d.toLocaleDateString('en-GB', { month: 'short' })
      : `M${m.ageMonths}`;
    const whoVal = getWhoMedian(m.ageMonths, child.gender, activeChartTab);
    const currentVal = activeChartTab === 'weight' ? m.weightKg : m.heightCm;
    return {
      date: m.date,
      month: monthName,
      ageMonths: m.ageMonths,
      weight: m.weightKg,
      height: m.heightCm,
      currentVal,
      whoMedian: whoVal,
    };
  });

  // Calculate routine monthly weigh-in schedule (30 days from last checkup)
  const lastCheckupDate = child.lastMeasurementDate || (latestMeas ? latestMeas.date : '2026-10-24');
  const daysSinceLastCheck = getDaysUntilDate(lastCheckupDate, getTodayISODate()) ?? 0;
  const isWeighInDueSoon = daysSinceLastCheck >= 25;

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* 1. Welcome & Child Profile Header */}
      <motion.section
        id="child-profile"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[#E8F2FC] rounded-3xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#17365D] text-white flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
              👶
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#F8FBFF] text-[#17365D] font-mono text-xs font-semibold border border-[#BBD5F0]">
                  {child.id}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200">
                  {child.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200">
                  Parent / Family Portal
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17365D]">
                {child.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#52708F] mt-1">
                Age: <strong className="text-[#17365D]">{ageStr}</strong> (DOB: {child.dob}) · Gender: <strong className="text-[#17365D]">{child.gender}</strong> · Caregiver: <strong className="text-[#17365D]">{child.caregiverKinship}</strong>
              </p>
            </div>
          </div>

          {/* Quick Centre Context Badge */}
          <div className="bg-[#F8FBFF] rounded-2xl p-4 border border-[#BBD5F0] flex flex-col gap-1 min-w-[220px]">
            <div className="flex items-center gap-1.5 text-xs text-[#52708F]">
              <Home className="w-3.5 h-3.5 text-[#2457F5]" />
              <span>Registered Anganwadi Centre:</span>
            </div>
            <p className="text-xs font-bold text-[#17365D]">
              Anganwadi Centre {child.centreCode.replace('AWC-', '')} ({child.centreCode})
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-[#52708F] mt-1 pt-1 border-t border-[#BBD5F0]/60">
              <User className="w-3 h-3 text-[#1F8A83]" />
              <span>Assigned Frontline Didi: <strong>{child.assignedAww}</strong></span>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#BBD5F0]/70">
          <div className="bg-[#F8FBFF] rounded-2xl p-4 border border-[#BBD5F0]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#52708F]">Latest Recorded Weight</span>
              <Scale className="w-4 h-4 text-[#2457F5]" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#17365D]">
                {latestMeas ? latestMeas.weightKg : (child.lastWeight ?? '—')}
              </span>
              <span className="text-xs font-semibold text-[#52708F]">kg</span>
            </div>
            <p className="text-[11px] text-[#52708F] mt-1">
              {latestMeas ? `Checked on ${latestMeas.date} at ${child.centreCode}` : 'Awaiting scheduled weigh-in'}
            </p>
          </div>

          <div className="bg-[#F8FBFF] rounded-2xl p-4 border border-[#BBD5F0]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#52708F]">Latest Recorded Height</span>
              <Activity className="w-4 h-4 text-[#1F8A83]" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#17365D]">
                {latestMeas ? latestMeas.heightCm : (child.lastHeight ?? '—')}
              </span>
              <span className="text-xs font-semibold text-[#52708F]">cm</span>
            </div>
            <p className="text-[11px] text-[#52708F] mt-1">
              Recumbent length recorded with infantometer
            </p>
          </div>

          <div className="bg-[#F8FBFF] rounded-2xl p-4 border border-[#BBD5F0]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#52708F]">Registered Birth Weight</span>
              <Heart className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#17365D]">
                {child.birthWeight ? `${child.birthWeight}` : '—'}
              </span>
              <span className="text-xs font-semibold text-[#52708F]">kg</span>
            </div>
            <p className="text-[11px] text-[#52708F] mt-1">
              Baseline weight at birth delivery
            </p>
          </div>
        </div>
      </motion.section>

      {/* 2. Growth Tracking Journey */}
      <motion.section
        id="growth-tracking"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="bg-[#E8F2FC] rounded-3xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8FBFF] border border-[#BBD5F0] text-xs font-semibold text-[#17365D] mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#2457F5]" />
              <span>Growth Progress</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#17365D]">
              {child.name}'s Growth Tracking Journey
            </h2>
            <p className="text-xs sm:text-sm text-[#52708F] mt-1 font-normal">
              Compare {child.name}'s verified monthly measurements with standard WHO child growth median benchmarks.
            </p>
          </div>

          {/* Toggle Tab */}
          <div className="inline-flex p-1 bg-[#F8FBFF] rounded-full border border-[#BBD5F0] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveChartTab('weight')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeChartTab === 'weight'
                  ? 'bg-[#17365D] text-white shadow-xs'
                  : 'text-[#52708F] hover:text-[#17365D]'
              }`}
            >
              Weight (kg)
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('height')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeChartTab === 'height'
                  ? 'bg-[#17365D] text-white shadow-xs'
                  : 'text-[#52708F] hover:text-[#17365D]'
              }`}
            >
              Height (cm)
            </button>
          </div>
        </div>

        {/* Chart Visualization Container */}
        <div className="bg-[#F8FBFF] rounded-2xl p-6 border border-[#BBD5F0]">
          {chartPoints.length > 0 ? (
            <div className="h-64 sm:h-72 w-full flex flex-col justify-between">
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-end gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#17365D]" />
                  <span className="text-[#17365D] font-semibold">{child.name}'s Stored {activeChartTab === 'weight' ? 'Weight' : 'Height'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-80" />
                  <span className="text-[#52708F]">WHO Standard Reference Median</span>
                </div>
              </div>

              {/* Dynamic Bars derived strictly from stored records */}
              <div className="relative flex-1 mt-4 flex items-end justify-around gap-2 sm:gap-6 border-b border-l border-[#BBD5F0] pb-2 pl-2">
                {chartPoints.map((pt, i) => {
                  const isWeight = activeChartTab === 'weight';
                  const minScale = isWeight ? 5 : 65;
                  const maxScale = isWeight ? 13 : 82;
                  const pct = Math.min(100, Math.max(10, ((pt.currentVal - minScale) / (maxScale - minScale)) * 100));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-9 bg-[#17365D] text-white text-[11px] px-2 py-1 rounded-md shadow pointer-events-none whitespace-nowrap z-10 text-center">
                        <div>{pt.date} ({pt.ageMonths}m)</div>
                        <div>Measured: {pt.currentVal} {isWeight ? 'kg' : 'cm'} · WHO Median: {pt.whoMedian} {isWeight ? 'kg' : 'cm'}</div>
                      </div>

                      {/* Visual Bar */}
                      <div className="w-full max-w-[48px] bg-sky-100 rounded-t-lg relative flex flex-col justify-end overflow-hidden border border-[#BBD5F0]/60" style={{ height: `${pct}%` }}>
                        <div
                          className="w-full bg-[#17365D] rounded-t-md transition-all duration-500"
                          style={{ height: '100%' }}
                        />
                      </div>

                      {/* Value Badge */}
                      <span className="text-[11px] font-bold text-[#17365D] mt-2">
                        {pt.currentVal}
                      </span>
                      {/* Month Label */}
                      <span className="text-[10px] text-[#52708F]">
                        {pt.month} ({pt.ageMonths}m)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#52708F] text-center py-8">
              No historical measurements available for growth chart plotting.
            </p>
          )}

          {/* Supportive Explanation Box */}
          <div className="mt-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-start gap-3">
            <Info className="w-4 h-4 text-[#2457F5] shrink-0 mt-0.5" />
            <div className="text-xs text-[#52708F] leading-relaxed">
              <span className="font-bold text-[#17365D]">Understanding Growth Monitoring:</span>
              <p className="mt-0.5">
                Children grow in healthy steps. Monthly height and weight tracking helps your Anganwadi Didi ensure {child.name} is receiving adequate nutrition. Regular checks allow frontline staff to celebrate healthy progress and provide timely dietary guidance.
              </p>
            </div>
          </div>
        </div>

        {/* Milestone Guidance for 12-15 Months */}
        <div className="bg-[#F8FBFF] rounded-2xl p-6 border border-[#BBD5F0] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="text-sm font-bold text-[#17365D] flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>General Child Development Guidance (12–15 Months)</span>
            </h3>
            <span className="text-[11px] text-[#52708F] italic">
              Informational guidance only · Not a clinical assessment
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#BBD5F0]/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#17365D]">Physical Movement</p>
                <p className="text-[#52708F] mt-0.5">Pulls up to stand, cruises along furniture, and takes first hesitant steps.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#BBD5F0]/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#17365D]">Language & Social</p>
                <p className="text-[#52708F] mt-0.5">Says 1–2 simple words (e.g., 'Amma', 'Papa') and waves bye-bye.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#BBD5F0]/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#17365D]">Active Eating</p>
                <p className="text-[#52708F] mt-0.5">Picks up small pieces of food with fingers and drinks from an open cup.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#BBD5F0]/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#17365D]">Curiosity & Play</p>
                <p className="text-[#52708F] mt-0.5">Explores surroundings, bangs objects together, and looks for hidden toys.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. Nutrition & Care Guidance */}
      <motion.section
        id="nutrition-care"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-[#E8F2FC] rounded-3xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8FBFF] border border-[#BBD5F0] text-xs font-semibold text-[#17365D] mb-2">
            <Utensils className="w-3.5 h-3.5 text-[#1F8A83]" />
            <span>Nutrition & Daily Care</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#17365D]">
            Daily Diet Guidance for 12–24 Month Toddlers
          </h2>
          <p className="text-xs sm:text-sm text-[#52708F] mt-1 font-normal">
            Standard practical suggestions from the Integrated Child Development Services (ICDS) protocol for growing toddlers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#F8FBFF] rounded-2xl p-5 border border-[#BBD5F0] space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              🍲
            </div>
            <h3 className="text-sm font-bold text-[#17365D]">
              Frequent Family Meals
            </h3>
            <p className="text-xs text-[#52708F] leading-relaxed">
              Feed {child.name} 3 to 4 times a day, plus 1–2 healthy snacks between meals. Offer soft, mashed family foods like dalia, khichdi, suji, or mashed chapati with dal.
            </p>
          </div>

          <div className="bg-[#F8FBFF] rounded-2xl p-5 border border-[#BBD5F0] space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              🧈
            </div>
            <h3 className="text-sm font-bold text-[#17365D]">
              Energy & Good Fats
            </h3>
            <p className="text-xs text-[#52708F] leading-relaxed">
              Add a half teaspoon of pure ghee, butter, or edible oil to your child's bowl. Energy-dense food ensures active toddlers gain strength and stay energized throughout the day.
            </p>
          </div>

          <div className="bg-[#F8FBFF] rounded-2xl p-5 border border-[#BBD5F0] space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              🍎
            </div>
            <h3 className="text-sm font-bold text-[#17365D]">
              Fruits & Greens
            </h3>
            <p className="text-xs text-[#52708F] leading-relaxed">
              Give mashed ripe banana, papaya, chikoo, or cooked green leafy vegetables (palak). If permissible, cooked egg yolk provides essential brain nutrients.
            </p>
          </div>
        </div>

        {/* Clean Water & Handwashing Card */}
        <div className="bg-[#F8FBFF] rounded-2xl p-5 border border-[#BBD5F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-[#1F8A83] flex items-center justify-center font-bold shrink-0">
              <Droplets className="w-5 h-5 text-[#1F8A83]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#17365D]">
                Clean Water & Hygiene at Home
              </h4>
              <p className="text-xs text-[#52708F] mt-0.5 leading-relaxed">
                Always wash hands with soap before preparing food and before feeding your child. Provide boiled, cooled drinking water to prevent seasonal stomach bugs.
              </p>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer Alert */}
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="font-semibold">Educational & Supportive Guidance Note:</strong>
            <p className="mt-0.5 text-[11px] text-amber-800">
              The Poshan Action Layer provides supportive nutrition tracking and Anganwadi schedule reminders for families. It does not replace clinical consultation, medical diagnosis, or prescription from a certified medical doctor or pediatrician. In case of persistent illness, fever, or breathing difficulty, please visit the nearest Primary Health Centre (PHC).
            </p>
          </div>
        </div>
      </motion.section>

      {/* 4. Upcoming Activities & Reminders */}
      <motion.section
        id="upcoming"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="bg-[#E8F2FC] rounded-3xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8FBFF] border border-[#BBD5F0] text-xs font-semibold text-[#17365D] mb-2">
            <Calendar className="w-3.5 h-3.5 text-[#2457F5]" />
            <span>Schedule & Reminders</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#17365D]">
            Upcoming Anganwadi Activities & Reminders
          </h2>
          <p className="text-xs sm:text-sm text-[#52708F] mt-1 font-normal">
            ICDS operational schedule reminders and national immunization guidelines for your Anganwadi centre.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Monthly Weigh-in */}
          <div className="bg-[#F8FBFF] rounded-2xl p-5 border border-[#BBD5F0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2457F5]">Routine Cycle</span>
                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${isWeighInDueSoon ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {isWeighInDueSoon ? 'Due Soon' : 'Upcoming'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#17365D]">
                Monthly Routine Weigh-in
              </h3>
              <p className="text-xs text-[#52708F] mt-1 leading-relaxed">
                Standard 30-day ICDS growth monitoring check at {child.centreCode}. Bring {child.name} for regular weight and height tracking.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#BBD5F0]/60 flex items-center justify-between text-xs">
              <span className="text-[#52708F]">Next Cycle:</span>
              <span className="font-bold text-[#17365D]">Late November 2026</span>
            </div>
          </div>

          {/* 2. Home Visit (Grounded in mockStore Home Visits) */}
          <div className="bg-[#F8FBFF] rounded-2xl p-5 border border-[#BBD5F0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600">Home Visit</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                  {homeVisits.length > 0 ? (homeVisits[0].status === 'completed' ? 'Completed' : 'Scheduled') : 'Routine'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#17365D]">
                Frontline AWW Home Visit
              </h3>
              <p className="text-xs text-[#52708F] mt-1 leading-relaxed">
                {homeVisits.length > 0
                  ? `${homeVisits[0].workerId}: ${homeVisits[0].note}`
                  : `Frontline Didi (${child.assignedAww}) conducts periodic home visits for infant feeding practice review and THR advisory.`}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#BBD5F0]/60 flex items-center justify-between text-xs">
              <span className="text-[#52708F]">{homeVisits.length > 0 ? 'Visit Date:' : 'Cadence:'}</span>
              <span className="font-bold text-[#17365D]">{homeVisits.length > 0 ? homeVisits[0].visitDate : 'Periodic Routine'}</span>
            </div>
          </div>

          {/* 3. National Immunization Schedule Guidance */}
          <div className="bg-[#F8FBFF] rounded-2xl p-5 border border-[#BBD5F0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">UIP Guideline</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">National Policy</span>
              </div>
              <h3 className="text-sm font-bold text-[#17365D]">
                16–24 Month Booster Guidance
              </h3>
              <p className="text-xs text-[#52708F] mt-1 leading-relaxed">
                National UIP schedule: DPT Booster 1, Measles-Rubella Dose 2, and OPV Booster at 16–24 months. Verify completed stamps on physical MCP card.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#BBD5F0]/60 flex items-center justify-between text-xs">
              <span className="text-[#52708F]">Guideline Range:</span>
              <span className="font-bold text-[#17365D]">16–24 Months</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 5. Measurement & Visit History */}
      <motion.section
        id="history"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-[#E8F2FC] rounded-3xl border border-[#BBD5F0] p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8FBFF] border border-[#BBD5F0] text-xs font-semibold text-[#17365D] mb-2">
              <Clock className="w-3.5 h-3.5 text-[#2457F5]" />
              <span>Visit Records</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#17365D]">
              Past Check-ups & Measurement History
            </h2>
            <p className="text-xs sm:text-sm text-[#52708F] mt-1 font-normal">
              Chronological log of verified measurements recorded by your Anganwadi centre ({child.centreCode}).
            </p>
          </div>
          <span className="text-xs font-semibold text-[#52708F]">
            {measurements.length} Total Visits Recorded
          </span>
        </div>

        {/* History Table */}
        <div className="bg-[#F8FBFF] rounded-2xl border border-[#BBD5F0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#E8F2FC] text-[#17365D] uppercase tracking-wider font-semibold border-b border-[#BBD5F0]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Child Age</th>
                  <th className="py-3 px-4">Weight (kg)</th>
                  <th className="py-3 px-4">Height (cm)</th>
                  <th className="py-3 px-4">MUAC (cm)</th>
                  <th className="py-3 px-4">Centre & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BBD5F0]/60 text-slate-700">
                {measurements.slice().reverse().map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#17365D]">
                      {m.date}
                    </td>
                    <td className="py-3 px-4 text-[#52708F]">
                      {m.ageMonths} months
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#17365D]">
                      {m.weightKg} kg
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#17365D]">
                      {m.heightCm} cm
                    </td>
                    <td className="py-3 px-4 text-[#52708F]">
                      {m.muacCm ? `${m.muacCm} cm` : '—'}
                    </td>
                    <td className="py-3 px-4 text-[#52708F]">
                      {child.centreCode} · Routine growth monitoring intake (Recorded by {m.recordedBy || child.assignedAww})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
