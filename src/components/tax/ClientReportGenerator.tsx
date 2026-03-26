'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import {
  FileText,
  Loader2,
  Download,
  Printer,
  Sparkles,
  User,
  Building2,
  Calculator,
  TrendingUp,
} from 'lucide-react';

interface ClientReportGeneratorProps {
  customerId: string;
  customerName: string;
  customerNpwp?: string;
  defaultTaxYear?: number;
  defaultPtkpStatus?: PTKPStatus;
}

interface ReportSection {
  id: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
}

interface Report {
  title: string;
  generatedAt: string;
  sections: ReportSection[];
  metadata: { taxYear: number; customerName: string; generatedBy: string };
}

const PTKP_OPTIONS: { value: PTKPStatus; label: string }[] = [
  { value: 'TK/0', label: 'TK/0' }, { value: 'TK/1', label: 'TK/1' },
  { value: 'TK/2', label: 'TK/2' }, { value: 'TK/3', label: 'TK/3' },
  { value: 'K/0', label: 'K/0' }, { value: 'K/1', label: 'K/1' },
  { value: 'K/2', label: 'K/2' }, { value: 'K/3', label: 'K/3' },
  { value: 'K/I/0', label: 'K/I/0' }, { value: 'K/I/1', label: 'K/I/1' },
  { value: 'K/I/2', label: 'K/I/2' }, { value: 'K/I/3', label: 'K/I/3' },
];

function fmt(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

const sectionIcons: Record<string, typeof FileText> = {
  profile: User,
  income: Building2,
  calculation: Calculator,
  filing: FileText,
  analysis: TrendingUp,
};

export function ClientReportGenerator({
  customerId,
  customerName,
  customerNpwp,
  defaultTaxYear = new Date().getFullYear() - 1,
  defaultPtkpStatus = 'TK/0',
}: ClientReportGeneratorProps) {
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const [ptkpStatus, setPtkpStatus] = useState<PTKPStatus>(defaultPtkpStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const generate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tax/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxYear, ptkpStatus, language: 'id' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate report');
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  }, [customerId, taxYear, ptkpStatus]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Generator Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Generate Laporan Klien
          </CardTitle>
          <CardDescription>
            Buat laporan analisis pajak komprehensif dengan AI untuk klien Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-500">Klien:</span>{' '}
            <span className="font-medium">{customerName}</span>
            {customerNpwp && (
              <span className="text-gray-400 ml-2 font-mono text-xs">{customerNpwp}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tahun Pajak</Label>
              <Select value={taxYear.toString()} onValueChange={(v) => setTaxYear(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {taxYearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status PTKP</Label>
              <Select value={ptkpStatus} onValueChange={(v) => setPtkpStatus(v as PTKPStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PTKP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          <Button onClick={generate} disabled={isLoading} className="w-full">
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Membuat Laporan (30-60 detik)...</>
            ) : (
              <><FileText className="h-4 w-4 mr-2" />Generate Laporan</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Report Output */}
      {report && (
        <div ref={reportRef} className="space-y-4 print:space-y-2">
          {/* Report Header */}
          <Card className="border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                  <CardDescription>
                    Dibuat: {new Date(report.generatedAt).toLocaleString('id-ID')} | {report.metadata.generatedBy}
                  </CardDescription>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-1" />
                    Print
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Data Sections */}
          {report.sections.filter((s) => s.id !== 'analysis').map((section) => {
            const Icon = sectionIcons[section.id] || FileText;
            return (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4 text-blue-600" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {section.id === 'profile' && section.data && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">Nama</span><p className="font-medium">{section.data.name as string}</p></div>
                      <div><span className="text-gray-500">NPWP</span><p className="font-mono">{section.data.npwp as string}</p></div>
                      <div><span className="text-gray-500">NIK</span><p className="font-mono">{section.data.nik as string}</p></div>
                      <div><span className="text-gray-500">Status PTKP</span><p>{section.data.ptkpStatus as string} (Rp {(section.data.ptkpAmount as number).toLocaleString('id-ID')})</p></div>
                    </div>
                  )}

                  {section.id === 'income' && section.data && (
                    <div className="space-y-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Pemberi Kerja</th>
                            <th className="text-right py-2">Bruto</th>
                            <th className="text-right py-2">Neto</th>
                            <th className="text-right py-2">PPh</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(section.data.sources as Array<{ employer: string; gross: number; net: number; withheld: number }>).map((s, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2">{s.employer}</td>
                              <td className="py-2 text-right font-mono">{fmt(s.gross)}</td>
                              <td className="py-2 text-right font-mono">{fmt(s.net)}</td>
                              <td className="py-2 text-right font-mono">{fmt(s.withheld)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="font-medium border-t-2">
                          <tr>
                            <td className="py-2">Total</td>
                            <td className="py-2 text-right font-mono">{fmt(section.data.totalGross as number)}</td>
                            <td className="py-2 text-right font-mono">{fmt(section.data.totalNet as number)}</td>
                            <td className="py-2 text-right font-mono">{fmt(section.data.totalWithheld as number)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {section.id === 'calculation' && section.data && (
                    <div className="space-y-2 text-sm">
                      {[
                        ['Penghasilan Neto', fmt(section.data.totalNetIncome as number)],
                        ['PTKP (' + section.data.ptkpStatus + ')', '- ' + fmt(section.data.ptkp as number)],
                        ['PKP', fmt(section.data.pkp as number)],
                        ['PPh Terutang', fmt(section.data.taxDue as number)],
                        ['PPh Dipotong', '- ' + fmt(section.data.totalWithheld as number)],
                      ].map(([label, value], i) => (
                        <div key={i} className={`flex justify-between py-1 ${i === 2 || i === 4 ? 'border-t font-medium' : ''}`}>
                          <span className="text-gray-600">{label}</span>
                          <span className="font-mono">{value}</span>
                        </div>
                      ))}
                      <div className="border-t-2 pt-2 flex justify-between items-center">
                        <span className="font-bold">Status</span>
                        <Badge className={
                          section.data.status === 'NIHIL' ? 'bg-green-100 text-green-700' :
                          section.data.status === 'KURANG_BAYAR' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }>
                          {section.data.status as string} {(section.data.difference as number) !== 0 && fmt(Math.abs(section.data.difference as number))}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">Tarif Efektif: {section.data.effectiveRate as string}</p>
                    </div>
                  )}

                  {section.id === 'filing' && section.data && (
                    <div className="space-y-1 text-sm">
                      {(section.data.history as Array<{ taxType: string; taxYear: number; status: string; filedAt?: string }>).map((f, i) => (
                        <div key={i} className="flex justify-between py-1 border-b last:border-0">
                          <span>{f.taxType} - {f.taxYear}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline">{f.status}</Badge>
                            {f.filedAt && <span className="text-gray-400 text-xs">{new Date(f.filedAt).toLocaleDateString('id-ID')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* AI Analysis Section */}
          {report.sections.find((s) => s.id === 'analysis') && (
            <Card className="border-2 border-yellow-200">
              <CardHeader className="bg-yellow-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-600" />
                  Analisis & Rekomendasi AI
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
                  {report.sections.find((s) => s.id === 'analysis')?.content}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default ClientReportGenerator;
