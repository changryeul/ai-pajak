'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div className="container mx-auto py-16 px-4 max-w-md">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">페이지 오류</h2>
          <p className="text-sm text-gray-500 mb-6">
            일시적인 오류가 발생했습니다. 다시 시도해주세요.
          </p>
          {error.message && (
            <details className="text-left mb-4 text-xs bg-red-50 rounded p-2">
              <summary className="cursor-pointer text-red-700 font-medium">에러 상세 정보</summary>
              <p className="mt-2 text-red-800 font-mono break-all">{error.message}</p>
              {error.stack && (
                <pre className="mt-2 text-red-600 font-mono text-[10px] whitespace-pre-wrap overflow-auto max-h-48">{error.stack}</pre>
              )}
              {error.digest && <p className="mt-1 text-gray-400">Digest: {error.digest}</p>}
            </details>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />다시 시도
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <Home className="h-4 w-4 mr-2" />홈으로
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
