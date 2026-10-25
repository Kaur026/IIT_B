import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Clock,
  AlertCircle,
  FileText,
  Activity,
  Layers,
  Sparkles,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';
import { tokens } from '../styles/tokens';
import { TiltCard } from '../components/common/TiltCard';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { useToast } from '../context/ToastContext';

export const DesignSystemPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'tokens' | 'components' | 'motion'>('tokens');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [progressVal, setProgressVal] = useState(72);

  const statusChips = [
    { label: 'Urgent', status: 'urgent' as const, code: '#C8453B' },
    { label: 'Attention', status: 'attention' as const, code: '#D98E04' },
    { label: 'Resolved', status: 'resolved' as const, code: '#2E8B57' },
    { label: 'Needs verification', status: 'info' as const, code: '#3A6FD8' },
    { label: 'Review rule', status: 'duplicate' as const, code: '#7A5CC2' },
  ];

  const chartTones = [
    { name: 'Electric Cobalt', hex: '#2457F5' },
    { name: 'Soft Sage', hex: '#C9DCCF' },
    { name: 'Cool White', hex: '#F5F7FB' },
    { name: 'Pure White', hex: '#FFFFFF' },
    { name: 'Deep Navy', hex: '#172B4D' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F9FC] text-[#0E1B2B] relative selection:bg-[#CFEFD8] selection:text-[#0E1B2B] pb-24">
      {/* Background radial drift */}
      <div className="ambient-orb-mint w-[600px] h-[600px] -top-40 -left-40" />
      <div className="ambient-orb-sky w-[700px] h-[700px] top-[20%] -right-60" />
      <div className="ambient-orb-white w-[500px] h-[500px] bottom-40 left-1/3" />

      {/* Floating Header */}
      <header className="sticky top-4 z-40 max-w-6xl mx-auto px-4">
        <div className="frosted-glass rounded-full px-6 py-3 flex items-center justify-between shadow-layered">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0E1B2B] text-white flex items-center justify-center font-bold text-xs tracking-tight">
              PAL
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">Poshan Action Layer</span>
              <span className="ml-2 text-xs text-[#5B6B7C] font-mono">v2.4 Design System</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-xs px-3 py-1.5 rounded-full hover:bg-black/5 text-[#5B6B7C] transition-colors"
            >
              Landing
            </Link>
            <Link
              to="/dashboard"
              className="text-xs px-3 py-1.5 rounded-full hover:bg-black/5 text-[#5B6B7C] transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/queue"
              className="text-xs px-3 py-1.5 rounded-full hover:bg-black/5 text-[#5B6B7C] transition-colors"
            >
              Action Queue
            </Link>
            <Link
              to="/child/BEN-0142"
              className="text-xs px-3 py-1.5 rounded-full hover:bg-black/5 text-[#5B6B7C] transition-colors"
            >
              Child Profile
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <main className="max-w-6xl mx-auto px-4 pt-12">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-white/80 text-xs text-[#5B6B7C] shadow-sm mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#1F8A83]" />
            <span>Framer / Awwwards Design Language Specification</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.1] text-[#0E1B2B] mb-3">
            Design Tokens & UI Component Kit
          </h1>
          <p className="text-[#5B6B7C] text-base max-w-2xl leading-relaxed">
            Calm, warm, trustworthy, and airy foundation engineered for frontline Anganwadi supervisor
            casework. Strict adherence to non-diagnostic data representation, single-hue data visuals, and spring micro-interactions.
          </p>
        </div>

        {/* Sliding Pill Tab Switcher */}
        <div className="flex items-center gap-1 bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white/80 w-fit mb-12 shadow-sm">
          {(['tokens', 'components', 'motion'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative px-5 py-2 text-sm font-medium rounded-full transition-colors capitalize z-10"
              style={{
                color: activeTab === tab ? '#0E1B2B' : '#5B6B7C',
              }}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="designSystemTabPill"
                  className="absolute inset-0 bg-white rounded-full shadow-sm"
                  transition={{ type: 'spring', stiffness: 240, damping: 24 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {tab === 'tokens' ? 'Design Tokens & Styles' : tab === 'components' ? 'Component Library' : 'Motion & Physics'}
            </button>
          ))}
        </div>

        {/* TAB 1: DESIGN TOKENS */}
        {activeTab === 'tokens' && (
          <div className="space-y-12">
            {/* Color Palette */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">1. Foundation Color Canvas</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                Clean canvas `#F5F9FC`, midnight ink `#0E1B2B`, and slate secondary text `#5B6B7C`. Never pure black.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-black/5">
                  <div className="h-16 rounded-xl bg-[#F5F9FC] border border-black/10 mb-3 shadow-inner" />
                  <div className="font-medium text-sm">Canvas</div>
                  <div className="text-xs text-[#5B6B7C] font-mono">#F5F9FC</div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-black/5">
                  <div className="h-16 rounded-xl bg-[#0E1B2B] mb-3 shadow-sm" />
                  <div className="font-medium text-sm">Ink (Headings & Pills)</div>
                  <div className="text-xs text-[#5B6B7C] font-mono">#0E1B2B</div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-black/5">
                  <div className="h-16 rounded-xl bg-[#5B6B7C] mb-3 shadow-sm" />
                  <div className="font-medium text-sm">Secondary Text</div>
                  <div className="text-xs text-[#5B6B7C] font-mono">#5B6B7C</div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-black/5">
                  <div className="h-16 rounded-xl bg-white border border-black/10 mb-3 shadow-sm" />
                  <div className="font-medium text-sm">Card White Surface</div>
                  <div className="text-xs text-[#5B6B7C] font-mono">#FFFFFF</div>
                </div>
              </div>
            </section>

            {/* Key 32px Radius Panel with Mint-to-Sky Gradient & Grain */}
            <section className="panel-gradient-mint-sky p-8 md:p-12 shadow-layered relative">
              <div className="film-grain-overlay" />
              <div className="relative z-10 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 backdrop-blur-md text-xs font-medium text-[#0E1B2B] mb-4">
                  <span>32px Radius Panel with 4% Film-Grain</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-light tracking-[-0.02em] leading-tight text-[#0E1B2B] mb-4">
                  Gradient Panel (#CFEFD8 to #D6E6F7)
                </h2>
                <p className="text-sm text-[#0E1B2B]/80 leading-relaxed mb-6">
                  Rendered with radial top-left light highlights and an SVG feTurbulence film-grain overlay blending in multiply mode.
                </p>
                <div className="flex items-center gap-3">
                  <button className="px-5 py-2.5 rounded-full bg-[#0E1B2B] text-white text-xs font-medium hover:bg-black/90 transition-all shadow-sm">
                    Primary Dark Pill
                  </button>
                  <button className="px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-md text-[#0E1B2B] text-xs font-medium hover:bg-white/90 border border-white/80 transition-all shadow-sm">
                    Frosted Pill
                  </button>
                </div>
              </div>
            </section>

            {/* Status Chips with 12% Tinted Fills */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">2. Status Chips (12% Tinted Fills)</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                Never harsh or saturated. Muted pastel fills with tinted outlines for non-alarmist casework triage.
              </p>
              <div className="flex flex-wrap gap-4">
                {statusChips.map((chip) => {
                  const s = tokens.colors.status[chip.status];
                  return (
                    <div
                      key={chip.status}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: s.fill,
                        color: s.text,
                        border: `1px solid ${s.border}`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
                      <span>{chip.label}</span>
                      <span className="text-[10px] opacity-75 font-mono">({chip.code})</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Single Hue Chart Palette */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">3. Stitch Palette</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                One cohesive family with soft glows. Strictly prevents rainbow cognitive overload.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {chartTones.map((tone) => (
                  <div key={tone.hex} className="p-3 rounded-2xl bg-white border border-black/5">
                    <div
                      className="h-14 rounded-xl mb-2.5 shadow-sm"
                      style={{ backgroundColor: tone.hex }}
                    />
                    <div className="text-xs font-medium">{tone.name}</div>
                    <div className="text-[11px] text-[#5B6B7C] font-mono">{tone.hex}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Typography Scale */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">4. Typography Scale</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                Inter Tight Light 300 for display headings, Inter Regular for body, and tabular numerals for data alignment.
              </p>
              <div className="space-y-6">
                <div className="border-b border-black/5 pb-4">
                  <div className="text-xs font-mono text-[#5B6B7C] mb-1">H1 • Inter Tight Light 300 (64/68, tracking -2%)</div>
                  <h1 className="text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-tight text-[#0E1B2B]">
                    Every child deserves a healthier tomorrow.
                  </h1>
                </div>
                <div className="border-b border-black/5 pb-4">
                  <div className="text-xs font-mono text-[#5B6B7C] mb-1">H2 • Inter Tight Regular 400 (32/38, tracking -1%)</div>
                  <h2 className="text-2xl font-normal tracking-[-0.01em] text-[#0E1B2B]">
                    Priority Action Queue & Field Triage
                  </h2>
                </div>
                <div className="border-b border-black/5 pb-4">
                  <div className="text-xs font-mono text-[#5B6B7C] mb-1">Body • Inter 15/24</div>
                  <p className="text-[15px] leading-6 text-[#5B6B7C] max-w-2xl">
                    Student research prototype that helps Anganwadi supervisors see which flagged child-nutrition records need attention today.
                    Flags are never clinical diagnoses; humans verify every field update.
                  </p>
                </div>
                <div>
                  <div className="text-xs font-mono text-[#5B6B7C] mb-1">Tabular Numerals • font-variant-numeric: tabular-nums</div>
                  <div className="text-lg font-mono tabular-nums text-[#0E1B2B]">
                    12.30 kg • 248 beneficiaries • +3.80 kg in 28d • 99.4% SLA
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: COMPONENT LIBRARY */}
        {activeTab === 'components' && (
          <div className="space-y-12">
            {/* Pill Buttons & Variants */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">1. Pill Button Variants</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                Tactile buttons with active scale 0.98 compression and hover lift.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => showToast('Primary Dark Pill clicked')}
                  className="px-6 py-2.5 rounded-full bg-[#0E1B2B] text-white text-xs font-medium hover:bg-black/85 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                >
                  <span>Explore Dashboard Demo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => showToast('Frosted Glass Pill clicked')}
                  className="px-6 py-2.5 rounded-full frosted-glass-pill text-[#0E1B2B] text-xs font-medium hover:bg-white/80 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1F8A83]" />
                  <span>Verify and assign follow-up</span>
                </button>

                <button
                  onClick={() => showToast('Outline Button clicked')}
                  className="px-6 py-2.5 rounded-full border border-[#0E1B2B]/20 text-[#0E1B2B] text-xs font-medium hover:bg-black/5 active:scale-95 transition-all"
                >
                  Dismiss flag
                </button>

                <button
                  disabled
                  title="Closure requires a recorded outcome"
                  className="px-6 py-2.5 rounded-full bg-black/5 text-[#5B6B7C]/50 text-xs font-medium cursor-not-allowed border border-black/5"
                >
                  Close case (disabled)
                </button>
              </div>
            </section>

            {/* KPI Cards & TiltCard */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">2. TiltCard & KPI Metrics</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                Hover over the cards to feel the spring-physics 3D cursor tilt and specular glare.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <TiltCard maxTilt={4} className="p-6 rounded-[24px] bg-white border border-white/80 shadow-layered">
                  <div className="text-xs text-[#5B6B7C] font-medium mb-1">Beneficiaries monitored</div>
                  <div className="text-3xl font-light tracking-tight text-[#0E1B2B] tabular-nums mb-2">
                    <AnimatedNumber value={248} />
                  </div>
                  <div className="text-[11px] text-[#1F8A83] font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Active field coverage</span>
                  </div>
                </TiltCard>

                <TiltCard maxTilt={4} className="p-6 rounded-[24px] bg-white border border-white/80 shadow-layered">
                  <div className="text-xs text-[#5B6B7C] font-medium mb-1">Needs verification</div>
                  <div className="text-3xl font-light tracking-tight text-[#C8453B] tabular-nums mb-2">
                    <AnimatedNumber value={18} />
                  </div>
                  <div className="text-[11px] text-[#C8453B] font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Awaiting human review</span>
                  </div>
                </TiltCard>

                <TiltCard maxTilt={4} className="p-6 rounded-[24px] bg-white border border-white/80 shadow-layered">
                  <div className="text-xs text-[#5B6B7C] font-medium mb-1">Follow-ups due</div>
                  <div className="text-3xl font-light tracking-tight text-[#D98E04] tabular-nums mb-2">
                    <AnimatedNumber value={12} />
                  </div>
                  <div className="text-[11px] text-[#D98E04] font-medium flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Assigned to AWWs</span>
                  </div>
                </TiltCard>

                <TiltCard maxTilt={4} className="p-6 rounded-[24px] bg-white border border-white/80 shadow-layered">
                  <div className="text-xs text-[#5B6B7C] font-medium mb-1">Overdue actions</div>
                  <div className="text-3xl font-light tracking-tight text-[#7A5CC2] tabular-nums mb-2">
                    <AnimatedNumber value={5} />
                  </div>
                  <div className="text-[11px] text-[#7A5CC2] font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Escalated to supervisor</span>
                  </div>
                </TiltCard>
              </div>
            </section>

            {/* Progress Rings & SVG Donut */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">3. Self-Drawing Progress Ring & Donut</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                Animated SVG stroke-dashoffset transitions without raster images or rainbow artifacts.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="flex items-center gap-6 p-6 rounded-2xl bg-white border border-black/5">
                  <div className="relative w-28 h-28">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#E8F4F0"
                        strokeWidth="8"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#1F8A83"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={251.2}
                        initial={{ strokeDashoffset: 251.2 }}
                        animate={{ strokeDashoffset: 251.2 * (1 - progressVal / 100) }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-light text-[#0E1B2B] tabular-nums">{progressVal}%</span>
                      <span className="text-[10px] text-[#5B6B7C]">Complete</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">AWC Registration Progress</div>
                    <div className="text-xs text-[#5B6B7C] mb-3">SOP validation checklist completion rate</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setProgressVal(50)}
                        className="px-2.5 py-1 text-xs rounded-full bg-black/5 hover:bg-black/10"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => setProgressVal(75)}
                        className="px-2.5 py-1 text-xs rounded-full bg-black/5 hover:bg-black/10"
                      >
                        75%
                      </button>
                      <button
                        onClick={() => setProgressVal(100)}
                        className="px-2.5 py-1 text-xs rounded-full bg-black/5 hover:bg-black/10"
                      >
                        100%
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-black/5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium mb-1">Rule-Based Screening Overview</div>
                    <div className="text-xs text-[#5B6B7C] mb-3">Deterministic screening split (Demo rules)</div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0F5E66]" />
                        <span>Weight Velocity Outlier (11)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1F8A83]" />
                        <span>Negative Stature Delta (7)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4FB39A]" />
                        <span>Growth Stagnation (4)</span>
                      </div>
                    </div>
                  </div>

                  {/* Donut representation */}
                  <div className="w-24 h-24 relative">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="36" fill="none" stroke="#0F5E66" strokeWidth="12" strokeDasharray="110 226" />
                      <circle cx="50" cy="50" r="36" fill="none" stroke="#1F8A83" strokeWidth="12" strokeDasharray="70 226" strokeDashoffset="-115" />
                      <circle cx="50" cy="50" r="36" fill="none" stroke="#4FB39A" strokeWidth="12" strokeDasharray="46 226" strokeDashoffset="-188" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            {/* Table Row & Drawer Trigger */}
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-medium tracking-tight">4. Action Queue Table Row & Drawer</h2>
                  <p className="text-sm text-[#5B6B7C]">Click the row below to trigger the case drawer animation.</p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-4 py-2 rounded-full bg-[#0E1B2B] text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Open Drawer</span>
                </button>
              </div>

              <div
                onClick={() => setIsDrawerOpen(true)}
                className="p-4 rounded-2xl bg-white border border-black/5 hover:border-black/15 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#CFEFD8]/60 text-[#0F5E66] flex items-center justify-center font-bold text-xs font-mono">
                    BEN
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">BEN-0142 • 14 mo</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-[#C8453B] border border-rose-200">
                        Urgent
                      </span>
                      <span className="text-xs text-[#5B6B7C] font-mono">ACT-2041</span>
                    </div>
                    <div className="text-xs text-[#5B6B7C]">
                      Weight velocity outlier (+3.8 kg in 28d) • Needs human verification
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-mono text-[#0E1B2B]">8.5 kg → 12.3 kg</div>
                    <div className="text-[11px] text-[#5B6B7C]">Assigned: AWW-07</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#5B6B7C]" />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: MOTION & PHYSICS */}
        {activeTab === 'motion' && (
          <div className="space-y-8">
            <section className="bg-white/70 backdrop-blur-xl rounded-[28px] p-8 border border-white/80 shadow-layered">
              <h2 className="text-xl font-medium tracking-tight mb-2">Motion Guidelines & Spring Physics</h2>
              <p className="text-sm text-[#5B6B7C] mb-6">
                All animations use GPU-accelerated transforms and opacity with spring stiffness 180 and damping 18.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-white border border-black/5">
                  <div className="text-sm font-medium mb-2">1. TiltCard Spring</div>
                  <p className="text-xs text-[#5B6B7C] leading-relaxed mb-4">
                    Cursor proximity calculation mapping [-0.5, 0.5] to max 4 degrees (hero 6 degrees). Includes specular highlight.
                  </p>
                  <div className="text-xs font-mono bg-black/5 p-2.5 rounded-lg text-[#0E1B2B]">
                    stiffness: 180<br />
                    damping: 18<br />
                    perspective: 1000px
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-black/5">
                  <div className="text-sm font-medium mb-2">2. Route Transitions</div>
                  <p className="text-xs text-[#5B6B7C] leading-relaxed mb-4">
                    350ms duration fade coupled with a 12px upward slide. Top navigation remains stationary and blurred.
                  </p>
                  <div className="text-xs font-mono bg-black/5 p-2.5 rounded-lg text-[#0E1B2B]">
                    duration: 0.35s<br />
                    ease: [0.22, 1, 0.36, 1]<br />
                    stagger: 60ms
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-black/5">
                  <div className="text-sm font-medium mb-2">3. Reduced Motion</div>
                  <p className="text-xs text-[#5B6B7C] leading-relaxed mb-4">
                    Gracefully disables 3D tilt, background drift, and WebGL when `@media (prefers-reduced-motion)` is active.
                  </p>
                  <div className="text-xs font-mono bg-black/5 p-2.5 rounded-lg text-[#0E1B2B]">
                    tilt: false<br />
                    drift: false<br />
                    webgl: false
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Slide-in Case Drawer Preview */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-white shadow-drawer z-50 flex flex-col overflow-y-auto"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
                <div>
                  <div className="text-xs text-[#5B6B7C] font-mono">CASE DRAWER DEMO</div>
                  <h3 className="text-lg font-medium tracking-tight">ACT-2041 • BEN-0142</h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6 flex-1">
                <div className="p-4 rounded-2xl bg-[#CFEFD8]/30 border border-[#CFEFD8]">
                  <div className="text-xs font-medium text-[#0F5E66] mb-1">Example Rule R-07 • Demo</div>
                  <p className="text-xs text-[#0F5E66]/90">
                    Flagged for physical verification: 8.5 kg to 12.3 kg (+3.8 kg in 28 days).
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-[#5B6B7C]">Next Step Action:</div>
                  <p className="text-sm text-[#0E1B2B]">
                    Physically re-weigh with a calibrated scale and enter the result as a new event.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>This is a data-quality flag, not a clinical diagnosis.</span>
                </div>
              </div>

              <div className="p-6 border-t border-black/5 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-medium hover:bg-black/5"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    showToast('Case verified successfully (demo)');
                    setIsDrawerOpen(false);
                  }}
                  className="px-5 py-2 rounded-full bg-[#0E1B2B] text-white text-xs font-medium hover:bg-black/90"
                >
                  Confirm Verification
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
