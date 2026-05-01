'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2, ArrowLeft, ArrowRight, FileText, Printer, Upload as UploadIcon,
  CheckCircle2, Sparkles, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useClosingSession, type ClosingDocument, type ClosingAdjustmentEntry } from '@/hooks/useClosingSession';

type StepId = 'basic' | 'collect' | 'statements' | 'sign' | 'adjust' | 'credit' | 'calc' | 'monthly';
const STEPS: StepId[] = ['basic', 'collect', 'statements', 'sign', 'adjust', 'credit', 'calc', 'monthly'];

type DocId =
  | 'akta' | 'bank' | 'sales' | 'purchase' | 'petty' | 'inventory'
  | 'assets' | 'payroll' | 'prepaid' | 'prevSpt';
const DOCS: DocId[] = ['akta', 'bank', 'sales', 'purchase', 'petty', 'inventory', 'assets', 'payroll', 'prepaid', 'prevSpt'];
const DOC_REQ: DocId[] = ['akta', 'bank', 'sales', 'purchase', 'payroll', 'prepaid', 'prevSpt'];

type PositiveId =
  | 'entertainment' | 'welfare' | 'donation' | 'penalty' | 'private' | 'pphBorne'
  | 'reserve' | 'vehicle' | 'carBenefit' | 'carService' | 'phone' | 'houseRent'
  | 'education' | 'travel' | 'operating' | 'otherPositive';
const POSITIVES: PositiveId[] = [
  'entertainment', 'welfare', 'donation', 'penalty', 'private', 'pphBorne',
  'reserve', 'vehicle', 'carBenefit', 'carService', 'phone', 'houseRent',
  'education', 'travel', 'operating', 'otherPositive',
];

type NegativeId = 'pphFinal' | 'nonObjek' | 'depDiff' | 'otherNegative';
const NEGATIVES: NegativeId[] = ['pphFinal', 'nonObjek', 'depDiff', 'otherNegative'];

const POSITIVE_CAPS: Partial<Record<PositiveId, string>> = {
  vehicle: '50%', carBenefit: '50%', carService: '50%', phone: '50%',
  houseRent: '100%', education: '100%', travel: '40%', operating: '50%',
};

