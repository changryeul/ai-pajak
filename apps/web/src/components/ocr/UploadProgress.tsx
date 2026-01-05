import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadProgressProps {
  filename: string;
  progress: number;
  onCancel?: () => void;
  className?: string;
}

/**
 * UploadProgress - Shows file upload progress with cancel option
 */
export function UploadProgress({
  filename,
  progress,
  onCancel,
  className,
}: UploadProgressProps) {
  const isComplete = progress >= 100;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className={cn('h-5 w-5 text-primary', !isComplete && 'animate-pulse')} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium truncate" title={filename}>
                {filename}
              </p>
              <span className="text-xs text-muted-foreground ml-2">
                {isComplete ? '완료' : `${progress}%`}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {!isComplete && onCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={onCancel}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">취소</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default UploadProgress;
