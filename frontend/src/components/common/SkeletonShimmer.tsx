import React, { useState, useEffect } from 'react';

interface SkeletonShimmerProps {
  children: React.ReactNode;
  durationMs?: number;
}

export const SkeletonShimmer: React.FC<SkeletonShimmerProps> = ({ children, durationMs = 400 }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(false);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs]);

  if (!loading) {
    return <>{children}</>;
  }

  return (
    <div className="w-full space-y-6 animate-pulse" aria-busy="true" aria-label="Loading content shimmer">
      <div className="h-8 bg-slate-200/60 rounded-full w-1/3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white/80 rounded-2xl border border-slate-200/50 p-4 space-y-3">
            <div className="h-4 bg-slate-200/70 rounded-full w-1/2" />
            <div className="h-8 bg-slate-200/60 rounded-xl w-3/4" />
          </div>
        ))}
      </div>
      <div className="h-64 bg-white/90 rounded-[28px] border border-slate-200/60 p-6 space-y-4">
        <div className="h-5 bg-slate-200/60 rounded-full w-1/4" />
        <div className="space-y-2">
          <div className="h-10 bg-slate-100 rounded-xl w-full" />
          <div className="h-10 bg-slate-100 rounded-xl w-full" />
          <div className="h-10 bg-slate-100 rounded-xl w-full" />
        </div>
      </div>
    </div>
  );
};
