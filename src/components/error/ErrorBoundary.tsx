'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallbackUI({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const t = useTranslations('errorBoundary');
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">{t('title')}</h2>
      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
        {error?.message || t('defaultMessage')}
      </p>
      <Button variant="outline" onClick={onReset}>
        <RotateCcw className="h-4 w-4 mr-2" />{t('retry')}
      </Button>
    </div>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallbackUI
          error={this.state.error}
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
