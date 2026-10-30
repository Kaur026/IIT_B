import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface ClosingCtaProps {
  onNavigateDemo: () => void;
}

export const ClosingCta: React.FC<ClosingCtaProps> = ({ onNavigateDemo }) => {
  return (
    <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-[#CFEFD8] via-[#E4F4E9] to-[#D8E7FA] p-8 sm:p-12 lg:p-16 border border-white/60 shadow-[0_20px_50px_rgba(20,50,90,0.06)] bg-grain animate-gradient-drift">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          {/* Left Column: Heading and Action (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-start">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/70 backdrop-blur-md text-slate-800 shadow-sm border border-white/80 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2457F5]" />
              <span>Interactive Casework Simulation</span>
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#0F172A] tracking-tight leading-tight mb-4">
              See the action layer in action
            </h2>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-8 max-w-lg">
              Explore how automated plausibility screening, human verification checkpoints, and
              delegated casework prevent vulnerable children from slipping between detection and care.
            </p>

            <button
              type="button"
              onClick={onNavigateDemo}
              className="group inline-flex items-center gap-2.5 bg-[#0F172A] text-white text-sm sm:text-base font-medium px-8 py-4 rounded-full shadow-md hover:bg-slate-800 transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
            >
              <span>Explore dashboard demo</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </div>

          {/* Right Column: Two Warm Cut-Out Photos in Gradient Harmony (5 cols) */}
          <div className="lg:col-span-5 flex items-center justify-center gap-4 sm:gap-6 relative">
            {/* Photo 1: Worker Portrait */}
            <div className="w-36 sm:w-44 aspect-[3/4] rounded-[24px] overflow-hidden bg-white/50 p-2 shadow-lg border border-white/80 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="w-full h-full rounded-[18px] overflow-hidden bg-slate-100 relative">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8pgXVAnjS5ngrq18Pd3h7jE1dzgJygw2pIg4HygMzRyqU91-ksP6vmlbSwMi4offSgTcZGzjHM0zMJFFgd288MNWbxCQAYvbo-y33Jl07dXQUd7yKTR_ONvqVDGZS38XSAkv_t6_h0uzYKPkkdC50MOj24rJrMPmms40a4j3mOLg9SAn7PQPz-vN5KhO-wwR99skLhdR9fsocujjrZ3GrrEIBJ2-XODVY_1XHUDOUg18L1g3TwOkQ"
                  alt="Indian frontline community healthcare worker in clinic setting"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Photo 2: Mother and Child */}
            <div className="w-40 sm:w-52 aspect-[3/4] rounded-[24px] overflow-hidden bg-white/60 p-2 shadow-xl border border-white/80 transform rotate-2 hover:rotate-0 transition-transform duration-500 mt-6 sm:mt-10">
              <div className="w-full h-full rounded-[18px] overflow-hidden bg-slate-100 relative">
                <img
                  src="https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=600&q=80"
                  alt="Mother with child in village community setting"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Small Caption */}
        <div className="mt-8 pt-4 border-t border-slate-900/10 text-center lg:text-left text-[11px] text-slate-500 font-medium">
          Illustrative imagery • Academic student research prototype • Synthetic demographic models
        </div>
      </div>
    </section>
  );
};