export default function Pph25ClosingPage() {
  const t = useTranslations('pph25Closing');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { session: userSession } = useSession();

  const fiscalYear = new Date().getFullYear() - 1;
  const enabled = !!userSession?.customerId;
  const closing = useClosingSession({ fiscalYear, closingType: 'PPH25', enabled });

  const [step, setStep] = useState<StepId>('basic');
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (closing.session?.current_step && STEPS.includes(closing.session.current_step as StepId)) {
      setStep(closing.session.current_step as StepId);
      hydratedRef.current = true;
    }
  }, [closing.session?.current_step]);

  // ── Wizard data persisted in session.data ───────────────────────
  type WizardData = {
    companyName?: string;
    npwp?: string;
    fiscalYear?: number;
    annualRevenue?: number;
    cogs?: number;
    salary?: number;
    opex?: number;
    petty?: number;
    deprec?: number;
    pph22?: number;
    pph23?: number;
    pph24?: number;
    pph25?: number;
  };
  const data = (closing.session?.data ?? {}) as WizardData;
  const annualRevenue = Number(data.annualRevenue ?? 0);
  const cogs = Number(data.cogs ?? 0);
  const salary = Number(data.salary ?? 0);
  const opex = Number(data.opex ?? 0);
  const petty = Number(data.petty ?? 0);
  const deprec = Number(data.deprec ?? 0);
  const accountingIncome = annualRevenue - cogs - salary - opex - petty - deprec;

  // Adjustments come from DB (closing_adjustment_entry).
  const positiveSum = closing.adjustments
    .filter((e) => e.direction === 'POSITIVE')
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const negativeSum = closing.adjustments
    .filter((e) => e.direction === 'NEGATIVE')
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const pkp = Math.max(0, accountingIncome + positiveSum - negativeSum);

  // SME 50% discount: first Rp 4.8B of revenue × 22% × 50%, remainder full 22%.
  // Per UU PPh 31E for revenue ≤ Rp 50B.
  const eligibleSme = annualRevenue > 0 && annualRevenue < 50_000_000_000;
  const pphRate = 0.22;
  let pphBadan = 0;
  if (pkp > 0) {
    if (eligibleSme && annualRevenue > 0) {
      const discountedShare = Math.min(annualRevenue, 4_800_000_000) / annualRevenue;
      pphBadan = Math.round(pkp * discountedShare * pphRate * 0.5 + pkp * (1 - discountedShare) * pphRate);
    } else {
      pphBadan = Math.round(pkp * pphRate);
    }
  }

  const pph22 = Number(data.pph22 ?? 0);
  const pph23 = Number(data.pph23 ?? 0);
  const pph24 = Number(data.pph24 ?? 0);
  const pph25Paid = Number(data.pph25 ?? 0);
  const creditTotal = pph22 + pph23 + pph24 + pph25Paid;
  const settlement = pphBadan - creditTotal;

  // Next year monthly PPh25 = (PPh Badan - PPh22 - PPh23 - PPh24) / 12
  // Note: PPh25 paid in the closing year is NOT subtracted (it would otherwise
  // shrink the base every year).
  const monthlyBase = Math.max(0, pphBadan - pph22 - pph23 - pph24);
  const monthlyAmount = Math.round(monthlyBase / 12);

  const updateData = (patch: Partial<WizardData>) => {
    const merged = { ...data, ...patch } as Record<string, unknown>;
    closing.patch({ data: merged });
  };

  const stepIdx = STEPS.indexOf(step);
  const next = () => {
    if (stepIdx >= STEPS.length - 1) return;
    const n = STEPS[stepIdx + 1];
    setStep(n);
    closing.patch({ currentStep: n });
  };
  const prev = () => {
    if (stepIdx <= 0) return;
    const p = STEPS[stepIdx - 1];
    setStep(p);
    closing.patch({ currentStep: p });
  };

  const completeAndExit = async () => {
    await closing.patch({ status: 'COMPLETED' });
    toast.success(tc('comingSoon'));
  };

  const uploaded = useMemo(() => {
    const set = new Set<DocId>();
    for (const d of closing.documents) {
      if ((DOCS as string[]).includes(d.doc_type)) {
        set.add(d.doc_type as DocId);
      }
    }
    return set;
  }, [closing.documents]);

  const signedUploaded = closing.session?.signed_statements_uploaded ?? false;

  const uploadDoc = async (id: DocId, file: File) => {
    const result = await closing.uploadDocument(id, file);
    if (result) toast.success(t('collect.uploadedBadge'));
    else toast.error(tc('comingSoon'));
  };

  const uploadSigned = async (file: File) => {
    const result = await closing.uploadDocument('signedStatements', file);
    if (result) toast.success(t('collect.uploadedBadge'));
    else toast.error(tc('comingSoon'));
  };

  const progressPct = useMemo(
    () => Math.round((uploaded.size / DOCS.length) * 100),
    [uploaded]
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Title */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-violet-600" />
            {t('pageTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard`)}>
          {t('backToDashboard')}
        </Button>
      </div>

      {/* Type toggle (locked to PPh25) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/tax/annual/umkm`)}
          className="rounded-xl border-2 border-slate-200 bg-white p-4 text-left hover:border-slate-300"
        >
          <p className="text-sm font-bold text-slate-900">{t('typeLock.umkm')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t('typeLock.umkmDesc')}</p>
        </button>
        <div className="rounded-xl border-2 border-violet-500 bg-violet-50 p-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-violet-900">{t('typeLock.other')}</p>
            <p className="text-xs text-violet-700 mt-0.5">{t('typeLock.proDesc')}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white shrink-0">
            {t('typeLock.selected')}
          </span>
        </div>
      </div>

      {/* Core box */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 mb-5">
        <p className="text-sm font-bold text-blue-900">{t('coreBox.title')}</p>
        <ul className="text-xs text-blue-800 mt-2 space-y-0.5 list-disc ml-5">
          {(t.raw('coreBox.items') as string[]).map((it) => <li key={it}>{it}</li>)}
        </ul>
      </div>

      {/* Step indicator (8 dots) */}
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {STEPS.map((s, i) => {
          const active = step === s;
          const done = i < stepIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s)}
                title={t(`steps.${s}`)}
                className={cn(
                  'h-7 w-7 rounded-full text-xs font-bold transition-all',
                  active
                    ? 'bg-violet-600 text-white ring-4 ring-violet-100'
                    : done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                )}
              >
                {i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('h-px w-8', done ? 'bg-emerald-300' : 'bg-slate-200')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step body */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {closing.loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            {tc('loading')}
          </div>
        ) : (
          <>
            {step === 'basic' && (
              <BasicStep t={t} data={data} onChange={updateData} onNext={next} />
            )}
            {step === 'collect' && (
              <CollectStep
                t={t}
                uploaded={uploaded}
                docMap={closing.documents}
                onUpload={uploadDoc}
                progressPct={progressPct}
                onPrev={prev}
                onNext={next}
              />
            )}
            {step === 'statements' && (
              <StatementsStep
                t={t}
                values={{ annualRevenue, cogs, salary, opex, petty, deprec, accountingIncome }}
                onChange={updateData}
                onPrev={prev}
                onNext={next}
              />
            )}
            {step === 'sign' && (
              <SignStep
                t={t}
                tc={tc}
                sessionId={closing.session?.id ?? null}
                signedUploaded={signedUploaded}
                onUpload={uploadSigned}
                onPrev={prev}
                onNext={next}
              />
            )}
            {step === 'adjust' && (
              <AdjustStep
                t={t}
                tc={tc}
                existing={closing.adjustments}
                accountingIncome={accountingIncome}
                onSave={closing.saveAdjustments}
                onPrev={prev}
                onNext={next}
              />
            )}
            {step === 'credit' && (
              <CreditStep t={t} data={data} onChange={updateData} onPrev={prev} onNext={next} />
            )}
            {step === 'calc' && (
              <CalcStep
                t={t}
                pkp={pkp}
                pphBadan={pphBadan}
                creditTotal={creditTotal}
                settlement={settlement}
                eligibleSme={eligibleSme}
                onPrev={prev}
                onNext={next}
              />
            )}
            {step === 'monthly' && (
              <MonthlyStep
                t={t}
                tc={tc}
                sessionId={closing.session?.id ?? null}
                pphBadan={pphBadan}
                pph22={pph22}
                pph23={pph23}
                pph24={pph24}
                monthlyBase={monthlyBase}
                monthlyAmount={monthlyAmount}
                onPrev={prev}
                onComplete={completeAndExit}
                completed={closing.session?.status === 'COMPLETED'}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

type WizardData = {
  companyName?: string;
  npwp?: string;
  fiscalYear?: number;
  annualRevenue?: number;
  cogs?: number;
  salary?: number;
  opex?: number;
  petty?: number;
  deprec?: number;
  pph22?: number;
  pph23?: number;
  pph24?: number;
  pph25?: number;
};

const fmtRp = (n: number) =>
  'Rp ' + new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(n)));

const fmtRpSigned = (n: number) =>
  (n < 0 ? '−' : '') + 'Rp ' + new Intl.NumberFormat('en-US').format(Math.abs(Math.round(n)));

const parseNum = (s: string): number => Number(s.replace(/[^0-9.]/g, '')) || 0;

function BasicStep({
  t, data, onChange, onNext,
}: {
  t: T;
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('basic.title')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.companyName')}</Label>
          <Input
            value={data.companyName ?? ''}
            onChange={(e) => onChange({ companyName: e.target.value })}
            placeholder="PT Example Indonesia"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.npwp')}</Label>
          <Input
            value={data.npwp ?? ''}
            onChange={(e) => onChange({ npwp: e.target.value })}
            placeholder="0123456789012000"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.fiscalYear')}</Label>
          <Input
            type="number"
            value={data.fiscalYear ?? ''}
            onChange={(e) => onChange({ fiscalYear: Number(e.target.value) || undefined })}
            placeholder={String(new Date().getFullYear() - 1)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.annualRevenue')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={data.annualRevenue ? String(data.annualRevenue) : ''}
            onChange={(e) => onChange({ annualRevenue: parseNum(e.target.value) })}
            placeholder="3,100,000,000"
            className="text-right tabular-nums"
          />
          {data.annualRevenue ? (
            <p className="text-xs text-slate-500">{fmtRp(data.annualRevenue)}</p>
          ) : null}
        </div>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mt-5">
        <p className="text-sm text-amber-800">{t('basic.notice')}</p>
      </div>
      <div className="flex justify-end mt-5">
        <Button
          size="sm"
          className="bg-slate-900 text-white hover:bg-slate-800"
          onClick={onNext}
          disabled={!data.annualRevenue}
        >
          {t('basic.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function CollectStep({
  t, uploaded, docMap, onUpload, progressPct, onPrev, onNext,
}: {
  t: T;
  uploaded: Set<DocId>;
  docMap: ClosingDocument[];
  onUpload: (id: DocId, file: File) => Promise<void> | void;
  progressPct: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-bold text-slate-900">{t('collect.title')}</p>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {t('collect.progress', { pct: progressPct })}
        </span>
      </div>
      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="space-y-3 mt-5">
        {DOCS.map((id) => {
          const isReq = DOC_REQ.includes(id);
          const isUp = uploaded.has(id);
          const fileMeta = docMap.find((d) => d.doc_type === id);
          return (
            <div key={id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900">{t(`collect.items.${id}.title`)}</p>
                    {isReq && (
                      <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                        {t('collect.requiredBadge')}
                      </span>
                    )}
                    {isUp && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        {t('collect.uploadedBadge')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{t(`collect.items.${id}.body`)}</p>
                  {fileMeta && (
                    <p className="text-[11px] text-emerald-700 mt-1 truncate">📎 {fileMeta.file_name}</p>
                  )}
                  <p className="text-[11px] text-blue-700 mt-2">
                    {t('collect.detailLink')} {t(`collect.items.${id}.detail`)}
                  </p>
                </div>
                <label className="shrink-0 inline-flex items-center justify-center h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <UploadIcon className="h-3 w-3 mr-1" />
                  {isUp ? t('collect.reuploadCta') : t('collect.uploadCta')}
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*,.csv,.xlsx,.xls"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUpload(id, f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('collect.prev')}
        </Button>
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onNext}>
          {t('collect.genStatements')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function StatementsStep({
  t, values, onChange, onPrev, onNext,
}: {
  t: T;
  values: { annualRevenue: number; cogs: number; salary: number; opex: number; petty: number; deprec: number; accountingIncome: number };
  onChange: (patch: Partial<WizardData>) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalAssets = Math.round(values.accountingIncome + 690_000_000);
  const cash = Math.round(values.annualRevenue * 0.45);
  const ar = Math.round(values.annualRevenue * 0.08);
  const inv = Math.round(values.annualRevenue * 0.06);
  const fa = Math.max(0, totalAssets - cash - ar - inv);
  const loan = 95_000_000;
  const capital = 180_000_000;
  const surplus = 500_000_000;
  const retained = Math.max(0, totalAssets - loan - capital - surplus);

  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('statements.title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('statements.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        {(['autoClass', 'salesRecognized', 'netIncome'] as const).map((k) => (
          <div key={k} className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500">{t(`statements.summaryDesc.${k}`)}</p>
            <p className="text-sm font-bold text-slate-900 mt-1">{t(`statements.summary.${k}`)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="rounded-lg border border-slate-200 p-5">
          <p className="text-sm font-bold text-slate-900 mb-3">{t('statements.pl.title')}</p>
          <div className="space-y-2 text-sm">
            <PlRowRO label={t('statements.pl.sales')} value={values.annualRevenue} />
            <PlRowEdit label={t('statements.pl.cogs')} value={values.cogs} onChange={(v) => onChange({ cogs: v })} />
            <PlRowEdit label={t('statements.pl.salary')} value={values.salary} onChange={(v) => onChange({ salary: v })} />
            <PlRowEdit label={t('statements.pl.opex')} value={values.opex} onChange={(v) => onChange({ opex: v })} />
            <PlRowEdit label={t('statements.pl.petty')} value={values.petty} onChange={(v) => onChange({ petty: v })} />
            <PlRowEdit label={t('statements.pl.deprec')} value={values.deprec} onChange={(v) => onChange({ deprec: v })} />
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-3">
              <span className="font-semibold text-slate-900">{t('statements.pl.netIncome')}</span>
              <span className="font-bold text-slate-900 tabular-nums">{fmtRp(values.accountingIncome)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-5">
          <p className="text-sm font-bold text-slate-900 mb-3">{t('statements.bs.title')}</p>
          <div className="space-y-2 text-sm">
            <BsRow label={t('statements.bs.cash')} value={cash} />
            <BsRow label={t('statements.bs.ar')} value={ar} />
            <BsRow label={t('statements.bs.inventory')} value={inv} />
            <BsRow label={t('statements.bs.fa')} value={fa} />
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="font-semibold text-slate-900">{t('statements.bs.totalAssets')}</span>
              <span className="font-bold text-slate-900 tabular-nums">{fmtRp(totalAssets)}</span>
            </div>
            <div className="h-px bg-slate-100 my-2" />
            <BsRow label={t('statements.bs.loan')} value={loan} />
            <BsRow label={t('statements.bs.capital')} value={capital} />
            <BsRow label={t('statements.bs.surplus')} value={surplus} />
            <BsRow label={t('statements.bs.retained')} value={retained} />
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="font-semibold text-slate-900">{t('statements.bs.totalLE')}</span>
              <span className="font-bold text-slate-900 tabular-nums">{fmtRp(totalAssets)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mt-5 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">{t('statements.aiNote')}</p>
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('statements.prev')}
        </Button>
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onNext}>
          {t('statements.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function PlRowRO({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-900 tabular-nums">{fmtRp(value)}</span>
    </div>
  );
}

function PlRowEdit({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-slate-600 flex-1">{label}</span>
      <Input
        type="text"
        inputMode="numeric"
        value={value ? String(value) : ''}
        onChange={(e) => onChange(parseNum(e.target.value))}
        placeholder="0"
        className="w-40 h-8 text-right tabular-nums text-xs"
      />
    </div>
  );
}

function BsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-900 tabular-nums">{fmtRp(value)}</span>
    </div>
  );
}

function SignStep({
  t, tc, sessionId, signedUploaded, onUpload, onPrev, onNext,
}: {
  t: T;
  tc: T;
  sessionId: string | null;
  signedUploaded: boolean;
  onUpload: (file: File) => Promise<void> | void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const downloadPdf = () => {
    if (!sessionId) return;
    window.open(`/api/tax/annual-closing/${sessionId}/financial-statements-pdf`, '_blank');
  };
  return (
    <div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-5">
        <p className="text-xs text-amber-800">{t('sign.aiNote')}</p>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">{t('sign.title')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('sign.subtitle')}</p>
        </div>
        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 shrink-0">
          {t('sign.requiredBadge')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={!sessionId}
          className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50 disabled:opacity-50"
        >
          <Printer className="h-5 w-5 mx-auto text-slate-700" />
          <p className="text-sm font-medium text-slate-900 mt-2">{t('sign.stepPrint')}</p>
        </button>
        <button type="button" onClick={() => toast.info(tc('comingSoon'))} className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50">
          <FileText className="h-5 w-5 mx-auto text-slate-700" />
          <p className="text-sm font-medium text-slate-900 mt-2">{t('sign.stepLocation')}</p>
        </button>
        <label className={cn('rounded-lg border p-4 text-center transition-colors cursor-pointer block', signedUploaded ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50')}>
          {signedUploaded ? <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600" /> : <UploadIcon className="h-5 w-5 mx-auto text-slate-700" />}
          <p className={cn('text-sm font-medium mt-2', signedUploaded ? 'text-emerald-800' : 'text-slate-900')}>{t('sign.stepUpload')}</p>
          <input
            type="file"
            className="hidden"
            accept="application/pdf,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <p className="text-xs text-slate-500 mt-4">{t('sign.hint')}</p>
      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('sign.prev')}
        </Button>
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onNext} disabled={!signedUploaded}>
          {t('sign.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function AdjustStep({
  t, tc, existing, accountingIncome, onSave, onPrev, onNext,
}: {
  t: T;
  tc: T;
  existing: ClosingAdjustmentEntry[];
  accountingIncome: number;
  onSave: (entries: { direction: 'POSITIVE' | 'NEGATIVE'; itemCode: string; amount: number; capPct?: number | null }[]) => Promise<boolean>;
  onPrev: () => void;
  onNext: () => void;
}) {
  // amounts[`${direction}:${itemCode}`] = number
  const [amounts, setAmounts] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const e of existing) {
      seed[`${e.direction}:${e.item_code}`] = Number(e.amount) || 0;
    }
    return seed;
  });
  const [saving, setSaving] = useState(false);

  const setAmt = (direction: 'POSITIVE' | 'NEGATIVE', code: string, raw: string) => {
    const n = Number(raw.replace(/[^0-9.]/g, '')) || 0;
    setAmounts((s) => ({ ...s, [`${direction}:${code}`]: n }));
  };

  const positiveSubtotal = useMemo(
    () => POSITIVES.reduce((sum, id) => sum + (amounts[`POSITIVE:${id}`] || 0), 0),
    [amounts]
  );
  const negativeSubtotal = useMemo(
    () => NEGATIVES.reduce((sum, id) => sum + (amounts[`NEGATIVE:${id}`] || 0), 0),
    [amounts]
  );
  const pkp = Math.max(0, accountingIncome + positiveSubtotal - negativeSubtotal);
  const fmt = (n: number) =>
    'Rp ' + new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(n)));

  const persistAndGo = async () => {
    setSaving(true);
    const entries = [
      ...POSITIVES.map((id) => ({
        direction: 'POSITIVE' as const,
        itemCode: id,
        amount: amounts[`POSITIVE:${id}`] || 0,
        capPct: POSITIVE_CAPS[id] ? Number(String(POSITIVE_CAPS[id]).replace('%', '')) : null,
      })),
      ...NEGATIVES.map((id) => ({
        direction: 'NEGATIVE' as const,
        itemCode: id,
        amount: amounts[`NEGATIVE:${id}`] || 0,
        capPct: null,
      })),
    ].filter((e) => e.amount > 0);

    const ok = await onSave(entries);
    setSaving(false);
    if (!ok) {
      toast.error(tc('comingSoon'));
      return;
    }
    toast.success(tc('comingSoon'));
    onNext();
  };

  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('adjust.title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('adjust.subtitle')}</p>

      <p className="text-sm font-semibold text-violet-700 mt-5">{t('adjust.positiveTitle')}</p>
      <div className="space-y-3 mt-3">
        {POSITIVES.map((id) => (
          <div key={id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-900">{t(`adjust.items.${id}.title`)}</p>
                  {POSITIVE_CAPS[id] && (
                    <span className="inline-flex items-center rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                      {POSITIVE_CAPS[id]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">{t(`adjust.items.${id}.body`)}</p>
              </div>
              <div className="shrink-0 w-40">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  className="text-right tabular-nums"
                  value={amounts[`POSITIVE:${id}`] ? String(amounts[`POSITIVE:${id}`]) : ''}
                  onChange={(e) => setAmt('POSITIVE', id, e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-violet-900">{t('adjust.positiveSubtotal')}</p>
        <p className="text-sm font-bold text-violet-700 tabular-nums">{fmt(positiveSubtotal)}</p>
      </div>

      <p className="text-sm font-semibold text-blue-700 mt-6">{t('adjust.negativeTitle')}</p>
      <div className="space-y-3 mt-3">
        {NEGATIVES.map((id) => (
          <div key={id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{t(`adjust.items.${id}.title`)}</p>
                <p className="text-xs text-slate-600 mt-1">{t(`adjust.items.${id}.body`)}</p>
              </div>
              <div className="shrink-0 w-40">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  className="text-right tabular-nums"
                  value={amounts[`NEGATIVE:${id}`] ? String(amounts[`NEGATIVE:${id}`]) : ''}
                  onChange={(e) => setAmt('NEGATIVE', id, e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-blue-900">{t('adjust.negativeSubtotal')}</p>
        <p className="text-sm font-bold text-blue-700 tabular-nums">{fmt(negativeSubtotal)}</p>
      </div>

      <div className="rounded-lg border border-slate-200 px-4 py-3 mt-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">회계상 순이익</p>
        <p className="text-sm text-slate-900 tabular-nums">{fmt(accountingIncome)}</p>
      </div>
      <div className="rounded-lg bg-slate-900 text-white px-5 py-4 mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{t('adjust.pkpLabel')}</p>
          <p className="text-[11px] text-slate-300 mt-0.5">= 회계상 순이익 + 가산 − 차감</p>
        </div>
        <p className="text-xl font-bold tabular-nums">{fmt(pkp)}</p>
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('adjust.prev')}
        </Button>
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={persistAndGo} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {t('adjust.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function CreditStep({
  t, data, onChange, onPrev, onNext,
}: {
  t: T;
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const items: ('pph22' | 'pph23' | 'pph24' | 'pph25')[] = ['pph22', 'pph23', 'pph24', 'pph25'];
  const subtotal = items.reduce((s, k) => s + Number(data[k] ?? 0), 0);
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('credit.title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('credit.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {items.map((k) => (
          <div key={k} className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-900">{t(`credit.${k}.label`)}</p>
            <p className="text-xs text-slate-500 mt-1">{t(`credit.${k}.desc`)}</p>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              className="mt-3 text-right tabular-nums"
              value={data[k] ? String(data[k]) : ''}
              onChange={(e) => onChange({ [k]: parseNum(e.target.value) } as Partial<WizardData>)}
            />
            {data[k] ? (
              <p className="text-[11px] text-slate-500 mt-1 text-right">{fmtRp(Number(data[k]))}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-slate-100 px-4 py-3 mt-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{t('credit.subtotal')}</p>
        <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtRp(subtotal)}</p>
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('credit.prev')}
        </Button>
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onNext}>
          {t('credit.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function CalcStep({
  t, pkp, pphBadan, creditTotal, settlement, eligibleSme, onPrev, onNext,
}: {
  t: T;
  pkp: number;
  pphBadan: number;
  creditTotal: number;
  settlement: number;
  eligibleSme: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const refund = settlement < 0;
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('calc.title')}</p>

      <div className="rounded-lg border border-slate-200 p-5 mt-5 max-w-xl mx-auto">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-slate-700 font-semibold">{t('calc.pkpLabel')}</p>
              <p className="text-xs text-slate-500">{t('calc.pkpHint')}</p>
            </div>
            <span className="text-slate-900 tabular-nums">{fmtRp(pkp)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3">
            <div>
              <span className="text-slate-700">{t('calc.rateLabel')}</span>
              {eligibleSme && (
                <p className="text-[11px] text-emerald-700 mt-0.5">SME 50% 할인 (UU PPh 31E) 적용</p>
              )}
            </div>
            <span className="text-slate-900 tabular-nums">{fmtRp(pphBadan)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-700">PPh 22/23/24/25 공제 합계</span>
            <span className="text-slate-900 tabular-nums">− {fmtRp(creditTotal)}</span>
          </div>
          <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
            <span className="font-semibold text-slate-900">
              {refund ? '정산 환급' : '추가 납부'}
            </span>
            <span className={cn(
              'text-xl font-bold tabular-nums',
              refund ? 'text-emerald-700' : 'text-rose-700'
            )}>
              {fmtRpSigned(settlement)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('calc.prev')}
        </Button>
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onNext}>
          {t('calc.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function EbupotCta({ sessionId }: { sessionId: string | null }) {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs"
      onClick={() => router.push(`/${locale}/tax/ebupot?from=closing&sessionId=${sessionId ?? ''}`)}
    >
      e-Bupot →
    </Button>
  );
}

function PayBillingCta({ sessionId }: { sessionId: string | null }) {
  const [code, setCode] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let aborted = false;
    fetch(`/api/tax/annual-closing/${sessionId}/id-billing`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (!aborted && j.success && j.data) setCode(j.data.billing_code); })
      .catch(() => { /* ignore */ });
    return () => { aborted = true; };
  }, [sessionId]);

  const issue = async () => {
    if (!sessionId) return;
    setIssuing(true);
    try {
      const res = await fetch(`/api/tax/annual-closing/${sessionId}/id-billing`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setCode(json.data.billing_code);
        toast.success(`ID Billing 발급: ${json.data.billing_code}`);
      } else {
        toast.error(json.error || 'ID Billing 발급 실패');
      }
    } finally {
      setIssuing(false);
    }
  };

  if (code) {
    return (
      <span className="text-[11px] font-mono text-emerald-700 tabular-nums">{code}</span>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs"
      onClick={issue}
      disabled={!sessionId || issuing}
    >
      {issuing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
      ID Billing 발급
    </Button>
  );
}

function MonthlyStep({
  t, tc, sessionId, pphBadan, pph22, pph23, pph24, monthlyBase, monthlyAmount, onPrev, onComplete, completed,
}: {
  t: T;
  tc: T;
  sessionId: string | null;
  pphBadan: number;
  pph22: number;
  pph23: number;
  pph24: number;
  monthlyBase: number;
  monthlyAmount: number;
  onPrev: () => void;
  onComplete: () => Promise<void> | void;
  completed: boolean;
}) {
  const downloadSpt = () => {
    if (!sessionId) return;
    window.open(`/api/tax/annual-closing/${sessionId}/spt-pdf`, '_blank');
  };
  const nextSteps = t.raw('monthly.nextSteps') as string[];
  const creditValues = [
    { label: 'PPh 22 공제', value: pph22 },
    { label: 'PPh 23 공제', value: pph23 },
    { label: 'PPh 24 공제', value: pph24 },
  ];
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('monthly.title')}</p>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5 mt-5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-700 font-semibold">{t('monthly.sourceLabel')}</span>
          <span className="text-slate-900 tabular-nums">{fmtRp(pphBadan)}</span>
        </div>
        <div className="space-y-1.5 mt-2">
          {creditValues.map((c) => (
            <div key={c.label} className="flex justify-between text-xs text-slate-600">
              <span>- {c.label}</span>
              <span className="tabular-nums">{fmtRp(c.value)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-emerald-200 pt-2 mt-3 text-sm">
          <span className="text-slate-700 font-semibold">{t('monthly.pph25Base')}</span>
          <span className="text-slate-900 tabular-nums">{fmtRp(monthlyBase)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{t('monthly.monthly')}</span>
          <span>÷ 12</span>
        </div>
        <div className="flex justify-between border-t border-emerald-200 pt-2 mt-2">
          <span className="text-base font-semibold text-slate-900">{t('monthly.monthlyLabel')}</span>
          <span className="text-2xl font-bold text-emerald-700 tabular-nums">{fmtRp(monthlyAmount)}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4">{t('monthly.note')}</p>

      <div className="rounded-lg border border-slate-200 p-5 mt-5">
        <p className="text-sm font-bold text-slate-900">{t('monthly.nextStepsTitle')}</p>
        <ol className="space-y-2 mt-3 list-decimal ml-5">
          {nextSteps.map((s, i) => (
            <li key={s} className="text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span>{s}</span>
                {i === 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={downloadSpt}
                    disabled={!sessionId}
                  >
                    {t('monthly.sptCta')}
                  </Button>
                ) : (
                  <PayBillingCta sessionId={sessionId} />
                )}
              </div>
            </li>
          ))}
          <li className="text-sm text-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span>e-Bupot 1721 A1 일괄 발급</span>
              <EbupotCta sessionId={sessionId} />
            </div>
          </li>
        </ol>
      </div>

      <SubmitClosingBox sessionId={sessionId} onComplete={onComplete} completed={completed} onPrev={onPrev} t={t} />
    </div>
  );
}

function SubmitClosingBox({
  sessionId, onComplete, completed, onPrev, t,
}: {
  sessionId: string | null;
  onComplete: () => Promise<void> | void;
  completed: boolean;
  onPrev: () => void;
  t: T;
}) {
  type Sub = { status: string; channel: string; submitted_at: string };
  const [submission, setSubmission] = useState<Sub | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let aborted = false;
    fetch(`/api/tax/annual-closing/${sessionId}/submit`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (!aborted && j.success) setSubmission(j.data); })
      .catch(() => { /* ignore */ });
    return () => { aborted = true; };
  }, [sessionId]);

  const submit = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tax/annual-closing/${sessionId}/submit`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setSubmission(json.data);
        toast.success('SPT 제출 완료 — 운영팀 검증 대기중');
        await onComplete();
      } else {
        toast.error(json.error || '제출 실패');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {submission ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 mt-5">
          <p className="text-xs font-semibold text-emerald-700">제출 완료</p>
          <p className="text-sm font-medium text-emerald-900 mt-1">
            상태 {submission.status} · 채널 {submission.channel}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            제출 시각 {new Date(submission.submitted_at).toLocaleString()}
          </p>
          <p className="text-[11px] text-amber-700 mt-2">
            ※ Coretax API 활성화 전이므로 운영팀이 RPA로 DJP에 첨부합니다.
          </p>
        </div>
      ) : null}

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('monthly.prev')}
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-500"
          onClick={submission ? () => void onComplete() : submit}
          disabled={!sessionId || submitting || completed}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
          {submission || completed ? '결산 완료됨' : 'SPT 제출 + 결산 완료'}
        </Button>
      </div>
    </>
  );
}
