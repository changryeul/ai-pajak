'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SPT1770SSGenerator } from '@/components/spt';
import { SPTIntake } from '@/components/spt/SPTIntake';
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
import { ArrowLeft, Loader2, User, CheckCircle } from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  npwp: string;
  customer_type: string;
  ptkp_status?: string | null;
}

export default function SPT1770SSPage() {
  const _t = useTranslations('tax');
  const tp = useTranslations('sptPages');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { session, isLoading: isSessionLoading } = useSession();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is a customer (not tax advisor/consultant)
  const isCustomerRole = session?.role === UserRole.CUSTOMER;

  // Fetch customer data for CUSTOMER role users
  const fetchOwnCustomerData = useCallback(async (customerId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch customer data');
      const data = await response.json();
      if (data.success && data.data) {
        setSelectedCustomer({
          id: data.data.id,
          full_name: data.data.full_name,
          npwp: data.data.npwp || '',
          customer_type: data.data.customer_type,
          ptkp_status: data.data.ptkp_status || null,
        });
      } else {
        throw new Error(data.error || 'Failed to load customer data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch customers list for tax advisors
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
      // Customer role: auto-fetch own data
      fetchOwnCustomerData(session.customerId);
    } else if (!isCustomerRole) {
      // Tax advisor role: fetch customer list
      fetchCustomers();
    } else {
      setIsLoading(false);
    }
  }, [isSessionLoading, isCustomerRole, session?.customerId, fetchOwnCustomerData, fetchCustomers]);

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setSelectedCustomer(customer || null);
  };

  // Show loading while session is being fetched
  if (isSessionLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">{tp('loadingData')}</p>
      </div>
    );
  }

  // CUSTOMER role gets the simple intake flow (upload KK + A1 + assets/liabilities,
  // submit to JTC for processing). Advisors get the full generator wizard.
  if (isCustomerRole) {
    if (isLoading || !selectedCustomer) {
      return (
        <div className="container mx-auto py-20 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">{tp('loadingData')}</p>
        </div>
      );
    }
    return (
      <div className="container mx-auto py-8 px-4">
        <SPTIntake
          form="1770SS"
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.full_name}
          customerNpwp={selectedCustomer.npwp}
        />
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

        <h1 className="text-2xl font-bold text-gray-900">{tp('spt1770SSTitle')}</h1>
        <p className="text-gray-600 mt-1">
          {tp('spt1770SSDesc')}
        </p>
      </div>

      {/* Customer Info for CUSTOMER role (read-only) */}
      {isCustomerRole && selectedCustomer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-blue-900">{selectedCustomer.full_name}</span>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              {selectedCustomer.npwp && (
                <div className="text-sm text-blue-700 mt-1">NPWP: {selectedCustomer.npwp}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Selection for Tax Advisors */}
      {!isCustomerRole && !selectedCustomer && (
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
                {tp('noTaxpayerData')}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => router.push(`/${locale}/customers`)}
              >
                {tp('addNewTaxpayer')}
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
                    {customer.full_name} ({customer.npwp || 'No NPWP'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Loading state for CUSTOMER role */}
      {isCustomerRole && isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">{tp('loadingData')}</span>
        </div>
      )}

      {/* Error state for CUSTOMER role */}
      {isCustomerRole && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6">
          {error}
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => session?.customerId && fetchOwnCustomerData(session.customerId)}
          >
            {tp('retry')}
          </Button>
        </div>
      )}

      {/* SPT Generator */}
      {selectedCustomer && (
        <>
          {/* Change button only for tax advisors */}
          {!isCustomerRole && (
            <div className="mb-4">
              <Button
                variant="outline"
                onClick={() => setSelectedCustomer(null)}
              >
                {tp('changeClient')}
              </Button>
            </div>
          )}

          <SPT1770SSGenerator
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.full_name}
            customerNpwp={selectedCustomer.npwp}
            defaultPtkpStatus={
              // Prefill from customer profile if valid PTKP code
              selectedCustomer.ptkp_status && /^(TK|K)(\/I)?\/[0-3]$/.test(selectedCustomer.ptkp_status)
                ? (selectedCustomer.ptkp_status as 'TK/0')
                : undefined
            }
            onComplete={(data) => {
              console.log('SPT 1770 SS Generated:', data);
            }}
          />
        </>
      )}
    </div>
  );
}
