import React from 'react';
import { BookOpen, AlertCircle, RefreshCw, ClipboardList } from 'lucide-react';

interface Note {
  id: string;
  topic: string;
  icon: React.ReactNode;
  content: string;
  context: string;
}

const FIELD_NOTES: Note[] = [
  {
    id: 'note-1',
    topic: 'Manual Register Audits',
    icon: <ClipboardList className="w-5 h-5 text-slate-700" />,
    content:
      'Supervisors review hundreds of monthly registers manually every day, making it difficult to catch subtle biometric discrepancies before monthly reports lock.',
    context: 'Observation from sector-level monthly anthropometry reconciliation',
  },
  {
    id: 'note-2',
    topic: 'Measurement Input Skews',
    icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
    content:
      'Wrong height and weight entries inadvertently occur during rushed village weighing sessions, generating false SAM alarms or masking faltering growth.',
    context: 'Frontline observation during Anganwadi Centre weighing days',
  },
  {
    id: 'note-3',
    topic: 'Uncoordinated Repeat Visits',
    icon: <RefreshCw className="w-5 h-5 text-sky-600" />,
    content:
      'Frontline teams make repeat home visits to re-check simply because there is no structured system to document why a prior reading seemed anomalous.',
    context: 'Field inquiry across rural and peri-urban catchment clusters',
  },
];

export const FieldNotes: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Pill Section Label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          Field observations
        </span>
      </div>

      {/* Two Column Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-16">
        <div className="lg:col-span-7">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight leading-tight">
            What we heard in the field
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            Direct takeaways from interactions with Lady Supervisors and Anganwadi workers operating
            under tight field schedules.
          </p>
          <span className="inline-block mt-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            Field-visit notes (paraphrased)
          </span>
        </div>
      </div>

      {/* Three Stacked Slightly Overlapping Frosted Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {FIELD_NOTES.map((note, idx) => (
          <div
            key={note.id}
            className="group relative bg-white/80 backdrop-blur-md rounded-[24px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] border border-slate-200/60 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-full bg-slate-100/90 flex items-center justify-center">
                  {note.icon}
                </div>
                <span className="font-mono text-xs text-slate-400 font-bold">
                  Note 0{idx + 1}
                </span>
              </div>

              <h3 className="text-base font-semibold text-slate-900 tracking-tight mb-3">
                {note.topic}
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed italic">
                "{note.content}"
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{note.context}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
