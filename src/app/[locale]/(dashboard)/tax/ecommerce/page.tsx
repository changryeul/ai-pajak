'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ShoppingCart, FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseEcommerceCSV, calculateMonthlySummary, type EcommercePlatform, type EcommerceMonthlySummary } from '@/lib/ecommerce';
import { parseTabularFile, rowsToCsv } from '@/lib/tax/bulk-import/client-file-parser';
import { useTranslations } from 'next-intl';

export default function EcommercePage() {
  const t = useTranslations('pages');
  const [platform, setPlatform] = useState<EcommercePlatform>('SHOPEE');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<EcommerceMonthlySummary | null>(null);
  const [orderCount, setOrderCount] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      // Parse csv OR xlsx via shared helper, serialise back to CSV for parseEcommerceCSV.
      const parsed = await parseTabularFile(file);
      const text = rowsToCsv(parsed.headers, parsed.dataRows);
      const orders = parseEcommerceCSV(text, platform);
      setOrderCount(orders.length);
      const period = new Date().toISOString().slice(0, 7);
      const result = calculateMonthlySummary(orders, platform, period);
      setSummary(result);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  const platforms: { value: EcommercePlatform; label: string; color: string }[] = [
    { value: 'SHOPEE', label: 'Shopee', color: 'bg-orange-100 text-orange-700' },
    { value: 'TOKOPEDIA', label: 'Tokopedia', color: 'bg-green-100 text-green-700' },
    { value: 'TIKTOK_SHOP', label: 'TikTok Shop', color: 'bg-gray-900 text-white' },
    { value: 'LAZADA', label: 'Lazada', color: 'bg-blue-100 text-blue-700' },
    { value: 'BUKALAPAK', label: 'Bukalapak', color: 'bg-red-100 text-red-700' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <ShoppingCart className="h-6 w-6 text-orange-500" />{t('ecommerceTitle')}
      </h1>

      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-5 space-y-4">
          <div><Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={v => setPlatform(v as EcommercePlatform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{platforms.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="border-2 border-dashed rounded-xl p-8 text-center">
            <FileSpreadsheet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Upload CSV export dari seller dashboard</p>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} disabled={isLoading} className="text-sm" />
            <p className="text-xs text-gray-400 mt-2">Download laporan penjualan dari {platform} Seller Center → Export CSV</p>
          </div>
          {isLoading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Memproses...</div>}
        </CardContent>
      </Card>

      {summary && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Hasil Import - {platform}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Total Pesanan</p><p className="font-bold">{summary.totalOrders} ({summary.completedOrders} selesai)</p></div>
              <div className="p-3 bg-green-50 rounded-lg"><p className="text-xs text-gray-500">Revenue Bruto</p><p className="font-bold text-green-700">Rp {summary.grossRevenue.toLocaleString('id-ID')}</p></div>
              <div className="p-3 bg-orange-50 rounded-lg"><p className="text-xs text-gray-500">Fee Platform</p><p className="font-bold text-orange-700">Rp {summary.platformFees.toLocaleString('id-ID')}</p></div>
              <div className="p-3 bg-blue-50 rounded-lg"><p className="text-xs text-gray-500">Revenue Neto</p><p className="font-bold text-blue-700">Rp {summary.netRevenue.toLocaleString('id-ID')}</p></div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">PPh Final 0.5% (UMKM)</p>
              <p className="text-lg font-bold text-red-700">Rp {summary.pphFinal.toLocaleString('id-ID')}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
