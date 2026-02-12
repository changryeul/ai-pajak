'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
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
import { FileSignature, ArrowLeft, Upload, Calendar, Building2 } from 'lucide-react';

type POAScope = 'ALL_TAX_TYPES' | 'PPh21_ONLY' | 'PPh23_ONLY' | 'PPN_ONLY';

export default function POACreatePage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    scope: 'ALL_TAX_TYPES' as POAScope,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/poa/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxPartnerId: '00000000-0000-0000-0000-000000000003', // Jakarta Tax Consulting UUID
          scope: formData.scope,
          validFrom: formData.validFrom,
          validTo: formData.validTo,
          // documentUrl is optional for DRAFT - can be uploaded before signing
          notes: formData.notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/${locale}/poa/${data.poaId}`);
      } else {
        setError(data.error || 'Failed to create POA');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scopeOptions = [
    { value: 'ALL_TAX_TYPES', label: t('poa.scope.allTaxTypes') || 'All Tax Types' },
    { value: 'PPh21_ONLY', label: 'PPh 21 Only' },
    { value: 'PPh23_ONLY', label: 'PPh 23 Only' },
    { value: 'PPN_ONLY', label: 'PPN (VAT) Only' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('poa.createTitle') || 'Create Power of Attorney'}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('poa.createDescription') || 'Authorize Jakarta Tax Consulting to handle your tax filings'}
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <FileSignature className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">
                {t('poa.infoTitle') || 'What is a Power of Attorney?'}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {t('poa.infoDescription') || 'A POA authorizes Jakarta Tax Consulting to prepare, submit, and manage your tax filings on your behalf. This is required before any tax filing can be processed.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('poa.formTitle') || 'POA Details'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tax Partner (Fixed) */}
            <div className="space-y-2">
              <Label>{t('poa.taxPartner') || 'Tax Partner'}</Label>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="font-medium">Jakarta Tax Consulting</p>
                <p className="text-sm text-gray-500">Licensed Tax Consultant</p>
              </div>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label htmlFor="scope">{t('poa.scope.label') || 'Authorization Scope'}</Label>
              <Select
                value={formData.scope}
                onValueChange={(value: POAScope) => setFormData({ ...formData, scope: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {t('poa.scope.description') || 'Select which tax types this POA covers'}
              </p>
            </div>

            {/* Validity Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  {t('poa.validFrom') || 'Valid From'}
                </Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validTo">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  {t('poa.validTo') || 'Valid Until'}
                </Label>
                <Input
                  id="validTo"
                  type="date"
                  value={formData.validTo}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('poa.notes') || 'Notes (Optional)'}</Label>
              <textarea
                id="notes"
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm"
                placeholder={t('poa.notesPlaceholder') || 'Any additional notes...'}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    {t('common.saving') || 'Saving...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('poa.createButton') || 'Create POA'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            {t('poa.nextSteps') || 'Next Steps'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</span>
              <span>{t('poa.step1') || 'Create POA request (current step)'}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium">2</span>
              <span>{t('poa.step2') || 'Sign the POA document digitally'}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium">3</span>
              <span>{t('poa.step3') || 'Tax Advisor reviews and countersigns'}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium">4</span>
              <span>{t('poa.step4') || 'POA becomes active - tax filing enabled'}</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
