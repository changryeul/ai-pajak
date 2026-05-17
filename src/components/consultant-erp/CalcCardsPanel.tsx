'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type CalcKind = 'PPH21_TER' | 'WITHHOLDING_SUMMARY' | 'CORP_TAX_MONTHLY' | 'PPN_NET' | 'BANK_RECON';

interface CalcRow {
  id: string;
  session_id: string;
  kind: CalcKind;
  amount: number;
  basis: Record<string, unknown>;
  source_summary: string | null;
  rationale_summary: string | null;
  confidence: number | null;
  consultant_memo: string | null;
  is_saved: boolean;
  computed_at: string;
}

const fmtRp = (n: number) =>
  `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export function CalcCardsPanel({ sessionId }: { sessionId: string }) {
  const t = useTranslations('consultantErp');
  const [rows, setRows] = useState<CalcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<CalcKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pph21Gross, setPph21Gross] = useState('');
  const [whGross, setWhGross] = useState('');
  const [whRate, setWhRate] = useState('0.02');
  const [corpMonthly, setCorpMonthly] = useState('');
  const [corpPrevTax, setCorpPrevTax] = useState('');
  const [corpEstablished, setCorpEstablished] = useState<string>('');
  const [corpLegalForm, setCorpLegalForm] = useState<string>('PT');
  const [corpManual, setCorpManual] = useState('');
  const [corpSelected, setCorpSelected] = useState<'PPH_FINAL' | 'PPH25' | null>(null);
  const [ppnOutput, setPpnOutput] = useState('');
  const [ppnInput, setPpnInput] = useState('');
  const [bankSubmitted, setBankSubmitted] = useState('');
  const [bankTotal, setBankTotal] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/calc`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'load failed');
      setRows(j.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (kind: CalcKind, input: Record<string, unknown>) => {
    setBusyKind(kind);
    setError(null);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/calc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, input, save: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'calc failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'calc error');
    } finally {
      setBusyKind(null);
    }
  };

  const findRow = (k: CalcKind) => rows.find((r) => r.kind === k);

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <p className="text-sm font-black text-slate-950">{t('calc.title')}</p>
          <p className="text-xs text-slate-500 mt-1">
            {t('calc.p2Hint')}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* PPh 21 TER */}
          <CalcCard title={t('calc.kind.PPH21_TER')} row={findRow('PPH21_TER')}>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600">{t('calc.pph21GrossLabel')}</label>
              <Input
                value={pph21Gross}
                onChange={(e) => setPph21Gross(e.target.value)}
                placeholder="94000000"
                type="number"
              />
              <Button
                size="sm"
                onClick={() => run('PPH21_TER', { grossMonthlyPayroll: Number(pph21Gross) || 0 })}
                disabled={busyKind === 'PPH21_TER' || !pph21Gross}
              >
                {busyKind === 'PPH21_TER' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calculator className="h-4 w-4 mr-1" /> {t('calc.autoCompute')}</>}
              </Button>
            </div>
          </CalcCard>

          {/* Withholding summary */}
          <CalcCard title={t('calc.kind.WITHHOLDING_SUMMARY')} row={findRow('WITHHOLDING_SUMMARY')}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600">{t('calc.whTotalLabel')}</label>
                <Input
                  value={whGross}
                  onChange={(e) => setWhGross(e.target.value)}
                  placeholder="45000000"
                  type="number"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600">{t('calc.whRateLabel')}</label>
                <Input
                  value={whRate}
                  onChange={(e) => setWhRate(e.target.value)}
                  placeholder="0.02"
                  type="number"
                  step="0.001"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => run('WITHHOLDING_SUMMARY', {
                totalGross: Number(whGross) || 0,
                averageRate: Number(whRate) || 0,
              })}
              disabled={busyKind === 'WITHHOLDING_SUMMARY' || !whGross}
            >
              {busyKind === 'WITHHOLDING_SUMMARY' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calculator className="h-4 w-4 mr-1" /> {t('calc.autoCompute')}</>}
            </Button>
          </CalcCard>

          {/* Corp tax dual case — full width */}
          <div className="md:col-span-2">
            <CalcCard title={t('calc.kind.CORP_TAX_MONTHLY')} row={findRow('CORP_TAX_MONTHLY')}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600">{t('calc.corpEstablishedLabel')}</label>
                  <Input
                    value={corpEstablished}
                    onChange={(e) => setCorpEstablished(e.target.value)}
                    placeholder="2022"
                    type="number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600">{t('calc.corpLegalFormLabel')}</label>
                  <select
                    value={corpLegalForm}
                    onChange={(e) => setCorpLegalForm(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    {['PT', 'CV', 'UD', 'FIRMA', 'KOPERASI'].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 mt-3 lg:grid-cols-2">
                {/* PPh Final case */}
                <div className={cn('rounded-xl border p-3', corpSelected === 'PPH_FINAL' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white')}>
                  <p className="text-xs font-black text-slate-900 mb-2">{t('calc.corpFinalCaseTitle')}</p>
                  <label className="block text-xs font-bold text-slate-600">{t('calc.corpMonthlyRevenueLabel')}</label>
                  <Input
                    value={corpMonthly}
                    onChange={(e) => setCorpMonthly(e.target.value)}
                    placeholder="820000000"
                    type="number"
                  />
                  <Button
                    size="sm"
                    variant={corpSelected === 'PPH_FINAL' ? 'default' : 'outline'}
                    className="mt-2 w-full"
                    onClick={() => setCorpSelected('PPH_FINAL')}
                  >
                    {t('calc.corpFinalSelect')}
                  </Button>
                </div>
                {/* PPh 25 case */}
                <div className={cn('rounded-xl border p-3', corpSelected === 'PPH25' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white')}>
                  <p className="text-xs font-black text-slate-900 mb-2">{t('calc.corpPph25CaseTitle')}</p>
                  <label className="block text-xs font-bold text-slate-600">{t('calc.corpPrevTaxLabel')}</label>
                  <Input
                    value={corpPrevTax}
                    onChange={(e) => setCorpPrevTax(e.target.value)}
                    placeholder="240000000"
                    type="number"
                  />
                  <label className="block text-xs font-bold text-slate-600 mt-2">{t('calc.corpManualAdjustLabel')}</label>
                  <Input
                    value={corpManual}
                    onChange={(e) => setCorpManual(e.target.value)}
                    placeholder="0"
                    type="number"
                  />
                  <Button
                    size="sm"
                    variant={corpSelected === 'PPH25' ? 'default' : 'outline'}
                    className="mt-2 w-full"
                    onClick={() => setCorpSelected('PPH25')}
                  >
                    {t('calc.corpPph25Select')}
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => run('CORP_TAX_MONTHLY', {
                  monthlyRevenue: Number(corpMonthly) || 0,
                  prevYearTax: Number(corpPrevTax) || 0,
                  establishedYear: Number(corpEstablished) || null,
                  legalForm: corpLegalForm,
                  manualAdjustment: Number(corpManual) || 0,
                  selectedCase: corpSelected,
                })}
                disabled={busyKind === 'CORP_TAX_MONTHLY' || !corpSelected}
              >
                {busyKind === 'CORP_TAX_MONTHLY' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calculator className="h-4 w-4 mr-1" /> {t('calc.autoComputeAndSave')}</>}
              </Button>
            </CalcCard>
          </div>

          {/* PPN net */}
          <CalcCard title={t('calc.kind.PPN_NET')} row={findRow('PPN_NET')}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600">{t('calc.ppnOutputLabel')}</label>
                <Input
                  value={ppnOutput}
                  onChange={(e) => setPpnOutput(e.target.value)}
                  placeholder="780000000"
                  type="number"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600">{t('calc.ppnInputLabel')}</label>
                <Input
                  value={ppnInput}
                  onChange={(e) => setPpnInput(e.target.value)}
                  placeholder="310000000"
                  type="number"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => run('PPN_NET', {
                outputDpp: Number(ppnOutput) || 0,
                inputDpp: Number(ppnInput) || 0,
              })}
              disabled={busyKind === 'PPN_NET' || !ppnOutput}
            >
              {busyKind === 'PPN_NET' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calculator className="h-4 w-4 mr-1" /> {t('calc.autoCompute')}</>}
            </Button>
          </CalcCard>

          {/* Bank recon */}
          <CalcCard title={t('calc.kind.BANK_RECON')} row={findRow('BANK_RECON')}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600">{t('calc.bankSubmittedLabel')}</label>
                <Input
                  value={bankSubmitted}
                  onChange={(e) => setBankSubmitted(e.target.value)}
                  placeholder="94000000"
                  type="number"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600">{t('calc.bankTotalLabel')}</label>
                <Input
                  value={bankTotal}
                  onChange={(e) => setBankTotal(e.target.value)}
                  placeholder="130000000"
                  type="number"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => run('BANK_RECON', {
                submittedTotal: Number(bankSubmitted) || 0,
                bankTotal: Number(bankTotal) || 0,
              })}
              disabled={busyKind === 'BANK_RECON' || !bankTotal}
            >
              {busyKind === 'BANK_RECON' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calculator className="h-4 w-4 mr-1" /> {t('calc.bankCompute')}</>}
            </Button>
          </CalcCard>
        </div>

        {loading && rows.length === 0 && (
          <p className="text-xs text-slate-500"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />{t('calc.loading')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CalcCard({
  title,
  row,
  children,
}: {
  title: string;
  row: CalcRow | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-black text-slate-950">{title}</p>
        {row && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
            <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
            {row.confidence ?? 0}%
          </span>
        )}
      </div>
      {row && (
        <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs">
          <p className="text-2xl font-black text-emerald-700">
            {fmtRp(Number(row.amount ?? 0))}
          </p>
          {row.source_summary && (
            <p className="mt-1 text-slate-600">{row.source_summary}</p>
          )}
          {row.rationale_summary && (
            <p className="text-slate-500">{row.rationale_summary}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
