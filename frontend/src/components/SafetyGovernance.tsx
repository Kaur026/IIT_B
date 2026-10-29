import React from 'react';
import { UserCheck, ShieldCheck, WifiOff, Shield } from 'lucide-react';

export const SafetyGovernance: React.FC = () => {
  const cards = [
    {
      title: 'Human-in-the-loop review',
      description:
        'Automated checks screen cases for plausibility; supervisors and community workers make all final diagnostic and care decisions.',
      icon: <UserCheck className="w-5 h-5 text-emerald-600" />,
      tag: 'Supervisory Control',
    },
    {
      title: 'Zero personal identifiers',
      description:
        'Uses synthetic research mock datasets. Designed to comply with national digital personal data protection norms.',
      icon: <ShieldCheck className="w-5 h-5 text-[#2457F5]" />,
      tag: 'DPDP Aligned',
    },
    {
      title: 'Offline-resilient queue',
      description:
        'Engineered to store and synchronize casework queues over periodic 2G/3G connectivity in remote rural and tribal sectors.',
      icon: <WifiOff className="w-5 h-5 text-amber-600" />,
      tag: 'Low-Bandwidth Native',
    },
  ];

  return (
    <section id="about" className="scroll-mt-28 sm:scroll-mt-32 py-20 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Pill Section Label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
          Safety and governance
        </span>
      </div>

      {/* Two Column Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-12">
        <div className="lg:col-span-7">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#0F172A] tracking-tight leading-tight">
            Built with clinical safety and privacy at the core
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            Protecting vulnerable children and frontline workers by ensuring algorithms remain humble
            assistants, never automated decision-makers.
          </p>
        </div>
      </div>

      {/* 3 Governance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-[24px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.07)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  {card.icon}
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
                  {card.tag}
                </span>
              </div>

              <h3 className="text-lg font-medium text-slate-900 tracking-tight mb-2">
                {card.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {card.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Safety invariant verified</span>
            </div>
          </div>
        ))}
      </div>

      {/* Calm Banner */}
      <div className="rounded-[24px] bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/60 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-emerald-700 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-sm sm:text-base font-medium text-slate-800">
            Algorithms screen only for plausibility; every decision stays with a trained human.
          </p>
        </div>

        <a
          href="#workflow"
          className="shrink-0 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-white px-4 py-2 rounded-full shadow-sm hover:shadow transition-all"
        >
          View Verification Protocol →
        </a>
      </div>
    </section>
  );
};
