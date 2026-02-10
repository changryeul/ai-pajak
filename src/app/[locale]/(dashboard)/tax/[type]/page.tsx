'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { TaxFilingWizard } from '@/components/tax-filing';
import { TaxType } from '@/stores/tax-filing-store';

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

export default function TaxTypePage({ params }: PageProps) {
  const { type } = use(params);

  if (!VALID_TAX_TYPES.includes(type)) {
    notFound();
  }

  const taxType = TAX_TYPE_MAP[type];

  return (
    <div className="container mx-auto py-8 px-4">
      <TaxFilingWizard initialTaxType={taxType} />
    </div>
  );
}
