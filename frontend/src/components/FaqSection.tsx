import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Does this replace Poshan Tracker?',
    answer:
      'No. This site presents workflow concepts and does not replace or connect to official Poshan Tracker services.',
  },
  {
    id: 'faq-2',
    question: 'Is real child data used?',
    answer:
      'Never. All beneficiary records, growth trajectories, and identifying details shown here are synthetic mock data. No real citizen Aadhaar, child names, biometric measurements, or confidential health records are processed or stored.',
  },
  {
    id: 'faq-3',
    question: 'Does this demo use live AI?',
    answer:
      'No. Live AI assistance is not connected yet. Screening uses deterministic demo rules on synthetic data, and any suggested actions are rule-based examples. Flags are not diagnoses. A trained human must review and confirm every verification, re-weighing assignment, clinical referral, and case closure.',
  },
  {
    id: 'faq-4',
    question: 'Is this an official government service?',
    answer:
      'No. It is independent and is not operated, endorsed, or connected to the Government of India, MoWCD, or any State Nutrition Mission.',
  },
  {
    id: 'faq-5',
    question: 'What happens when the network is weak?',
    answer:
      'The architecture is engineered with offline-first caching. Anganwadi workers and Lady Supervisors can download active case queues at the sector office or village hotspot, review historical trajectories offline during home visits, and stage re-measurement entries locally. The queue synchronizes automatically as soon as intermittent connectivity is re-established.',
  },
];

export const FaqSection: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('faq-1');

  const toggleFaq = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto">
      {/* Pill Section Label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          Questions &amp; answers
        </span>
      </div>

      {/* Two Column Header */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end mb-12">
        <div className="md:col-span-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight leading-tight">
            Frequently asked questions
          </h2>
        </div>
        <div className="md:col-span-4">
          <p className="text-slate-500 text-sm leading-relaxed">
            Everything you need to know about the project purpose, data boundaries, and verification
            safeguards.
          </p>
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-4">
        {FAQS.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div
              key={faq.id}
              className={`rounded-[22px] transition-all duration-200 border ${
                isOpen
                  ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-slate-200/80'
                  : 'bg-white/60 hover:bg-white border-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleFaq(faq.id)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${faq.id}`}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5] rounded-[22px]"
              >
                <span className="text-base sm:text-lg font-medium text-slate-900 pr-4">
                  {faq.question}
                </span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                    isOpen
                      ? 'bg-slate-900 text-white rotate-45'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`faq-answer-${faq.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100/60 mt-1">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
};
