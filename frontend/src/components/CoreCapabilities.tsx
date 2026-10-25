import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, ListFilter, History, CheckCircle2 } from 'lucide-react';
import { TiltCard } from './common/TiltCard';

export const CoreCapabilities: React.FC = () => {
  const cards = [
    {
      id: 'spot-data-concerns',
      number: '01',
      title: 'Spot data concerns',
      tag: 'Deterministic Screening',
      icon: ShieldAlert,
      description:
        'Highlight records that need physical verification — from biological growth velocity outliers to stature decreases and stale tracking logs before official sync.',
      highlights: [
        'Biological plausibility threshold checks',
        'Automatic typo and decimal shift detection',
        'Transparent example rules (e.g. R-07)',
      ],
      assetName: 'ASSET: Data plausibility radar',
    },
    {
      id: 'prioritise-followups',
      number: '02',
      title: 'Prioritise follow-ups',
      tag: 'Action Queue Triage',
      icon: ListFilter,
      description:
        'Help supervisors organise cases by urgency and due date, ensuring children needing immediate nutritional attention or SAM verification are visited first.',
      highlights: [
        'Deterministic priority tiering (Urgent to Low)',
        'Explicit next-step ownership assigned to AWWs',
        'Due date tracking with overdue escalations',
      ],
      assetName: 'ASSET: Action queue triage flow',
    },
    {
      id: 'track-every-action',
      number: '03',
      title: 'Track every action',
      tag: 'Closed-Loop Accountability',
      icon: History,
      description:
        'Keep reviews, re-measurements, and referrals visible in an immutable chronological timeline with complete human oversight and visible audit lines.',
      highlights: [
        'Original readings permanently preserved',
        'Separate re-measurement logging with scale zeroing',
        'Visible audit line (actor, time, action, reason)',
      ],
      assetName: 'ASSET: Verification audit timeline',
    },
  ];

  return (
    <section
      id="capabilities"
      className="scroll-mt-28 sm:scroll-mt-32 py-20 px-4 sm:px-6 max-w-7xl mx-auto relative"
    >
      {/* Target anchor alias for core-capabilities with identical navbar offset */}
      <div
        id="core-capabilities"
        className="scroll-mt-28 sm:scroll-mt-32 absolute top-0 pointer-events-none"
        aria-hidden="true"
      />
      {/* Section Header: two columns, heading left, short description right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end mb-12">
        <div className="md:col-span-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-white/80 text-xs font-medium text-[#5B6B7C] shadow-sm mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F8A83]" />
            <span>Core capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#0E1B2B] tracking-[-0.02em] leading-tight">
            Designed for clarity in the field.
          </h2>
        </div>
        <div className="md:col-span-5">
          <p className="text-sm sm:text-base text-[#5B6B7C] leading-relaxed">
            Every feature is engineered to bridge the gap between digital data entry and frontline field action without imposing automated clinical decisions.
          </p>
        </div>
      </div>

      {/* 3 Glass Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
            >
              <TiltCard
                maxTilt={4}
                className="h-full rounded-[28px] frosted-glass p-7 border border-white/80 shadow-layered flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-mono font-semibold text-[#5B6B7C]">
                      {card.number}
                    </span>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/80 border border-black/5 text-[#0E1B2B]">
                      {card.tag}
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white/90 text-[#1F8A83] flex items-center justify-center mb-5 shadow-sm">
                    <Icon className="w-6 h-6 stroke-[1.75]" />
                  </div>

                  <h3 className="text-xl font-medium tracking-tight text-[#0E1B2B] mb-3">
                    {card.title}
                  </h3>

                  <p className="text-sm text-[#5B6B7C] leading-relaxed mb-6">
                    {card.description}
                  </p>

                  <div className="space-y-2.5 mb-8 border-t border-black/5 pt-4">
                    {card.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#0E1B2B]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1F8A83] shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sized placeholder frame */}
                <div className="w-full h-28 rounded-2xl bg-gradient-to-br from-[#CFEFD8]/30 to-[#D6E6F7]/40 border border-white/70 flex flex-col items-center justify-center p-3 text-center">
                  <div className="text-[11px] font-mono font-medium text-[#0E1B2B] uppercase tracking-wider">
                    {card.assetName}
                  </div>
                  <div className="text-[10px] text-[#5B6B7C] mt-1 font-mono">
                    3D Graphic / Interface Schematic
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
