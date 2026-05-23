'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/hooks/useSession';
import {
  FileSignature,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  User,
  FileText,
  Loader2,
} from 'lucide-react';

interface POADetail {
  id: string;
  poaNumber: string;
  status: 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  scope: string;
  validFrom: string;
  validTo: string;
  notes?: string;
  customerSignedAt?: string;
  advisorSignedAt?: string;
  createdAt: string;
  customer?: {
    id: string;
    fullName: string;
    npwp: string;
  };
  taxPartner?: {
    id: string;
    organizationName: string;
  };
}

export default function POADetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const poaId = params.id as string;

  const [poa, setPoa] = useState<POADetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // `loadError` blocks the page (initial fetch failed → can't render anything).
  // `signError` is inline (page renders, but the last sign attempt failed).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [isSigningCustomer, setIsSigningCustomer] = useState(false);
  const [isSigningAdvisor, setIsSigningAdvisor] = useState(false);

  const { session } = useSession();
  // Customer-sign button is meaningful only for the POA owner (CUSTOMER whose
  // customerId matches poa.customer_id). Advisor-sign is for consultants
  // belonging to the POA's tax_partner. We can't verify tax_partner_id from the
  // session alone, so we just gate by role.
  const isPoaOwner =
    session?.role === 'CUSTOMER' &&
    !!poa &&
    !!session.customerId &&
    session.customerId === (poa as POADetail & { customer_id?: string }).customer_id;
  const isAdvisorRole =
    session?.role === 'CONSULTANT_JTC' || session?.role === 'TAX_ADVISOR_JTC';

  const fetchPOA = useCallback(async () => {
    try {
      const response = await fetch(`/api/poa/${poaId}`);
      const data = await response.json();

      if (data.success) {
        setPoa(data.data);
      } else {
        setLoadError(data.error || 'Failed to load POA');
      }
    } catch {
      setLoadError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [poaId]);

  useEffect(() => {
    fetchPOA();
  }, [fetchPOA]);

  const handleCustomerSign = async () => {
    setIsSigningCustomer(true);
    setSignError(null);
    try {
      const response = await fetch(`/api/poa/${poaId}/customer-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        fetchPOA();
      } else {
        setSignError(data.error || 'Failed to sign POA');
      }
    } catch {
      setSignError('Failed to sign POA');
    } finally {
      setIsSigningCustomer(false);
    }
  };

  const handleAdvisorSign = async () => {
    setIsSigningAdvisor(true);
    setSignError(null);
    try {
      const response = await fetch(`/api/poa/${poaId}/advisor-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        fetchPOA();
      } else {
        setSignError(data.error || 'Failed to sign POA');
      }
    } catch {
      setSignError('Failed to sign POA');
    } finally {
      setIsSigningAdvisor(false);
    }
  };

  const getStatusBadge = (status: POADetail['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'PENDING_SIGNATURE':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Signature</Badge>;
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive">Expired</Badge>;
      case 'REVOKED':
        return <Badge variant="secondary">Revoked</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: POADetail['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'PENDING_SIGNATURE':
        return <Clock className="h-6 w-6 text-yellow-600" />;
      case 'EXPIRED':
      case 'REVOKED':
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      default:
        return <FileSignature className="h-6 w-6 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (loadError || !poa) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {t('poa.notFound') || 'POA Not Found'}
            </h2>
            <p className="text-gray-600 mb-4">{loadError || 'Unable to load POA details'}</p>
            <Button onClick={() => router.push(`/${locale}/dashboard`)}>
              {t('common.back') || 'Back to Dashboard'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {t('poa.detailTitle') || 'Power of Attorney'}
            </h1>
            {getStatusBadge(poa.status)}
          </div>
          <p className="text-gray-500 mt-1">{poa.poaNumber}</p>
        </div>
        {getStatusIcon(poa.status)}
      </div>

      {/* Sign-action error (inline — replaced the old full-page error fallback
          that used to swallow the whole detail screen on 403). */}
      {signError && (
        <Card className="mb-6 bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-900">
                {t('poa.signError') || 'Could not sign the POA'}
              </p>
              <p className="text-sm text-red-700 mt-1">{signError}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-700"
              onClick={() => setSignError(null)}
            >
              ×
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      {poa.status === 'DRAFT' && (
        <Card className="mb-6 bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">
                  {t('poa.actionRequired') || 'Action Required'}
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  {t('poa.signatureRequired') || 'Please sign this POA to proceed with tax filing services.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {poa.status === 'ACTIVE' && (
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">
                  {t('poa.active') || 'POA is Active'}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {t('poa.activeDescription') || 'You can now use tax filing services with Jakarta Tax Consulting.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('poa.details') || 'POA Details'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">{t('poa.scope.label') || 'Scope'}</p>
              <p className="font-medium">{poa.scope?.replace(/_/g, ' ') || 'All Tax Types'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('poa.status') || 'Status'}</p>
              <p className="font-medium">{poa.status.replace(/_/g, ' ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {t('poa.validFrom') || 'Valid From'}
              </p>
              <p className="font-medium">{formatDate(poa.validFrom)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {t('poa.validTo') || 'Valid Until'}
              </p>
              <p className="font-medium">{formatDate(poa.validTo)}</p>
            </div>
          </div>

          {poa.notes && (
            <div>
              <p className="text-sm text-gray-500">{t('poa.notes') || 'Notes'}</p>
              <p className="font-medium">{poa.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parties */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              {t('poa.customer') || 'Customer'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{poa.customer?.fullName || 'N/A'}</p>
            <p className="text-sm text-gray-500">NPWP: {poa.customer?.npwp || 'N/A'}</p>
            {poa.customerSignedAt ? (
              <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                Signed on {formatDate(poa.customerSignedAt)}
              </div>
            ) : isPoaOwner ? (
              <Button
                className="mt-3 w-full"
                onClick={handleCustomerSign}
                disabled={isSigningCustomer || poa.status !== 'DRAFT'}
              >
                {isSigningCustomer ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileSignature className="h-4 w-4 mr-2" />
                )}
                {t('poa.signAsCustomer') || 'Sign as Customer'}
              </Button>
            ) : (
              // Advisor / supervisor / admin view — read-only status text so
              // the customer-sign button isn't clickable from staff accounts
              // (which would 403 and previously blew the page to error state).
              <p className="mt-3 text-sm text-gray-500">
                {t('poa.awaitingCustomerSignature') || 'Awaiting customer signature'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tax Partner */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t('poa.taxPartner') || 'Tax Partner'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{poa.taxPartner?.organizationName || 'Jakarta Tax Consulting'}</p>
            <p className="text-sm text-gray-500">Licensed Tax Consultant</p>
            {poa.advisorSignedAt ? (
              <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                Countersigned on {formatDate(poa.advisorSignedAt)}
              </div>
            ) : poa.customerSignedAt && isAdvisorRole ? (
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={handleAdvisorSign}
                disabled={isSigningAdvisor}
              >
                {isSigningAdvisor ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileSignature className="h-4 w-4 mr-2" />
                )}
                {t('poa.countersign') || 'Countersign (Advisor)'}
              </Button>
            ) : poa.customerSignedAt ? (
              <p className="mt-3 text-sm text-gray-500">
                {t('poa.awaitingAdvisorCountersign') || 'Awaiting tax advisor countersignature'}
              </p>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                {t('poa.awaitingCustomerSignature') || 'Awaiting customer signature'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push(`/${locale}/dashboard`)}>
          {t('common.back') || 'Back to Dashboard'}
        </Button>
        {poa.status === 'ACTIVE' && (
          <Button onClick={() => router.push(`/${locale}/tax/new`)}>
            {t('poa.startFiling') || 'Start Tax Filing'}
          </Button>
        )}
      </div>
    </div>
  );
}
