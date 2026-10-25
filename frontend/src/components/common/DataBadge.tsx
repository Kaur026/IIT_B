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
  beneficiary: 'bg-[#F5F7FB] text-[#172B4D] border-[#2457F5]/30',
  action: 'bg-[#C9DCCF] text-[#172B4D] border-[#172B4D]/20',
  centre: 'bg-[#C9DCCF] text-[#172B4D] border-[#172B4D]/20',
  rule: 'bg-[#F5F7FB] text-[#172B4D] border-[#2457F5]/30',
  worker: 'bg-[#FFFFFF] text-[#172B4D] border-[#2457F5]/30',
  previous: 'bg-[#C9DCCF]/55 text-[#172B4D] border-[#172B4D]/20',
  flagged: 'bg-rose-50 text-rose-800 border-rose-200',
  delta: 'bg-rose-100 text-rose-900 border-rose-200',
  date: 'bg-[#F5F7FB] text-[#172B4D] border-[#2457F5]/25',
  neutral: 'bg-[#C9DCCF]/55 text-[#172B4D] border-[#172B4D]/20',
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
