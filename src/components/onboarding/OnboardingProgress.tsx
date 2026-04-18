'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: number;    // 1-indexed
}

export function OnboardingProgress({ steps, currentStep }: Props) {
  return (
    <nav aria-label="Onboarding progress" className="mb-6">
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const isDone = step.id < currentStep;
          const isActive = step.id === currentStep;
          return (
            <li key={step.id} className="flex items-center gap-2 flex-1">
              <div
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-full text-sm',
                  isDone && 'bg-emerald-100 text-emerald-700',
                  isActive && 'bg-blue-600 text-white',
                  !isDone && !isActive && 'bg-gray-100 text-gray-500',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center h-5 w-5 rounded-full text-xs font-semibold',
                    isDone && 'bg-emerald-500 text-white',
                    isActive && 'bg-white text-blue-600',
                    !isDone && !isActive && 'bg-gray-300 text-white',
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : step.id}
                </span>
                <span className="font-medium">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'h-px flex-1',
                    isDone ? 'bg-emerald-300' : 'bg-gray-200',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
