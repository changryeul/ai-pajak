'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Briefcase } from 'lucide-react';
import { SPT1770Preview } from './SPT1770Preview';
import type {
  SPT1770Data,
  PTKPStatus,
  BookkeepingMethod,
} from '@/lib/tax/spt-1770/types';
import { PTKP_RATES } from '@/lib/tax/shared/constants';

interface SPT1770GeneratorProps {
  customerId: string;
  customerName: string;
  customerNpwp?: string;
  defaultTaxYear?: number;
  defaultPtkpStatus?: PTKPStatus;
  onComplete?: (data: SPT1770Data) => void;
}

interface BusinessIncomeForm {
  businessName: string;
  kluCode: string;
  bookkeepingMethod: BookkeepingMethod;
  grossRevenue: number;
}

interface OtherIncomeForm {
  interestIncome: number;
  dividendIncome: number;
  royaltyIncome: number;
  rentalIncome: number;
  capitalGains: number;
  prizeIncome: number;
  otherIncome: number;
}

interface TaxCreditsForm {
  pph21Withheld: number;
  pph22Withheld: number;
  pph23Withheld: number;
  pph25Installments: number;
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
  { value: 'K/I/0', label: 'K/I/0 - Kawin + Istri Gabung, 0 Tanggungan' },
  { value: 'K/I/1', label: 'K/I/1 - Kawin + Istri Gabung, 1 Tanggungan' },
  { value: 'K/I/2', label: 'K/I/2 - Kawin + Istri Gabung, 2 Tanggungan' },
  { value: 'K/I/3', label: 'K/I/3 - Kawin + Istri Gabung, 3 Tanggungan' },
];

