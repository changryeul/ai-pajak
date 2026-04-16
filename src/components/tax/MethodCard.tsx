'use client';

import { type LucideIcon } from 'lucide-react';

interface MethodCardProps {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
  icon?: LucideIcon;
}

export function MethodCard({ active, title, desc, onClick, icon: Icon }: MethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all hover:border-blue-300 ${
        active ? 'border-blue-500 bg-blue-50' : 'bg-white'
      }`}
    >
      {Icon && (
        <div className="mb-2 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </button>
  );
}
