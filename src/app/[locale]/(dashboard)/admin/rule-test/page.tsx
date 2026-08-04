'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, Loader2, AlertTriangle, Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Resolution {
  taxType: string;
  rate: number;
  taxAmount: number;
  netAmount: number;
  isFinal: boolean;
  npwpSurchargeApplied: boolean;
  reason: string;
  legalBasis: string;
  rulePriority: number;
  ruleId: string;
  alternativeRules?: Array<{ ruleId: string; reason: string }>;
}

const SERVICE_CATEGORY_KEYS = ['SERVICE', 'CONSTRUCTION', 'RENTAL', 'EMPLOYMENT', 'DIVIDEND', 'INTEREST', 'ROYALTY', 'IMPORT', 'SHIPPING', 'OTHER'] as const;
const SERVICE_CATEGORY_ICONS: Record<string, string> = {
  SERVICE: '🔧', CONSTRUCTION: '🏗️', RENTAL: '🏠', EMPLOYMENT: '👤',
  DIVIDEND: '💰', INTEREST: '🏦', ROYALTY: '©️', IMPORT: '📦', SHIPPING: '🚢', OTHER: '📋',
};

const CONSTRUCTION_TYPE_KEYS = ['WORK', 'CONSULT', 'INTEGRATED'] as const;
const QUALIFICATION_KEYS = ['SMALL', 'MEDIUM_LARGE', 'QUALIFIED', 'NONE'] as const;

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Override Rule', color: 'bg-red-100 text-red-700' },
  2: { label: 'Treaty Rule', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Construction Rule', color: 'bg-amber-100 text-amber-700' },
  4: { label: 'Category Rule', color: 'bg-green-100 text-green-700' },
  5: { label: 'General Rule', color: 'bg-gray-100 text-gray-700' },
};

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }
function pct(n: number) { return `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2)}%`; }

const DEFAULT_FORM = {
  grossAmount: '100000000',
  serviceCategory: 'SERVICE',
  recipientType: 'RESIDENT',
  recipientNpwp: '',
  recipientCountry: '',
  hasCod: false,
  vendorIsPropertyOwner: false,
  isRelatedParty: false,
  constructionType: '',
  qualification: '',
  kbliCode: '',
};

// Preset scenarios — keys reference ruleTest.presets.*
const PRESET_KEYS = [
  'serviceWithNpwp', 'serviceWithoutNpwp', 'ownerVendor', 'constructionSmall',
  'constructionNoQual', 'nonResidentKrCod', 'nonResidentKrNoCod',
  'nonResidentSgRoyalty', 'landRental', 'dividendNoNpwp',
] as const;

