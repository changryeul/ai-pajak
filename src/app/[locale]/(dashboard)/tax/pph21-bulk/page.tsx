'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PPh21BulkCalculator } from '@/components/tax/PPh21BulkCalculator';

export default function PPh21BulkPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/dashboard`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PPh 21 Bulk Calculator</h1>
        <p className="text-gray-500 mt-1">
          Hitung PPh 21 untuk seluruh karyawan sekaligus
        </p>
      </div>

      <PPh21BulkCalculator />
    </div>
  );
}
