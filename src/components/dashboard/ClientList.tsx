'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface Client {
  id: string;
  fullName: string;
  companyName: string | null;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  npwp: string;
  poaStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'NONE';
  pendingFilings: number;
  overdueFilings: number;
  lastActivity: string | null;
}

interface ClientListProps {
  consultantId?: string;
  limit?: number;
  showSearch?: boolean;
}

export function ClientList({ consultantId, limit = 10, showSearch = true }: ClientListProps) {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalClients, setTotalClients] = useState(0);

  const fetchClients = useCallback(async () => {
    if (!consultantId) return;

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        consultantId,
        limit: limit.toString(),
      });

      if (searchQuery) {
        queryParams.append('search', searchQuery);
      }

      const response = await fetch(`/api/customers?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        // Map the response to include filing stats
        const clientsWithStats = (data.data || data.customers || []).map((customer: {
          id: string;
          full_name: string;
          company_name: string | null;
          customer_type: 'INDIVIDUAL' | 'COMPANY';
          npwp: string;
          poa_status?: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'NONE';
          pending_filings?: number;
          overdue_filings?: number;
          last_activity?: string | null;
        }) => ({
          id: customer.id,
          fullName: customer.full_name,
          companyName: customer.company_name,
          customerType: customer.customer_type,
          npwp: customer.npwp,
          poaStatus: customer.poa_status || 'NONE',
          pendingFilings: customer.pending_filings || 0,
          overdueFilings: customer.overdue_filings || 0,
          lastActivity: customer.last_activity || null,
        }));

        setClients(clientsWithStats);
        setTotalClients(data.pagination?.total || clientsWithStats.length);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [consultantId, limit, searchQuery]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSearch = () => {
    fetchClients();
  };

  const getPOAStatusBadge = (status: Client['poaStatus']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">POA Active</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">POA Pending</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive">POA Expired</Badge>;
      case 'NONE':
        return <Badge variant="outline">No POA</Badge>;
      default:
        return null;
    }
  };

  const getClientStatusIcon = (client: Client) => {
    if (client.overdueFilings > 0) {
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    } else if (client.pendingFilings > 0) {
      return <Clock className="h-5 w-5 text-yellow-600" />;
    } else if (client.poaStatus === 'ACTIVE') {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    return <Users className="h-5 w-5 text-gray-400" />;
  };

  const clientsWithIssues = clients.filter(c => c.overdueFilings > 0 || c.pendingFilings > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">
            {t('dashboard.clients') || 'Clients'}
          </CardTitle>
          <Badge variant="secondary">{totalClients} total</Badge>
          {clientsWithIssues.length > 0 && (
            <Badge variant="destructive">{clientsWithIssues.length} need attention</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${locale}/consultant/clients`)}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {showSearch && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No clients found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  client.overdueFilings > 0
                    ? 'bg-red-50 border-red-200 hover:bg-red-100'
                    : client.pendingFilings > 0
                    ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                    : 'border-gray-100 hover:bg-gray-50'
                }`}
                onClick={() => router.push(`/${locale}/customers/${client.id}`)}
              >
                <div className="flex items-center gap-3">
                  {getClientStatusIcon(client)}
                  <div>
                    <p className="font-medium text-gray-900">
                      {client.customerType === 'COMPANY' ? client.companyName : client.fullName}
                    </p>
                    <p className="text-xs text-gray-500">
                      NPWP: {client.npwp
                        ? client.npwp.replace(/(\d{2})(\d{3})(\d{3})(\d{1})(\d{3})(\d{3})/, '$1.$2.$3.$4-$5.$6')
                        : t('clientList.npwpMissing')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {client.overdueFilings > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {client.overdueFilings} overdue
                    </Badge>
                  )}
                  {client.pendingFilings > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                      {client.pendingFilings} pending
                    </Badge>
                  )}
                  {getPOAStatusBadge(client.poaStatus)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