const emptyBusiness: BusinessIncomeForm = {
  businessName: '',
  kluCode: '',
  bookkeepingMethod: 'NORMA',
  grossRevenue: 0,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function SPT1770Generator({
  customerId,
  customerName,
  customerNpwp,
  defaultTaxYear = new Date().getFullYear() - 1,
  defaultPtkpStatus = 'TK/0',
  onComplete,
}: SPT1770GeneratorProps) {
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const [ptkpStatus, setPtkpStatus] = useState<PTKPStatus>(defaultPtkpStatus);
  const [correctionNumber, setCorrectionNumber] = useState(0);

  const [businessIncome, setBusinessIncome] = useState<BusinessIncomeForm[]>([
    { ...emptyBusiness },
  ]);

  const [otherIncome, setOtherIncome] = useState<OtherIncomeForm>({
    interestIncome: 0,
    dividendIncome: 0,
    royaltyIncome: 0,
    rentalIncome: 0,
    capitalGains: 0,
    prizeIncome: 0,
    otherIncome: 0,
  });

  const [taxCredits, setTaxCredits] = useState<TaxCreditsForm>({
    pph21Withheld: 0,
    pph22Withheld: 0,
    pph23Withheld: 0,
    pph25Installments: 0,
  });

  const [sptData, setSptData] = useState<SPT1770Data | null>(null);

  const handleBusinessChange = (
    index: number,
    field: keyof BusinessIncomeForm,
    value: string | number
  ) => {
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

  const updateOtherIncome = (field: keyof OtherIncomeForm, value: string) => {
    const numValue = parseFloat(value) || 0;
    setOtherIncome((prev) => ({ ...prev, [field]: numValue }));
  };

  const updateTaxCredits = (field: keyof TaxCreditsForm, value: string) => {
    const numValue = parseFloat(value) || 0;
    setTaxCredits((prev) => ({ ...prev, [field]: numValue }));
  };

  const getTotalBusinessRevenue = () => {
    return businessIncome.reduce((sum, b) => sum + (b.grossRevenue || 0), 0);
  };

  const getTotalOtherIncome = () => {
    return Object.values(otherIncome).reduce((a, b) => a + b, 0);
  };

  const getTotalTaxCredits = () => {
    return Object.values(taxCredits).reduce((a, b) => a + b, 0);
  };

  const generateSPT = useCallback(async () => {
    // Validate business income
    const validBusiness = businessIncome.filter(
      (b) => b.businessName && b.grossRevenue > 0
    );
    if (validBusiness.length === 0) {
      setError('Minimal satu usaha harus diisi dengan benar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1770', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          correctionNumber,
          businessIncome: validBusiness.map((b) => ({
            businessName: b.businessName,
            kluCode: b.kluCode || '47100',
            bookkeepingMethod: b.bookkeepingMethod,
            grossRevenue: b.grossRevenue,
          })),
          otherIncome: {
            ...otherIncome,
            totalOtherIncome: getTotalOtherIncome(),
          },
          taxCredits: {
            ...taxCredits,
            totalTaxCredits: getTotalTaxCredits(),
          },
          format: 'json',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'SPT generation failed');
      }

      if (result.success && result.data) {
        setSptData(result.data);
        setStep('preview');
        onComplete?.(result.data);
      } else {
        throw new Error(result.message || 'No SPT data returned');
      }
    } catch (err) {
      console.error('SPT generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate SPT');
    } finally {
      setIsLoading(false);
    }
  }, [
    customerId,
    taxYear,
    ptkpStatus,
    correctionNumber,
    businessIncome,
    otherIncome,
    taxCredits,
    onComplete,
  ]);

  const handleDownloadPDF = useCallback(async () => {
    const validBusiness = businessIncome.filter(
      (b) => b.businessName && b.grossRevenue > 0
    );
    if (validBusiness.length === 0) {
      setError('Minimal satu usaha harus diisi dengan benar');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1770', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          correctionNumber,
          businessIncome: validBusiness.map((b) => ({
            businessName: b.businessName,
            kluCode: b.kluCode || '47100',
            bookkeepingMethod: b.bookkeepingMethod,
            grossRevenue: b.grossRevenue,
          })),
          otherIncome: {
            ...otherIncome,
            totalOtherIncome: getTotalOtherIncome(),
          },
          taxCredits: {
            ...taxCredits,
            totalTaxCredits: getTotalTaxCredits(),
          },
          format: 'pdf',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'PDF download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SPT-1770-${customerNpwp || customerId}-${taxYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  }, [
    customerId,
    customerNpwp,
    taxYear,
    ptkpStatus,
    correctionNumber,
    businessIncome,
    otherIncome,
    taxCredits,
  ]);

  if (step === 'preview' && sptData) {
    return (
      <SPT1770Preview
        data={sptData}
        onEdit={() => setStep('form')}
        onDownloadPDF={handleDownloadPDF}
        isLoading={isLoading || isDownloading}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-purple-600" />
          Generate SPT 1770
        </CardTitle>
        <CardDescription>
          SPT Tahunan PPh Wajib Pajak Orang Pribadi - Untuk usaha atau pekerjaan bebas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">Wajib Pajak</h4>
          <p className="font-semibold">{customerName}</p>
          {customerNpwp && (
            <p className="text-sm text-gray-500 font-mono">{customerNpwp}</p>
          )}
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Data Dasar</TabsTrigger>
            <TabsTrigger value="business">Usaha</TabsTrigger>
            <TabsTrigger value="otherIncome">Penghasilan Lain</TabsTrigger>
            <TabsTrigger value="credits">Kredit Pajak</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tax Year */}
              <div className="space-y-2">
                <Label htmlFor="taxYear">Tahun Pajak</Label>
                <Select
                  value={taxYear.toString()}
                  onValueChange={(v) => setTaxYear(parseInt(v))}
                >
                  <SelectTrigger id="taxYear">
                    <SelectValue placeholder="Pilih tahun pajak" />
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

              {/* Correction Number */}
              <div className="space-y-2">
                <Label htmlFor="correctionNumber">Pembetulan ke-</Label>
                <Select
                  value={correctionNumber.toString()}
                  onValueChange={(v) => setCorrectionNumber(parseInt(v))}
                >
                  <SelectTrigger id="correctionNumber">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (Normal)</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* PTKP Status */}
            <div className="space-y-2">
              <Label htmlFor="ptkpStatus">Status PTKP</Label>
              <Select
                value={ptkpStatus}
                onValueChange={(v) => setPtkpStatus(v as PTKPStatus)}
              >
                <SelectTrigger id="ptkpStatus">
                  <SelectValue placeholder="Pilih status PTKP" />
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

            {/* Info */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>SPT 1770</strong> digunakan untuk wajib pajak dengan
                penghasilan dari usaha/pekerjaan bebas. Anda dapat memilih
                metode Norma (sederhana) atau Pembukuan (lengkap).
              </p>
            </div>
          </TabsContent>

          {/* Business Income Tab */}
          <TabsContent value="business" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Penghasilan dari Usaha
              </Label>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBusiness(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nama Usaha</Label>
                    <Input
                      value={business.businessName}
                      onChange={(e) =>
                        handleBusinessChange(index, 'businessName', e.target.value)
                      }
                      placeholder="Nama usaha"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Kode KLU</Label>
                    <Input
                      value={business.kluCode}
                      onChange={(e) =>
                        handleBusinessChange(index, 'kluCode', e.target.value)
                      }
                      placeholder="47100"
                    />
                    <p className="text-xs text-gray-500">
                      Kode Klasifikasi Lapangan Usaha (5 digit)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Metode Pembukuan</Label>
                    <Select
                      value={business.bookkeepingMethod}
                      onValueChange={(v) =>
                        handleBusinessChange(index, 'bookkeepingMethod', v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMA">Norma (Sederhana)</SelectItem>
                        <SelectItem value="PEMBUKUAN">
                          Pembukuan (Lengkap)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Peredaran Bruto (Rp)</Label>
                    <Input
                      type="number"
                      value={business.grossRevenue || ''}
                      onChange={(e) =>
                        handleBusinessChange(
                          index,
                          'grossRevenue',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="p-3 bg-gray-100 rounded-lg">
              <div className="flex justify-between font-medium">
                <span>Total Peredaran Bruto</span>
                <span className="font-mono">
                  Rp {formatCurrency(getTotalBusinessRevenue())}
                </span>
              </div>
            </div>

            {getTotalBusinessRevenue() > 0 && getTotalBusinessRevenue() < 4_800_000_000 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Catatan:</strong> Omzet di bawah Rp 4,8 miliar memenuhi
                  syarat untuk tarif PPh Final UMKM 0,5% (PP 23/2018).
                </p>
              </div>
            )}
          </TabsContent>

          {/* Other Income Tab */}
          <TabsContent value="otherIncome" className="space-y-4 mt-4">
            <p className="text-sm text-gray-600 mb-4">
              Isi penghasilan lain di luar usaha (opsional)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bunga (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.interestIncome || ''}
                  onChange={(e) =>
                    updateOtherIncome('interestIncome', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Dividen (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.dividendIncome || ''}
                  onChange={(e) =>
                    updateOtherIncome('dividendIncome', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Royalti (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.royaltyIncome || ''}
                  onChange={(e) =>
                    updateOtherIncome('royaltyIncome', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Sewa (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.rentalIncome || ''}
                  onChange={(e) =>
                    updateOtherIncome('rentalIncome', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Keuntungan Penjualan Harta (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.capitalGains || ''}
                  onChange={(e) =>
                    updateOtherIncome('capitalGains', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Hadiah (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.prizeIncome || ''}
                  onChange={(e) =>
                    updateOtherIncome('prizeIncome', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Penghasilan Lainnya (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.otherIncome || ''}
                  onChange={(e) =>
                    updateOtherIncome('otherIncome', e.target.value)
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-100 rounded-lg mt-4">
              <div className="flex justify-between font-medium">
                <span>Total Penghasilan Lain</span>
                <span className="font-mono">
                  Rp {formatCurrency(getTotalOtherIncome())}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Tax Credits Tab */}
          <TabsContent value="credits" className="space-y-4 mt-4">
            <p className="text-sm text-gray-600 mb-4">
              Isi kredit pajak yang sudah dipotong/dibayar (opsional)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PPh 21 Dipotong (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph21Withheld || ''}
                  onChange={(e) =>
                    updateTaxCredits('pph21Withheld', e.target.value)
                  }
                  placeholder="0"
                />
                <p className="text-xs text-gray-500">
                  Dari pekerjaan sebagai karyawan (jika ada)
                </p>
              </div>

              <div className="space-y-2">
                <Label>PPh 22 (Impor, dll) (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph22Withheld || ''}
                  onChange={(e) =>
                    updateTaxCredits('pph22Withheld', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>PPh 23 (Jasa, dll) (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph23Withheld || ''}
                  onChange={(e) =>
                    updateTaxCredits('pph23Withheld', e.target.value)
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>PPh 25 (Angsuran) (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph25Installments || ''}
                  onChange={(e) =>
                    updateTaxCredits('pph25Installments', e.target.value)
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-100 rounded-lg mt-4">
              <div className="flex justify-between font-medium">
                <span>Total Kredit Pajak</span>
                <span className="font-mono">
                  Rp {formatCurrency(getTotalTaxCredits())}
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-3">
        <Button onClick={generateSPT} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate SPT'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default SPT1770Generator;
