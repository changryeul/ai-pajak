'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: RowError[];
}

const CSV_TEMPLATE_HEADER = 'full_name,company_name,customer_type,npwp,email,phone,address,business_category,employee_count,is_pkp';
const CSV_TEMPLATE_SAMPLE = [
  'PT Maju Jaya,PT Maju Jaya,COMPANY,0112345678901000,finance@majujaya.co.id,+62-21-5555555,Jl. Gatot Subroto No. 12 Jakarta,TRADING,15,true',
  'CV Berkah Sentosa,CV Berkah Sentosa,COMPANY,0298765432109000,admin@berkah.com,,Jl. Raya Bogor KM 25,SERVICE,8,true',
  'Budi Santoso,,INDIVIDUAL,3456789012345678,budi@gmail.com,,Jl. Kemang Raya 55,FREELANCER,,',
].join('\n');

function downloadTemplate() {
  const content = CSV_TEMPLATE_HEADER + '\n' + CSV_TEMPLATE_SAMPLE;
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-pajak-customer-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function csvRowToCustomer(row: Record<string, string>) {
  return {
    full_name: row.full_name || row.name || '',
    company_name: row.company_name || row['회사명'] || '',
    customer_type: (row.customer_type || 'COMPANY').toUpperCase() as 'INDIVIDUAL' | 'COMPANY',
    npwp: row.npwp || '',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    business_category: row.business_category || '',
    employee_count: row.employee_count ? parseInt(row.employee_count, 10) : undefined,
    is_pkp: row.is_pkp === 'true' || row.is_pkp === '1' || row.is_pkp === 'yes' ? true : row.is_pkp === 'false' || row.is_pkp === '0' ? false : undefined,
  };
}

export function BulkImportDialog({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof csvRowToCustomer>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsedRows([]);
    setResult(null);
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rawRows = parseCSV(text);
        if (rawRows.length === 0) {
          setError('CSV 파일이 비어 있거나 형식이 잘못되었습니다');
          return;
        }
        if (rawRows.length > 200) {
          setError('한 번에 최대 200건까지 등록 가능합니다');
          return;
        }
        const customers = rawRows.map(csvRowToCustomer);
        setParsedRows(customers);
        setStep('preview');
      } catch {
        setError('CSV 파싱 실패');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = async () => {
    setStep('importing');
    setError(null);
    try {
      const res = await fetch('/api/customers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: parsedRows }),
      });
      const body = await res.json();
      if (body.data) {
        setResult(body.data);
        setStep('result');
        if (body.data.created > 0) {
          onComplete?.();
        }
      } else {
        setError(body.error || '등록 실패');
        setStep('preview');
      }
    } catch {
      setError('서버 오류');
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1.5" />
          일괄 등록 (CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            고객 일괄 등록
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 mb-2">CSV 파일 형식</p>
              <p className="text-blue-700 text-xs">
                첫 줄은 헤더, 이후 줄이 고객 데이터입니다. 필수 항목: <code className="bg-blue-100 px-1 rounded">full_name</code>, <code className="bg-blue-100 px-1 rounded">customer_type</code> (INDIVIDUAL 또는 COMPANY).
                법인은 <code className="bg-blue-100 px-1 rounded">company_name</code>도 필수.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV 템플릿 다운로드
              </Button>
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">CSV 파일을 여기에 드래그하거나 클릭해서 선택</p>
              <p className="text-xs text-gray-400 mt-1">최대 200건, UTF-8 인코딩</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>{parsedRows.length}건</strong>의 고객을 등록합니다. 내용을 확인하세요.
            </p>

            <div className="max-h-60 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">이름/회사명</th>
                    <th className="px-2 py-1.5 text-left">유형</th>
                    <th className="px-2 py-1.5 text-left">NPWP</th>
                    <th className="px-2 py-1.5 text-left">이메일</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                      <td className="px-2 py-1 font-medium">{row.company_name || row.full_name}</td>
                      <td className="px-2 py-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${row.customer_type === 'COMPANY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {row.customer_type === 'COMPANY' ? '법인' : '개인'}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-mono text-[10px]">{row.npwp || '—'}</td>
                      <td className="px-2 py-1 text-gray-500">{row.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={reset}>취소</Button>
              <Button size="sm" onClick={handleImport}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                {parsedRows.length}건 등록 시작
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600">{parsedRows.length}건 등록 중...</p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-semibold text-green-900">등록 완료</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mt-3">
                <div>
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-[10px] text-green-600">신규 등록</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                  <p className="text-[10px] text-yellow-600">기존 고객 (NPWP 중복)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                  <p className="text-[10px] text-red-600">오류</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs font-medium text-red-800 mb-2">오류 목록</p>
                <div className="space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-[10px] text-red-700">
                      행 {err.row}: [{err.field}] {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setOpen(false); reset(); }}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
