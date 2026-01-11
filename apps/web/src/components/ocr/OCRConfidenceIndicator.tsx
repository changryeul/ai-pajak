import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface OCRConfidenceIndicatorProps {
  confidence: number | null;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Story 2-5: OCR Confidence Indicator
 * Displays confidence level with color coding (per AC #3):
 * - High (>= 90%): Green
 * - Medium (70-89%): Yellow/Orange
 * - Low (< 70%): Red
 * - Unknown (null): Gray
 *
 * Task 4.4: Tooltip shows detailed confidence information
 */
export function OCRConfidenceIndicator({
  confidence,
  showPercentage = true,
  size = 'md',
}: OCRConfidenceIndicatorProps) {
  // Convert decimal (0-1) to percentage (0-100) if needed
  const normalizedConfidence = confidence !== null && confidence <= 1
    ? confidence * 100
    : confidence;

  const getConfidenceLevel = (conf: number | null) => {
    if (conf === null) return 'unknown';
    if (conf >= 90) return 'high';
    if (conf >= 70) return 'medium';
    return 'low';
  };

  const level = getConfidenceLevel(normalizedConfidence);

  const levelStyles = {
    high: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-red-100 text-red-800 border-red-200',
    unknown: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const levelLabels = {
    high: '높음 (신뢰할 수 있음)',
    medium: '보통 (검토 필요)',
    low: '낮음 (수정 필요)',
    unknown: 'AI 처리됨 (신뢰도 점수 없음)',
  };

  const label = normalizedConfidence !== null
    ? showPercentage
      ? `${Math.round(normalizedConfidence)}%`
      : level.charAt(0).toUpperCase() + level.slice(1)
    : 'N/A';

  const tooltipContent = normalizedConfidence !== null
    ? `신뢰도: ${normalizedConfidence.toFixed(1)}% - ${levelLabels[level]}`
    : levelLabels.unknown;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              levelStyles[level],
              sizeStyles[size],
              'font-medium cursor-help'
            )}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