const PRESET_DATA: Record<string, typeof DEFAULT_FORM> = {
  serviceWithNpwp: { grossAmount: '100000000', serviceCategory: 'SERVICE', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
  serviceWithoutNpwp: { grossAmount: '100000000', serviceCategory: 'SERVICE', recipientType: 'RESIDENT', recipientNpwp: '', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
  ownerVendor: { grossAmount: '50000000', serviceCategory: 'SERVICE', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: true, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
  constructionSmall: { grossAmount: '1000000000', serviceCategory: 'CONSTRUCTION', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: 'WORK', qualification: 'SMALL', kbliCode: '' },
  constructionNoQual: { grossAmount: '200000000', serviceCategory: 'CONSTRUCTION', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: 'CONSULT', qualification: 'NONE', kbliCode: '' },
  nonResidentKrCod: { grossAmount: '500000000', serviceCategory: 'SERVICE', recipientType: 'NON_RESIDENT', recipientNpwp: '', recipientCountry: 'KR', hasCod: true, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
  nonResidentKrNoCod: { grossAmount: '500000000', serviceCategory: 'SERVICE', recipientType: 'NON_RESIDENT', recipientNpwp: '', recipientCountry: 'KR', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
  nonResidentSgRoyalty: { grossAmount: '300000000', serviceCategory: 'ROYALTY', recipientType: 'NON_RESIDENT', recipientNpwp: '', recipientCountry: 'SG', hasCod: true, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
  landRental: { grossAmount: '120000000', serviceCategory: 'RENTAL', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
  dividendNoNpwp: { grossAmount: '1000000000', serviceCategory: 'DIVIDEND', recipientType: 'RESIDENT', recipientNpwp: '', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' },
};

export default function RuleTestPage() {
  const t = useTranslations('ruleTest');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Resolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        grossAmount: parseFloat(form.grossAmount) || 0,
        serviceCategory: form.serviceCategory,
        recipientType: form.recipientType,
        recipientNpwp: form.recipientNpwp || undefined,
        recipientCountry: form.recipientCountry || undefined,
        hasCertificateOfDomicile: form.hasCod,
        vendorIsPropertyOwner: form.vendorIsPropertyOwner,
        isRelatedParty: form.isRelatedParty,
      };
      if (form.serviceCategory === 'CONSTRUCTION') {
        body.constructionType = form.constructionType || undefined;
        body.qualification = form.qualification || undefined;
      }
      if (form.kbliCode) body.kbliCode = form.kbliCode;

      const res = await fetch('/api/tax/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data.resolution);
      } else {
        setError(data.error || 'Failed');
      }
    } catch { setError('API call failed'); }
    finally { setIsLoading(false); }
  };

  const loadPreset = (key: string) => {
    setForm(PRESET_DATA[key]);
    setResult(null);
  };

  const priorityInfo = result ? PRIORITY_LABELS[result.rulePriority] || { label: `Priority ${result.rulePriority}`, color: 'bg-gray-100 text-gray-700' } : null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-cyan-200 text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />Admin — Tax Rule Tester
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('title')}</h1>
          <p className="text-cyan-200 mt-2 text-sm">
            {t('description')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Presets */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-600" />Preset Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {PRESET_KEYS.map((key) => (
                  <Button key={key} size="sm" variant="outline" className="text-xs h-7" onClick={() => loadPreset(key)}>
                    {t('presets.' + key)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transaction Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Gross Amount (DPP)</Label>
                  <Input className="h-9 font-mono" type="number" value={form.grossAmount} onChange={e => setForm({ ...form, grossAmount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Service Category</Label>
                  <Select value={form.serviceCategory} onValueChange={v => setForm({ ...form, serviceCategory: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORY_KEYS.map(key => <SelectItem key={key} value={key}>{SERVICE_CATEGORY_ICONS[key]} {t('serviceCategories.' + key)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Construction details */}
              {form.serviceCategory === 'CONSTRUCTION' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg">
                  <div>
                    <Label className="text-xs">Construction Type</Label>
                    <Select value={form.constructionType} onValueChange={v => setForm({ ...form, constructionType: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {CONSTRUCTION_TYPE_KEYS.map(key => <SelectItem key={key} value={key}>{t('constructionTypes.' + key)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t('qualificationLabel')}</Label>
                    <Select value={form.qualification} onValueChange={v => setForm({ ...form, qualification: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {QUALIFICATION_KEYS.map(key => <SelectItem key={key} value={key}>{t('qualifications.' + key)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Recipient Type</Label>
                  <Select value={form.recipientType} onValueChange={v => setForm({ ...form, recipientType: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RESIDENT">{t('recipientResident')}</SelectItem>
                      <SelectItem value="NON_RESIDENT">{t('recipientNonResident')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Recipient NPWP</Label>
                  <Input className="h-9 font-mono" value={form.recipientNpwp} onChange={e => setForm({ ...form, recipientNpwp: e.target.value })} placeholder={t('npwpPlaceholder')} />
                </div>
              </div>

              {/* Non-resident fields */}
              {form.recipientType === 'NON_RESIDENT' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
                  <div>
                    <Label className="text-xs">{t('countryLabel')}</Label>
                    <Input className="h-9" value={form.recipientCountry} onChange={e => setForm({ ...form, recipientCountry: e.target.value.toUpperCase() })} placeholder="KR, SG, JP..." />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="cod" checked={form.hasCod} onChange={e => setForm({ ...form, hasCod: e.target.checked })} className="rounded" />
                      <Label htmlFor="cod" className="text-xs cursor-pointer">{t('codLabel')}</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Override conditions */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="owner" checked={form.vendorIsPropertyOwner} onChange={e => setForm({ ...form, vendorIsPropertyOwner: e.target.checked })} className="rounded" />
                  <Label htmlFor="owner" className="text-xs cursor-pointer">Vendor = Owner</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="related" checked={form.isRelatedParty} onChange={e => setForm({ ...form, isRelatedParty: e.target.checked })} className="rounded" />
                  <Label htmlFor="related" className="text-xs cursor-pointer">Related Party</Label>
                </div>
                <div>
                  <Input className="h-9 font-mono text-xs" value={form.kbliCode} onChange={e => setForm({ ...form, kbliCode: e.target.value })} placeholder="KBLI (optional)" />
                </div>
              </div>

              {/* Run Button */}
              <Button onClick={runTest} disabled={isLoading} className="w-full bg-cyan-600 hover:bg-cyan-700">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                Run Resolution Engine
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Result */}
        <div>
          {error && (
            <Card className="border-red-200 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              {/* Main Result */}
              <Card className="border-0 shadow-md bg-gradient-to-br from-white to-gray-50">
                <CardContent className="pt-5">
                  <div className="text-center mb-4">
                    <Badge className={`${priorityInfo?.color} text-xs mb-2`}>{priorityInfo?.label}</Badge>
                    <h2 className="text-3xl font-bold text-gray-900">{result.taxType}</h2>
                    <p className="text-4xl font-bold text-cyan-600 mt-1">{pct(result.rate)}</p>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tax Amount</span>
                      <span className="font-bold font-mono">{fmt(result.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Net Amount</span>
                      <span className="font-mono">{fmt(result.netAmount)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {result.isFinal && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Final Tax</Badge>}
                    {result.npwpSurchargeApplied && <Badge className="bg-red-100 text-red-700 text-[10px]">NPWP Surcharge</Badge>}
                    <Badge variant="outline" className="text-[10px] font-mono">{result.ruleId}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Reasoning */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-gray-500">{t('reasoning')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-800">{result.reason}</p>
                  <p className="text-xs text-gray-500 mt-2">{result.legalBasis}</p>
                </CardContent>
              </Card>

              {/* Skipped Rules */}
              {result.alternativeRules && result.alternativeRules.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-gray-500">{t('skippedRules', { count: result.alternativeRules.length })}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {result.alternativeRules.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{r.ruleId}</span>
                          <span>{r.reason}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {!result && !error && (
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 text-center">
                <Zap className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">{t('emptyStateMain')}</p>
                <p className="text-xs text-gray-300 mt-1">{t('emptyStateSub')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
