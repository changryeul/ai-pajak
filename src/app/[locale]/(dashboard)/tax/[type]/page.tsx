'use client';

import { use, Suspense } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import { TaxFilingWizard } from '@/components/tax-filing';
import { TaxType } from '@/stores/tax-filing-store';
import { Loader2 } from 'lucide-react';

const VALID_TAX_TYPES = ['pph21', 'pph23', 'pph-final', 'ppn', 'spt-tahunan'];

const TAX_TYPE_MAP: Record<string, TaxType> = {
  'pph21': 'PPh21',
  'pph23': 'PPh23',
  'pph-final': 'PPh_FINAL',
  'ppn': 'PPN',
  'spt-tahunan': 'SPT_TAHUNAN',
};

interface PageProps {
  params: Promise<{ type: string }>;
}

function TaxTypePageContent({ type }: { type: string }) {
  const searchParams = useSearchParams();
  const filingId = searchParams.get('filingId');

  if (!VALID_TAX_TYPES.includes(type)) {
    notFound();
  }

  const taxType = TAX_TYPE_MAP[type];

  return <TaxFilingWizard initialTaxType={taxType} filingId={filingId ?? undefined} />;
}

export default function TaxTypePage({ params }: PageProps) {
  const { type } = use(params);

  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      }>
        <TaxTypePageContent type={type} />
      </Suspense>
    </div>
  );
}
