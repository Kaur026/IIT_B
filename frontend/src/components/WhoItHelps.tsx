import React from 'react';

interface Stakeholder {
  index: string;
  role: string;
  shortTitle: string;
  description: string;
  avatar: string;
  gradient: string;
  badge: string;
}

const STAKEHOLDERS: Stakeholder[] = [
  {
    index: '01',
    role: 'Anganwadi Worker (AWW)',
    shortTitle: 'Frontline Care & Weighing',
    description:
      'Conducts monthly weigh-ins, receives clear re-check prompts, and logs home visits without paperwork clutter.',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    gradient: 'from-emerald-100 to-teal-50',
    badge: 'Field Execution',
  },
  {
    index: '02',
    role: 'Lady Supervisor (LS)',
    shortTitle: 'Sector Casework & Triage',
    description:
      'Reviews flagged records across 25–30 Anganwadi centres, triaging urgent casework in minutes instead of manual register audits.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    gradient: 'from-sky-100 to-indigo-50',
    badge: 'Supervisory Triage',
  },
  {
    index: '03',
    role: 'Child Dev. Project Officer (CDPO)',
    shortTitle: 'Block Administration',
    description:
      'Monitors block-level resolution rates, overdue follow-ups, and referral completion without data blindness.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    gradient: 'from-teal-100 to-cyan-50',
    badge: 'Block Oversight',
  },
  {
    index: '04',
    role: 'District Programme Officer (DPO)',
    shortTitle: 'District Strategy & Governance',
    description:
      'Oversees district-wide nutritional trends, equipment calibration logs, and resource allocation backed by audited data.',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
    gradient: 'from-blue-100 to-slate-100',
    badge: 'Policy & Audit',
  },
];

export const WhoItHelps: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Pill Section Label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          Stakeholders
        </span>
      </div>

      {/* Two Column Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-16">
        <div className="lg:col-span-7">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight leading-tight">
            Designed for every tier of frontline care
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            From grassroots community workers in village centres to district administrators, each tier
            sees only what they need to act decisively.
          </p>
        </div>
      </div>

      {/* Row of Cards with Circular Gradient Portraits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {STAKEHOLDERS.map((item) => (
          <div
            key={item.role}
            className="group bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.07)] border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 flex flex-col items-center text-center"
          >
            {/* Index tag */}
            <div className="w-full flex items-center justify-between mb-4">
              <span className="font-mono text-xs font-bold text-slate-400">{item.index}</span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            </div>

            {/* Circular Gradient Portrait Frame */}
            <div className="relative mb-5">
              <div
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-gradient-to-tr ${item.gradient} shadow-inner flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 border-2 border-white">
                  <img
                    src={item.avatar}
                    alt={`${item.role} representative portrait`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover grayscale-[15%] group-hover:grayscale-0 transition-all duration-300"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Role title & description */}
            <h3 className="text-base font-semibold text-slate-900 tracking-tight mb-1">
              {item.role}
            </h3>
            <p className="text-xs font-medium text-slate-400 mb-3">{item.shortTitle}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
