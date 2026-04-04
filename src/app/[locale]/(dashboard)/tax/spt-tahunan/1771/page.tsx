'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SPT1771Generator } from '@/components/spt';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Building2 } from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  company_name: string;
  npwp: string;
  customer_type: string;
}

export default function SPT1771Page() {
  const t = useTranslations('tax');
  const tp = useTranslations('sptPages');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { session, isLoading: sessionLoading } = useSession();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCustomer = session?.role === UserRole.CUSTOMER;

  useEffect(() => {
    if (sessionLoading) return;

    if (isCustomer && session?.customerId) {
      // Customer role: fetch own data directly
      fetchOwnCustomer(session.customerId);
    } else {
      // Consultant/Advisor: fetch customer list
      fetchCustomers();
    }
  }, [sessionLoading, session]);

  const fetchOwnCustomer = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch customer data');
      const data = await response.json();
      if (data.success && data.data) {
        const customer = {
          id: data.data.id,
          full_name: data.data.full_name,
          company_name: data.data.company_name || data.data.full_name,
          npwp: data.data.npwp || '',
          customer_type: data.data.customer_type || 'CORPORATE',
        };
        setSelectedCustomer(customer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers?type=COMPANY');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setSelectedCustomer(customer || null);
  };

  const getCustomerDisplayName = (customer: Customer) => {
    return customer.company_name || customer.full_name;
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/tax/spt-tahunan`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tp('back')}
        </Button>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Building2 className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tp('spt1771Title')}</h1>
            <p className="text-gray-600">
              {tp('spt1771Desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-orange-800">
          <strong>Tarif PPh Badan:</strong> 22% (standar) atau 11% untuk UMKM dengan omzet &lt; Rp 50 miliar.
          Formulir ini mencakup koreksi fiskal dan kompensasi kerugian hingga 10 tahun.
        </p>
      </div>

      {/* Customer Selection (Consultant only) */}
      {!isCustomer && !selectedCustomer && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{tp('selectTaxpayer')}</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">{tp('loadingData')}</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : customers.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                {tp('noCorpTaxpayer')}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => router.push(`/${locale}/customers/new`)}
              >
                {tp('addNewCorp')}
              </Button>
            </div>
          ) : (
            <Select onValueChange={handleCustomerSelect}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={tp('selectTaxpayerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {getCustomerDisplayName(customer)} ({customer.npwp || 'No NPWP'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Loading for customer role */}
      {isCustomer && isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error for customer role */}
      {isCustomer && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6">
          {error}
        </div>
      )}

      {/* SPT Generator */}
      {selectedCustomer && (
        <>
          {!isCustomer && (
            <div className="mb-4">
              <Button
                variant="outline"
                onClick={() => setSelectedCustomer(null)}
              >
                {tp('changeClient')}
              </Button>
            </div>
          )}

          <SPT1771Generator
            customerId={selectedCustomer.id}
            customerName={getCustomerDisplayName(selectedCustomer)}
            customerNpwp={selectedCustomer.npwp}
            onComplete={(data) => {
              console.log('SPT 1771 Generated:', data);
            }}
          />
        </>
      )}
    </div>
  );
}
