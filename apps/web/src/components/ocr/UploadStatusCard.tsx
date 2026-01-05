import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDocumentStatus } from '@/api/document.api';
import type { DocumentStatusResponse } from '@/api/document.api';

interface UploadStatusCardProps {
  documentId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  pollInterval?: number; // in milliseconds
  className?: string;
}

type StatusType = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

const statusConfig: Record<
  StatusType,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    color: string;
  }
> = {
  PENDING: {
    icon: Clock,
    label: '대기 중',
    description: 'OCR 처리를 준비하고 있습니다...',
    color: 'text-muted-foreground',
  },
  PROCESSING: {
    icon: Loader2,
    label: 'OCR 처리 중',
    description: '문서를 분석하고 있습니다...',
    color: 'text-primary',
  },
  COMPLETED: {
    icon: CheckCircle2,
    label: '완료',
    description: 'OCR 처리가 완료되었습니다.',
    color: 'text-green-600',
  },
  FAILED: {
    icon: XCircle,
    label: '실패',
    description: 'OCR 처리에 실패했습니다. 다시 시도해 주세요.',
    color: 'text-destructive',
  },
};

/**
 * UploadStatusCard - Displays OCR processing status with auto-polling
 */
export function UploadStatusCard({
  documentId,
  onComplete,
  onError,
  pollInterval = 2000,
  className,
}: UploadStatusCardProps) {
  const [status, setStatus] = useState<DocumentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const response = await getDocumentStatus(documentId);
        if (!isMounted) return;

        setStatus(response);

        if (response.status === 'COMPLETED') {
          onComplete?.();
        } else if (response.status === 'FAILED') {
          onError?.('OCR processing failed');
        } else {
          // Continue polling for PENDING or PROCESSING
          timeoutId = setTimeout(fetchStatus, pollInterval);
        }
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to fetch status';
        setError(message);
        onError?.(message);
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [documentId, pollInterval, onComplete, onError]);

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-medium">오류 발생</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div>
              <p className="font-medium">상태 확인 중...</p>
              <p className="text-sm text-muted-foreground">잠시만 기다려 주세요.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = statusConfig[status.status];
  const Icon = config.icon;
  const isProcessing = status.status === 'PROCESSING';

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          문서 처리 상태
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'rounded-full p-3',
              status.status === 'COMPLETED' && 'bg-green-100',
              status.status === 'FAILED' && 'bg-red-100',
              (status.status === 'PENDING' || status.status === 'PROCESSING') &&
                'bg-muted',
            )}
          >
            <Icon
              className={cn(
                'h-6 w-6',
                config.color,
                isProcessing && 'animate-spin',
              )}
            />
          </div>
          <div className="flex-1">
            <p className={cn('font-medium', config.color)}>{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {status.ocrJobId && (
          <p className="mt-4 text-xs text-muted-foreground">
            작업 ID: {status.ocrJobId}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default UploadStatusCard;
