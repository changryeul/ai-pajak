'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SPT1770SSGenerator } from '@/components/spt';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  npwp: string;
  customer_type: string;
}

export default function SPT1770SSPage() {
  const t = useTranslations('tax');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
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
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setSelectedCustomer(customer || null);
  };

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
          Kembali
        </Button>

        <h1 className="text-2xl font-bold text-gray-900">SPT 1770 SS</h1>
        <p className="text-gray-600 mt-1">
          Formulir Sangat Sederhana - Untuk karyawan dengan penghasilan bruto &lt; Rp 60 juta
        </p>
      </div>

      {/* Customer Selection */}
      {!selectedCustomer && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Pilih Wajib Pajak</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Memuat data...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : customers.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                Belum ada data wajib pajak orang pribadi.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => router.push(`/${locale}/customers/new`)}
              >
                Tambah Wajib Pajak Baru
              </Button>
            </div>
          ) : (
            <Select onValueChange={handleCustomerSelect}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Pilih wajib pajak..." />
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

      {/* SPT Generator */}
      {selectedCustomer && (
        <>
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => setSelectedCustomer(null)}
            >
              Ganti Wajib Pajak
            </Button>
          </div>

          <SPT1770SSGenerator
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.full_name}
            customerNpwp={selectedCustomer.npwp}
            onComplete={(data) => {
              console.log('SPT 1770 SS Generated:', data);
            }}
          />
        </>
      )}
    </div>
  );
}
