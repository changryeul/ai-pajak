'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TAX_STYLES: Record<string, { bg: string; text: string }> = {
  PPh21: { bg: 'bg-blue-100', text: 'text-blue-700' },
  PPh23: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  PPh26: { bg: 'bg-purple-100', text: 'text-purple-700' },
  PPh4_2: { bg: 'bg-amber-100', text: 'text-amber-700' },
  PPh22: { bg: 'bg-pink-100', text: 'text-pink-700' },
  PPN: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

interface TaxResolutionBadgeProps {
  taxType: string;
  rate: number;
  isFinal?: boolean;
  className?: string;
}

export function TaxResolutionBadge({ taxType, rate, isFinal, className }: TaxResolutionBadgeProps) {
  const style = TAX_STYLES[taxType] || { bg: 'bg-gray-100', text: 'text-gray-700' };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge className={cn('text-xs font-semibold', style.bg, style.text)}>
        {taxType.replace('_', ' ')}
      </Badge>
      <span className="text-xs text-gray-600 font-mono">{(rate * 100).toFixed(1)}%</span>
      {isFinal && (
        <Badge variant="outline" className="text-[10px] text-gray-500">Final</Badge>
      )}
    </div>
  );
}
