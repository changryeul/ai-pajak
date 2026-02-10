'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileCheck2, AlertTriangle, Clock, Plus } from 'lucide-react';

interface POA {
  id: string;
  poaNumber: string;
  status: 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  scope: string;
  validFrom: string;
  validTo: string;
  taxPartner: {
    id: string;
    organizationName: string;
  };
}

interface POAStatusWidgetProps {
  customerId?: string;
}

export function POAStatusWidget({ customerId }: POAStatusWidgetProps) {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [poas, setPoas] = useState<POA[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPOAs = useCallback(async () => {
    if (!customerId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/poa?customerId=${customerId}`);
      const data = await response.json();

      if (data.success) {
        setPoas(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch POAs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchPOAs();
  }, [fetchPOAs]);

  const getStatusBadge = (status: POA['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'PENDING_SIGNATURE':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
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

  const getStatusIcon = (status: POA['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <FileCheck2 className="h-5 w-5 text-green-600" />;
      case 'PENDING_SIGNATURE':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'EXPIRED':
      case 'REVOKED':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <FileCheck2 className="h-5 w-5 text-gray-400" />;
    }
  };

  const activePOA = poas.find(poa => poa.status === 'ACTIVE');
  const pendingPOA = poas.find(poa => poa.status === 'PENDING_SIGNATURE' || poa.status === 'DRAFT');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          {t('dashboard.poaStatus') || 'Power of Attorney Status'}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${locale}/poa/create`)}
        >
          <Plus className="h-4 w-4 mr-1" />
          New POA
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : poas.length === 0 ? (
          <div className="text-center py-6">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No Power of Attorney
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              You need to create a POA to enable tax filing services
            </p>
            <Button onClick={() => router.push(`/${locale}/poa/create`)}>
              Create POA
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activePOA && (
              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                {getStatusIcon(activePOA.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {activePOA.taxPartner.organizationName}
                    </span>
                    {getStatusBadge(activePOA.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    {activePOA.poaNumber} | Valid until {new Date(activePOA.validTo).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Scope: {activePOA.scope.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            )}

            {pendingPOA && !activePOA && (
              <div className="flex items-start gap-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                {getStatusIcon(pendingPOA.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {pendingPOA.taxPartner.organizationName}
                    </span>
                    {getStatusBadge(pendingPOA.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    {pendingPOA.poaNumber}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Action required: Complete signature process
                  </p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push(`/${locale}/poa/${pendingPOA.id}`)}
                  >
                    Complete Signing
                  </Button>
                </div>
              </div>
            )}

            {!activePOA && !pendingPOA && poas.length > 0 && (
              <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">No Active POA</p>
                  <p className="text-sm text-gray-600">
                    Your previous POA has expired or been revoked. Create a new one to continue tax filing.
                  </p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push(`/${locale}/poa/create`)}
                  >
                    Create New POA
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
