'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

interface PaymentButtonProps {
  transactionId: string;
  amount: number;
  description?: string;
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  className?: string;
  disabled?: boolean;
}

type PaymentStatus = 'idle' | 'loading' | 'success' | 'error' | 'pending';

export function PaymentButton({
  transactionId,
  amount,
  description,
  onSuccess,
  onPending,
  onError,
  onClose,
  className,
  disabled,
}: PaymentButtonProps) {
  const t = useTranslations();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const loadMidtransScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.snap) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_ENV === 'production';
      script.src = isProduction
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute(
        'data-client-key',
        process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
      );
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Midtrans script'));
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      // Load Midtrans Snap script if not already loaded
      await loadMidtransScript();

      // Get payment token from our API
      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to initiate payment');
      }

      const { paymentToken } = result.data;

      // Open Midtrans Snap popup
      window.snap?.pay(paymentToken, {
        onSuccess: (snapResult) => {
          setStatus('success');
          onSuccess?.(snapResult);
        },
        onPending: (snapResult) => {
          setStatus('pending');
          onPending?.(snapResult);
        },
        onError: (snapResult) => {
          setStatus('error');
          setErrorMessage('Payment failed. Please try again.');
          onError?.(new Error(JSON.stringify(snapResult)));
        },
        onClose: () => {
          if (status === 'loading') {
            setStatus('idle');
          }
          onClose?.();
        },
      });
    } catch (error) {
      setStatus('error');
      const message = error instanceof Error ? error.message : 'Payment failed';
      setErrorMessage(message);
      onError?.(error instanceof Error ? error : new Error(message));
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('payment.processing')}
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {t('payment.success')}
          </>
        );
      case 'pending':
        return (
          <>
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('payment.pending')}
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('payment.retry')}
          </>
        );
      default:
        return (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            {t('payment.payNow')} {formatCurrency(amount)}
          </>
        );
    }
  };

  const getButtonVariant = () => {
    switch (status) {
      case 'success':
        return 'outline';
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handlePayment}
        disabled={disabled || status === 'loading' || status === 'success'}
        variant={getButtonVariant()}
        className={className}
      >
        {getButtonContent()}
      </Button>
      {description && status === 'idle' && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      {errorMessage && status === 'error' && (
        <p className="text-xs text-red-600">{errorMessage}</p>
      )}
      {status === 'pending' && (
        <p className="text-xs text-amber-600">{t('payment.pendingMessage')}</p>
      )}
      {status === 'success' && (
        <p className="text-xs text-green-600">{t('payment.successMessage')}</p>
      )}
    </div>
  );
}
