'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaxSavingsAdvisor } from '@/components/tax/TaxSavingsAdvisor';
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
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Customer {
  id: string;
  full_name: string;
  npwp: string;
}

export default function TaxSavingsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { session, isLoading: isSessionLoading } = useSession();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tp = useTranslations('sptPages');

  const isCustomerRole = session?.role === UserRole.CUSTOMER;

  const fetchOwnCustomerData = useCallback(async (customerId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch customer data');
      const data = await response.json();
      if (data.success && data.data) {
        setSelectedCustomer({
          id: data.data.id,
          full_name: data.data.full_name,
          npwp: data.data.npwp || '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/customers?type=INDIVIDUAL');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSessionLoading) return;
    if (isCustomerRole && session?.customerId) {
      fetchOwnCustomerData(session.customerId);
    } else if (!isCustomerRole) {
      fetchCustomers();
    } else {
      setIsLoading(false);
    }
  }, [isSessionLoading, isCustomerRole, session?.customerId, fetchOwnCustomerData, fetchCustomers]);

  if (isSessionLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tp('back')}
        </Button>

        <h1 className="text-2xl font-bold text-gray-900">Tax Savings Advisor</h1>
        <p className="text-gray-600 mt-1">
          Temukan peluang penghematan pajak dengan analisis AI
        </p>
      </div>

      {/* Customer Selection for Tax Advisors */}
      {!isCustomerRole && !selectedCustomer && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{tp('selectTaxpayer')}</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : (
            <Select onValueChange={(v) => setSelectedCustomer(customers.find((c) => c.id === v) || null)}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={tp('selectTaxpayerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name} ({c.npwp || 'No NPWP'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Advisor Component */}
      {selectedCustomer && (
        <>
          {!isCustomerRole && (
            <div className="mb-4">
              <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                {tp('changeClient')}
              </Button>
            </div>
          )}
          <TaxSavingsAdvisor
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.full_name}
          />
        </>
      )}
    </div>
  );
}
