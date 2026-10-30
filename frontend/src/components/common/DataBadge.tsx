import React from 'react';

export type DataBadgeVariant =
  | 'beneficiary'
  | 'action'
  | 'centre'
  | 'rule'
  | 'worker'
  | 'previous'
  | 'flagged'
  | 'delta'
  | 'date'
  | 'neutral';

interface DataBadgeProps {
  children: React.ReactNode;
  variant?: DataBadgeVariant;
  className?: string;
  title?: string;
}

const variantStyles: Record<DataBadgeVariant, string> = {
  beneficiary: 'bg-blue-50/90 text-blue-900 border-blue-200/80',
  action: 'bg-slate-100 text-slate-800 border-slate-200/80',
  centre: 'bg-sky-50 text-sky-900 border-sky-200/80',
  rule: 'bg-purple-50 text-purple-900 border-purple-200/80',
  worker: 'bg-indigo-50 text-indigo-900 border-indigo-200/80',
  previous: 'bg-slate-100 text-slate-700 border-slate-200/80',
  flagged: 'bg-rose-50 text-rose-800 border-rose-200',
  delta: 'bg-rose-100/90 text-rose-900 border-rose-200',
  date: 'bg-slate-50 text-slate-600 border-slate-200/80',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200/80',
};

export const DataBadge: React.FC<DataBadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
  title,
}) => (
  <span
    title={title}
    className={`inline-flex min-h-6 max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold leading-tight ${variantStyles[variant]} ${className}`}
  >
    {children}
  </span>
);
