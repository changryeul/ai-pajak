'use client';

import { CheckCircle, Clock, FileText, CreditCard, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'received', icon: FileText, label: '접수', labelId: 'Diterima' },
  { key: 'ebilling', icon: CreditCard, label: 'e-Billing', labelId: 'e-Billing' },
  { key: 'payment', icon: Clock, label: '납부 대기', labelId: 'Menunggu Bayar' },
  { key: 'verified', icon: CheckCircle, label: '검증', labelId: 'Diverifikasi' },
  { key: 'completed', icon: Send, label: '완료', labelId: 'Selesai' },
] as const;

const STATUS_TO_STEP: Record<string, number> = {
  PENDING: 0,
  DATA_REVIEW: 0,
  PENDING_APPROVAL: 0,
  APPROVED: 0,
  EBILLING_GENERATED: 1,
  PAYMENT_PENDING: 2,
  PAYMENT_UPLOADED: 3,
  PAYMENT_VERIFIED: 3,
  DJP_SUBMITTED: 4,
  BPE_UPLOADED: 4,
  COMPLETED: 4,
  FAILED: -1,
};

interface StatusTimelineProps {
  status: string;
}

export function StatusTimeline({ status }: StatusTimelineProps) {
  const currentStep = STATUS_TO_STEP[status] ?? 0;
  const isFailed = status === 'FAILED';

  return (
    <div className="flex items-center gap-1 w-full">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentStep && !isFailed;
        const isCompleted = i < currentStep && !isFailed;
        const isCompletedFinal = currentStep === 4 && i === 4 && status === 'COMPLETED';

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                  isCompletedFinal && 'bg-green-500 text-white',
                  isCompleted && !isCompletedFinal && 'bg-green-500 text-white',
                  isActive && !isCompletedFinal && 'bg-blue-500 text-white ring-2 ring-blue-200',
                  !isActive && !isCompleted && !isCompletedFinal && 'bg-gray-100 text-gray-400',
                  isFailed && 'bg-red-100 text-red-400'
                )}
              >
                {isCompleted || isCompletedFinal ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span className={cn(
                'text-[9px] text-center leading-tight',
                (isActive || isCompleted || isCompletedFinal) ? 'text-gray-700 font-medium' : 'text-gray-400'
              )}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 min-w-3 -mt-4',
                isCompleted ? 'bg-green-500' : 'bg-gray-200'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
