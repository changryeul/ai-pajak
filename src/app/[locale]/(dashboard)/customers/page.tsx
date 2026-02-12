'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  UserCheck,
  FileText,
  Search,
  ChevronRight,
  Building2,
  User,
  Loader2,
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  created_at: string;
  poa_status: 'none' | 'pending' | 'active';
  filing_count: number;
}

interface CustomerStats {
  total: number;
  active: number;
  activePoa: number;
  pendingFilings: number;
}

export default function CustomersPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    total: 0,
    active: 0,
    activePoa: 0,
    pendingFilings: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();

      if (data.success) {
        setCustomers(data.customers || []);
        setStats(data.stats || {
          total: data.customers?.length || 0,
          active: 0,
          activePoa: 0,
          pendingFilings: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.full_name?.toLowerCase().includes(query) ||
      customer.company_name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.npwp?.toLowerCase().includes(query)
    );
  });

  const getPoaStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">{t('customers.poaActive')}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">{t('customers.poaPending')}</Badge>;
      default:
        return <Badge variant="outline">{t('customers.noPoaYet')}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('customers.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('customers.description')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">{t('customers.totalCustomers')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.activePoa}</p>
                <p className="text-sm text-gray-500">{t('customers.activePOA')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingFilings}</p>
                <p className="text-sm text-gray-500">{t('customers.pendingFilings')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {customers.filter((c) => c.customer_type === 'COMPANY').length}
                </p>
                <p className="text-sm text-gray-500">{t('customers.company')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardContent className="p-6">
          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('customers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-sm text-gray-500">
              {filteredCustomers.length} {t('customers.customersFound')}
            </p>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('customers.noCustomers')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('customers.name')}</TableHead>
                  <TableHead>{t('customers.customerType')}</TableHead>
                  <TableHead>{t('customers.npwp')}</TableHead>
                  <TableHead>{t('customers.poaStatus')}</TableHead>
                  <TableHead>{t('customers.filings')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          {customer.customer_type === 'COMPANY' ? (
                            <Building2 className="h-4 w-4 text-gray-600" />
                          ) : (
                            <User className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {customer.company_name || customer.full_name}
                          </p>
                          {customer.company_name && (
                            <p className="text-sm text-gray-500">{customer.full_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {customer.customer_type === 'COMPANY'
                          ? t('customers.company')
                          : t('customers.individual')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{customer.npwp || '-'}</span>
                    </TableCell>
                    <TableCell>{getPoaStatusBadge(customer.poa_status)}</TableCell>
                    <TableCell>
                      <span className="text-gray-600">{customer.filing_count}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/${locale}/customers/${customer.id}`)}
                      >
                        {t('customers.viewDetails')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
