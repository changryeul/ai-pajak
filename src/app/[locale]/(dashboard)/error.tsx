'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('dashboardError');

  useEffect(() => {
    // 풍부한 dump — minified 에러도 모든 속성을 펼쳐서 콘솔에 노출.
    console.error('[Dashboard Error] name=', error.name, 'message=', error.message, 'digest=', error.digest);
    console.error('[Dashboard Error] full:', error);
    if (error.cause) console.error('[Dashboard Error] cause:', error.cause);
    if (error.stack) console.error('[Dashboard Error] stack:', error.stack);
  }, [error]);

  return (
    <div className="container mx-auto py-16 px-4 max-w-md">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('pageError')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {t('tempError')}
          </p>
          <details className="text-left mb-4 text-xs bg-red-50 rounded p-2" open>
            <summary className="cursor-pointer text-red-700 font-medium">{t('errorDetails')}</summary>
            <p className="mt-2 text-red-800 font-mono break-all">
              <strong>name:</strong> {error.name || '(none)'}<br />
              <strong>message:</strong> {error.message || '(empty)'}<br />
              {error.digest && <><strong>digest:</strong> {error.digest}<br /></>}
              {error.cause ? <><strong>cause:</strong> {String(error.cause)}<br /></> : null}
            </p>
            {error.stack && (
              <pre className="mt-2 text-red-600 font-mono text-[10px] whitespace-pre-wrap overflow-auto max-h-64">{error.stack}</pre>
            )}
          </details>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />{t('retry')}
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <Home className="h-4 w-4 mr-2" />{t('home')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
