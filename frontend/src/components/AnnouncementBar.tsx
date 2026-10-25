import React from 'react';

export const AnnouncementBar: React.FC = () => {
  return (
    <aside
      aria-label="Academic prototype notice"
      className="w-full bg-[#0E1B2B] text-white/90 text-[11px] sm:text-xs py-2 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2 border-b border-white/10"
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#CFEFD8]" />
      <span>
        Student research prototype • Synthetic demo data only • Not affiliated with the Ministry of WCD
      </span>
    </aside>
  );
};
