'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileText, CheckCircle, XCircle, AlertTriangle, Loader2, Search,
  Shield, Plus, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifyResult {
  fakturNumber: string;
  valid: boolean;
  formatOk: boolean;
  duplicateCheck: 'unique' | 'duplicate' | 'unknown';
  details: string;
}

// Faktur Pajak number format: XXX.XXX-XX.XXXXXXXX (16 digits with separators)
function validateFakturFormat(num: string): { valid: boolean; reason: string } {
  const cleaned = num.replace(/[.\-\s]/g, '');

  if (cleaned.length !== 16) {
    return { valid: false, reason: `efaktur.need16digits:${cleaned.length}` };
  }

  if (!/^\d{16}$/.test(cleaned)) {
    return { valid: false, reason: 'efaktur.numbersOnly' };
  }

  // Transaction code (first 2 digits): 01-09
  const txCode = parseInt(cleaned.substring(0, 2));
  if (txCode < 1 || txCode > 9) {
    return { valid: false, reason: `efaktur.invalidTxCode:${txCode}` };
  }

  // Status code (3rd digit): 0 or 1
  const statusCode = parseInt(cleaned.substring(2, 3));
  if (statusCode !== 0 && statusCode !== 1) {
    return { valid: false, reason: `efaktur.invalidStatus:${statusCode}` };
  }

  // Year code (digits 4-5)
  const yearCode = parseInt(cleaned.substring(3, 5));
  if (yearCode < 10 || yearCode > 30) {
    return { valid: false, reason: `efaktur.invalidYear:${yearCode}` };
  }

  return { valid: true, reason: 'efaktur.formatNormal' };
}

function formatFakturNumber(num: string): string {
  const cleaned = num.replace(/[.\-\s]/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}.${cleaned.slice(8)}`;
}

export default function EFakturVerifyPage() {
  const t = useTranslations('killer');
  const [numbers, setNumbers] = useState<string[]>(['']);
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  const addRow = () => setNumbers(p => [...p, '']);
  const removeRow = (i: number) => { if (numbers.length > 1) setNumbers(p => p.filter((_, idx) => idx !== i)); };
  const updateRow = (i: number, val: string) => setNumbers(p => p.map((v, idx) => idx === i ? val : v));

  const verify = async () => {
    setIsVerifying(true);
    const newResults: VerifyResult[] = [];

    // Collect all cleaned numbers for duplicate check
    const allCleaned = numbers.map(n => n.replace(/[.\-\s]/g, '')).filter(n => n.length > 0);
    const duplicates = allCleaned.filter((n, i) => allCleaned.indexOf(n) !== i);

    for (const num of numbers) {
      const cleaned = num.replace(/[.\-\s]/g, '');
      if (!cleaned) continue;

      const format = validateFakturFormat(num);
      const isDuplicate = duplicates.includes(cleaned);

      newResults.push({
        fakturNumber: formatFakturNumber(cleaned),
        valid: format.valid && !isDuplicate,
        formatOk: format.valid,
        duplicateCheck: isDuplicate ? 'duplicate' : 'unique',
        details: !format.valid ? format.reason : isDuplicate ? 'efaktur.duplicateDetected' : 'efaktur.formatNormal',
      });
    }

    setResults(newResults);
    setIsVerifying(false);
  };

  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.filter(r => !r.valid).length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-800 via-emerald-700 to-teal-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-green-300 text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />{t('efaktur.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('efaktur.title')}</h1>
          <p className="text-green-300 mt-2 text-sm">{t('efaktur.subtitle')}</p>
        </div>
      </div>

      {/* Input */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-5 space-y-3">
          <Label className="text-sm font-medium">{t('efaktur.inputLabel')}</Label>
          {numbers.map((num, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={num}
                onChange={e => updateRow(i, e.target.value)}
                placeholder="010.000-24.00000001"
                className="font-mono"
                aria-label={`Faktur number ${i + 1}`}
              />
              {numbers.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeRow(i)} aria-label="Remove">
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 mr-1" />{t('efaktur.addNumber')}
            </Button>
            <Button onClick={verify} disabled={isVerifying || numbers.every(n => !n.trim())} className="bg-gradient-to-r from-green-600 to-emerald-600">
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              {t('efaktur.verify')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-gray-400">{t('efaktur.resultTotal')}</p>
                <p className="font-bold text-lg">{results.length}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-green-600 flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" />{t('efaktur.resultValid')}</p>
                <p className="font-bold text-lg text-green-700">{validCount}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-red-600 flex items-center justify-center gap-1"><XCircle className="h-3 w-3" />{t('efaktur.resultInvalid')}</p>
                <p className="font-bold text-lg text-red-700">{invalidCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Detail */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              {results.map((r, i) => (
                <div key={i} className={cn(
                  'flex items-center justify-between rounded-lg p-3',
                  r.valid ? 'bg-green-50' : 'bg-red-50'
                )}>
                  <div className="flex items-center gap-3">
                    {r.valid ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                    <div>
                      <p className="font-mono text-sm font-medium">{r.fakturNumber}</p>
                      <p className="text-xs text-gray-500">{r.details.includes(':') ? t(r.details.split(':')[0] as 'efaktur.need16digits', { count: r.details.split(':')[1], code: r.details.split(':')[1] }) : t(r.details as 'efaktur.formatNormal')}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge className={cn('text-[10px]', r.formatOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {r.formatOk ? t('efaktur.formatOk') : t('efaktur.formatError')}
                    </Badge>
                    <Badge className={cn('text-[10px]', r.duplicateCheck === 'unique' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}>
                      {r.duplicateCheck === 'unique' ? t('efaktur.unique') : t('efaktur.duplicate')}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Format Guide */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />{t('efaktur.formatGuide')}
              </h3>
              <div className="font-mono text-sm bg-gray-50 rounded-lg p-3 space-y-1">
                <p><span className="text-blue-600">0X</span>X . <span className="text-green-600">XXX</span> - <span className="text-purple-600">XX</span> . <span className="text-orange-600">XXXXXXXX</span></p>
                <div className="text-xs text-gray-500 space-y-0.5 mt-2">
                  <p><span className="text-blue-600">01-09</span>: Kode Transaksi (01=일반, 04=DPP 다른 값, 07=면세 납품)</p>
                  <p><span className="text-green-600">X</span>: Kode Status (0=일반, 1=대체)</p>
                  <p><span className="text-purple-600">XX</span>: Tahun Penerbitan (연도)</p>
                  <p><span className="text-orange-600">XXXXXXXX</span>: Nomor Urut (일련번호)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
