'use client';

import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PageErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function PageErrorFallback({ title, message, onRetry }: PageErrorFallbackProps) {
  return (
    <div className="container mx-auto py-16 px-4 max-w-md">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{title || '페이지를 불러올 수 없습니다'}</h2>
          <p className="text-sm text-gray-500 mb-6">{message || '일시적인 오류가 발생했습니다. 다시 시도해주세요.'}</p>
          <div className="flex gap-3 justify-center">
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                <RotateCcw className="h-4 w-4 mr-2" />다시 시도
              </Button>
            )}
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <Home className="h-4 w-4 mr-2" />홈으로
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
