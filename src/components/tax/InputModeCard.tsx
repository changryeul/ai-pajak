'use client';

import { FileText, type LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface InputModeCardProps {
  active: boolean;
  title: string;
  desc: string;
  footer?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function InputModeCard({ active, title, desc, footer, icon: Icon = FileText, children }: InputModeCardProps) {
  return (
    <div
      className={`space-y-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
        active ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200'
      }`}
    >
      <div className="flex justify-center text-blue-600">
        <Icon className="h-8 w-8" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-slate-500">{desc}</p>
      {children}
      {footer ? <p className="text-xs text-slate-400">{footer}</p> : null}
    </div>
  );
}
