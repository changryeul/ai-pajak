'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Briefcase, Download, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import { PTKP_RATES } from '@/lib/tax/shared/constants';

interface Customer {
  id: string;
  full_name: string;
  npwp: string;
  customer_type: string;
}

interface BusinessIncomeInput {
  businessName: string;
  kluCode: string;
  bookkeepingMethod: 'PEMBUKUAN' | 'NORMA';
  grossRevenue: number;
}

const PTKP_OPTIONS: { value: PTKPStatus; label: string }[] = [
  { value: 'TK/0', label: 'TK/0 - Tidak Kawin, 0 Tanggungan' },
  { value: 'TK/1', label: 'TK/1 - Tidak Kawin, 1 Tanggungan' },
  { value: 'TK/2', label: 'TK/2 - Tidak Kawin, 2 Tanggungan' },
  { value: 'TK/3', label: 'TK/3 - Tidak Kawin, 3 Tanggungan' },
  { value: 'K/0', label: 'K/0 - Kawin, 0 Tanggungan' },
  { value: 'K/1', label: 'K/1 - Kawin, 1 Tanggungan' },
  { value: 'K/2', label: 'K/2 - Kawin, 2 Tanggungan' },
  { value: 'K/3', label: 'K/3 - Kawin, 3 Tanggungan' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

const emptyBusiness: BusinessIncomeInput = {
  businessName: '',
  kluCode: '',
  bookkeepingMethod: 'NORMA',
  grossRevenue: 0,
};

export default function SPT1770Page() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [ptkpStatus, setPtkpStatus] = useState<PTKPStatus>('TK/0');
  const [businessIncome, setBusinessIncome] = useState<BusinessIncomeInput[]>([{ ...emptyBusiness }]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);

  const taxYearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 - i);

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
    setResult(null);
  };

  const handleBusinessChange = (index: number, field: keyof BusinessIncomeInput, value: string | number) => {
    const updated = [...businessIncome];
    updated[index] = { ...updated[index], [field]: value };
    setBusinessIncome(updated);
  };

  const addBusiness = () => {
    setBusinessIncome([...businessIncome, { ...emptyBusiness }]);
  };

  const removeBusiness = (index: number) => {
    if (businessIncome.length > 1) {
      setBusinessIncome(businessIncome.filter((_, i) => i !== index));
    }
  };

  const handleGenerate = async () => {
    if (!selectedCustomer) return;

    // Validate business income
    const validBusiness = businessIncome.filter(b => b.businessName && b.grossRevenue > 0);
    if (validBusiness.length === 0) {
      setError('Minimal satu usaha harus diisi dengan benar');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/tax/spt/1770', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          taxYear,
          ptkpStatus,
          businessIncome: validBusiness.map(b => ({
            businessName: b.businessName,
            kluCode: b.kluCode || '47100',
            bookkeepingMethod: b.bookkeepingMethod,
            grossRevenue: b.grossRevenue,
          })),
          format: 'json',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Generation failed');
      }

      setResult({ success: true, data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate SPT');
      setResult({ success: false, error: err instanceof Error ? err.message : 'Error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedCustomer) return;

    const validBusiness = businessIncome.filter(b => b.businessName && b.grossRevenue > 0);
    if (validBusiness.length === 0) {
      setError('Minimal satu usaha harus diisi dengan benar');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1770', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          taxYear,
          ptkpStatus,
          businessIncome: validBusiness.map(b => ({
            businessName: b.businessName,
            kluCode: b.kluCode || '47100',
            bookkeepingMethod: b.bookkeepingMethod,
            grossRevenue: b.grossRevenue,
          })),
          format: 'pdf',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SPT-1770-${selectedCustomer.npwp || selectedCustomer.id}-${taxYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setIsGenerating(false);
    }
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

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Briefcase className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SPT 1770</h1>
            <p className="text-gray-600">
              Formulir Lengkap - Untuk wajib pajak dengan penghasilan dari usaha atau pekerjaan bebas
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate SPT 1770</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label>Wajib Pajak</Label>
            {isLoading ? (
              <div className="flex items-center py-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Memuat...
              </div>
            ) : (
              <Select onValueChange={handleCustomerSelect} value={selectedCustomer?.id}>
                <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-4">
            {/* Tax Year */}
            <div className="space-y-2">
              <Label>Tahun Pajak</Label>
              <Select value={taxYear.toString()} onValueChange={(v) => setTaxYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taxYearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PTKP Status */}
            <div className="space-y-2">
              <Label>Status PTKP</Label>
              <Select value={ptkpStatus} onValueChange={(v) => setPtkpStatus(v as PTKPStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PTKP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                PTKP: Rp {formatCurrency(PTKP_RATES[ptkpStatus])}
              </p>
            </div>
          </div>

          {/* Business Income */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Penghasilan dari Usaha</Label>
              <Button variant="outline" size="sm" onClick={addBusiness}>
                <Plus className="h-4 w-4 mr-1" />
                Tambah Usaha
              </Button>
            </div>

            {businessIncome.map((business, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Usaha {index + 1}</h4>
                  {businessIncome.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeBusiness(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nama Usaha</Label>
                    <Input
                      value={business.businessName}
                      onChange={(e) => handleBusinessChange(index, 'businessName', e.target.value)}
                      placeholder="Nama usaha"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Kode KLU</Label>
                    <Input
                      value={business.kluCode}
                      onChange={(e) => handleBusinessChange(index, 'kluCode', e.target.value)}
                      placeholder="47100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Metode Pembukuan</Label>
                    <Select
                      value={business.bookkeepingMethod}
                      onValueChange={(v) => handleBusinessChange(index, 'bookkeepingMethod', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMA">Norma (Sederhana)</SelectItem>
                        <SelectItem value="PEMBUKUAN">Pembukuan (Lengkap)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Peredaran Bruto (Rp)</Label>
                    <Input
                      type="number"
                      value={business.grossRevenue || ''}
                      onChange={(e) => handleBusinessChange(index, 'grossRevenue', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!selectedCustomer || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate SPT'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={!selectedCustomer || isGenerating}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          {/* Result */}
          {result?.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">SPT berhasil digenerate!</p>
              <pre className="mt-2 text-xs overflow-auto max-h-96 bg-white p-3 rounded border">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
