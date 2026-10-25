import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Construction, Info } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white/90 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-8 sm:p-12 shadow-sm max-w-3xl mx-auto text-center space-y-6"
      >
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Info className="w-8 h-8 text-slate-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-light tracking-tight text-[#0F172A]">
            {title}
          </h1>
          <p className="text-base text-slate-500 font-normal">
            This screen is not part of the current prototype design.
          </p>
        </div>

        <div className="pt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457F5]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
