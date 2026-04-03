'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, Loader2, CheckCircle, ArrowRight, Shield,
  Globe, Building2, FileText, AlertTriangle, Zap,
} from 'lucide-react';

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

const SERVICE_CATEGORIES = [
  { value: 'SERVICE', label: 'Service (일반 용역)', icon: '🔧' },
  { value: 'CONSTRUCTION', label: 'Construction (건설)', icon: '🏗️' },
  { value: 'RENTAL', label: 'Rental (임대)', icon: '🏠' },
  { value: 'EMPLOYMENT', label: 'Employment (근로)', icon: '👤' },
  { value: 'DIVIDEND', label: 'Dividend (배당)', icon: '💰' },
  { value: 'INTEREST', label: 'Interest (이자)', icon: '🏦' },
  { value: 'ROYALTY', label: 'Royalty (로열티)', icon: '©️' },
  { value: 'IMPORT', label: 'Import (수입)', icon: '📦' },
  { value: 'SHIPPING', label: 'Shipping (해운)', icon: '🚢' },
  { value: 'OTHER', label: 'Other (기타)', icon: '📋' },
];

const CONSTRUCTION_TYPES = [
  { value: 'WORK', label: 'Pelaksana (시공)' },
  { value: 'CONSULT', label: 'Konsultansi (컨설팅)' },
  { value: 'INTEGRATED', label: 'Terintegrasi (통합)' },
];

const QUALIFICATIONS = [
  { value: 'SMALL', label: 'Kecil (소규모)' },
  { value: 'MEDIUM_LARGE', label: 'Menengah/Besar (중/대규모)' },
  { value: 'QUALIFIED', label: 'Berkualifikasi (자격보유)' },
  { value: 'NONE', label: 'Tanpa Kualifikasi (자격없음)' },
];

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Override Rule', color: 'bg-red-100 text-red-700' },
  2: { label: 'Treaty Rule', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Construction Rule', color: 'bg-amber-100 text-amber-700' },
  4: { label: 'Category Rule', color: 'bg-green-100 text-green-700' },
  5: { label: 'General Rule', color: 'bg-gray-100 text-gray-700' },
};

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }
function pct(n: number) { return `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2)}%`; }

// Preset scenarios
const PRESETS = [
  { name: '일반 서비스 (NPWP 有)', data: { grossAmount: '100000000', serviceCategory: 'SERVICE', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
  { name: '일반 서비스 (NPWP 無)', data: { grossAmount: '100000000', serviceCategory: 'SERVICE', recipientType: 'RESIDENT', recipientNpwp: '', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
  { name: '관리사무소 (Owner=Vendor)', data: { grossAmount: '50000000', serviceCategory: 'SERVICE', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: true, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
  { name: '건설 시공 (소규모)', data: { grossAmount: '1000000000', serviceCategory: 'CONSTRUCTION', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: 'WORK', qualification: 'SMALL', kbliCode: '' } },
  { name: '건설 컨설팅 (자격없음)', data: { grossAmount: '200000000', serviceCategory: 'CONSTRUCTION', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: 'CONSULT', qualification: 'NONE', kbliCode: '' } },
  { name: '비거주자 한국 (CoD 有)', data: { grossAmount: '500000000', serviceCategory: 'SERVICE', recipientType: 'NON_RESIDENT', recipientNpwp: '', recipientCountry: 'KR', hasCod: true, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
  { name: '비거주자 한국 (CoD 無)', data: { grossAmount: '500000000', serviceCategory: 'SERVICE', recipientType: 'NON_RESIDENT', recipientNpwp: '', recipientCountry: 'KR', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
  { name: '비거주자 싱가포르 로열티', data: { grossAmount: '300000000', serviceCategory: 'ROYALTY', recipientType: 'NON_RESIDENT', recipientNpwp: '', recipientCountry: 'SG', hasCod: true, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
  { name: '토지/건물 임대', data: { grossAmount: '120000000', serviceCategory: 'RENTAL', recipientType: 'RESIDENT', recipientNpwp: '01.234.567.8-901.234', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
  { name: '배당 (NPWP 無)', data: { grossAmount: '1000000000', serviceCategory: 'DIVIDEND', recipientType: 'RESIDENT', recipientNpwp: '', recipientCountry: '', hasCod: false, vendorIsPropertyOwner: false, isRelatedParty: false, constructionType: '', qualification: '', kbliCode: '' } },
];

export default function RuleTestPage() {
  const [form, setForm] = useState({
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
  });
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

  const loadPreset = (preset: typeof PRESETS[0]) => {
    setForm(preset.data);
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
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Rule Test (세율 판정 테스트)</h1>
          <p className="text-cyan-200 mt-2 text-sm">
            거래 조건을 입력하면 Resolution Engine이 어떤 Rule을 적용하여 세율을 결정하는지 실시간으로 확인합니다.
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
                {PRESETS.map((preset, i) => (
                  <Button key={i} size="sm" variant="outline" className="text-xs h-7" onClick={() => loadPreset(preset)}>
                    {preset.name}
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
                      {SERVICE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
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
                        {CONSTRUCTION_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Qualification (자격등급)</Label>
                    <Select value={form.qualification} onValueChange={v => setForm({ ...form, qualification: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {QUALIFICATIONS.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
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
                      <SelectItem value="RESIDENT">Resident (거주자)</SelectItem>
                      <SelectItem value="NON_RESIDENT">Non-Resident (비거주자)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Recipient NPWP</Label>
                  <Input className="h-9 font-mono" value={form.recipientNpwp} onChange={e => setForm({ ...form, recipientNpwp: e.target.value })} placeholder="비어있으면 NPWP 없음" />
                </div>
              </div>

              {/* Non-resident fields */}
              {form.recipientType === 'NON_RESIDENT' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
                  <div>
                    <Label className="text-xs">Country (ISO 2자리)</Label>
                    <Input className="h-9" value={form.recipientCountry} onChange={e => setForm({ ...form, recipientCountry: e.target.value.toUpperCase() })} placeholder="KR, SG, JP..." />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="cod" checked={form.hasCod} onChange={e => setForm({ ...form, hasCod: e.target.checked })} className="rounded" />
                      <Label htmlFor="cod" className="text-xs cursor-pointer">CoD (거주지증명서) 보유</Label>
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
                  <CardTitle className="text-xs text-gray-500">판단 근거</CardTitle>
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
                    <CardTitle className="text-xs text-gray-500">건너뛴 Rule ({result.alternativeRules.length})</CardTitle>
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
                <p className="text-sm text-gray-400">조건을 입력하고 Run을 클릭하세요</p>
                <p className="text-xs text-gray-300 mt-1">또는 Preset을 선택하세요</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
