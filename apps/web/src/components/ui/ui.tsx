// src/components/ui.tsx
import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md font-semibold transition border';
  const sizes = size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4';
  const variants =
    variant === 'outline'
      ? 'bg-transparent border-slate-300 hover:bg-slate-100'
      : variant === 'ghost'
        ? 'bg-transparent border-transparent hover:bg-slate-100'
        : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800';
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />;
}

export function Card({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      {...props}
    />
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-300 ${className}`}
      {...props}
    />
  );
}

export function Label({
  className = '',
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-semibold text-slate-700 ${className}`} {...props} />;
}

export function Badge({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 ${className}`}
      {...props}
    />
  );
}