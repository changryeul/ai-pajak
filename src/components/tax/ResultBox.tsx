'use client';

interface ResultBoxProps {
  title: string;
  line1?: string;
  line2: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-slate-50',
  success: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  danger: 'bg-red-50 border-red-200',
};

export function ResultBox({ title, line1, line2, variant = 'default' }: ResultBoxProps) {
  return (
    <div className={`w-full rounded-xl border p-3 text-sm ${variantStyles[variant]}`}>
      <p className="font-medium text-slate-700">{title}</p>
      {line1 ? <p className="mt-1 text-xs text-slate-500">{line1}</p> : null}
      <p className="mt-1 font-mono font-semibold">{line2}</p>
    </div>
  );
}
