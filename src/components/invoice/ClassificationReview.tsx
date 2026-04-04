'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaxResolutionBadge } from './TaxResolutionBadge';
import { Sparkles, FileText, Building2, DollarSign, Calendar } from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface ClassificationData {
  serviceCategory: string;
  serviceCode?: string;
  counterpartyName: string;
  counterpartyNpwp?: string;
  grossAmount: number;
  ppnAmount?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  description: string;
  confidence: number;
}

interface ResolutionData {
  taxType: string;
  rate: number;
  taxAmount: number;
  netAmount: number;
  isFinal: boolean;
  reason: string;
  legalBasis: string;
}

interface ClassificationReviewProps {
  classification: ClassificationData;
  resolution: ResolutionData;
  onClassificationChange: (updated: ClassificationData) => void;
}


export function ClassificationReview({ classification, resolution, onClassificationChange }: ClassificationReviewProps) {
  const t = useTranslations('killer');
  const update = (field: keyof ClassificationData, value: string | number) => {
    onClassificationChange({ ...classification, [field]: value });
  };

  const confidenceColor = classification.confidence >= 0.8 ? 'text-green-600' : classification.confidence >= 0.5 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      {/* AI Confidence */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium">{t('invoice.aiResult')}</span>
        </div>
        <span className={`text-sm font-mono font-bold ${confidenceColor}`}>
          {t('invoice.confidence', { value: (classification.confidence * 100).toFixed(0) })}
        </span>
      </div>

      {/* Tax Resolution */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <TaxResolutionBadge taxType={resolution.taxType} rate={resolution.rate} isFinal={resolution.isFinal} />
          <span className="text-lg font-bold text-gray-900">{fmtRp(resolution.taxAmount)}</span>
        </div>
        <p className="text-xs text-gray-500">{resolution.reason}</p>
        <p className="text-[10px] text-gray-400 mt-1">{resolution.legalBasis}</p>
      </div>

      {/* Editable Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1">
            <Building2 className="h-3 w-3" />{t('invoice.counterparty')}
          </Label>
          <Input
            value={classification.counterpartyName}
            onChange={e => update('counterpartyName', e.target.value)}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">NPWP</Label>
          <Input
            value={classification.counterpartyNpwp || ''}
            onChange={e => update('counterpartyNpwp', e.target.value)}
            placeholder="XX.XXX.XXX.X-XXX.XXX"
            className="mt-1 h-9 text-sm font-mono"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />{t('invoice.amount')}
          </Label>
          <Input
            type="number"
            value={classification.grossAmount}
            onChange={e => update('grossAmount', parseFloat(e.target.value) || 0)}
            className="mt-1 h-9 text-sm font-mono"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="h-3 w-3" />{t('invoice.invoiceDate')}
          </Label>
          <Input
            type="date"
            value={classification.invoiceDate || ''}
            onChange={e => update('invoiceDate', e.target.value)}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1">
            <FileText className="h-3 w-3" />{t('invoice.invoiceNumber')}
          </Label>
          <Input
            value={classification.invoiceNumber || ''}
            onChange={e => update('invoiceNumber', e.target.value)}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">{t('invoice.serviceType')}</Label>
          <Input
            value={classification.serviceCategory}
            onChange={e => update('serviceCategory', e.target.value)}
            className="mt-1 h-9 text-sm"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <Label className="text-xs text-gray-500">{t('invoice.description')}</Label>
        <Input
          value={classification.description}
          onChange={e => update('description', e.target.value)}
          className="mt-1 h-9 text-sm"
        />
      </div>
    </div>
  );
}
