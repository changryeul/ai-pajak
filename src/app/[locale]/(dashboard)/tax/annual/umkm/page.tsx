'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Building2, FileText, Printer, Upload as UploadIcon, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepId = 'basic' | 'collect' | 'statements' | 'sign' | 'calc' | 'billing' | 'submit';
const STEPS: StepId[] = ['basic', 'collect', 'statements', 'sign', 'calc', 'billing', 'submit'];

type DocId = 'akta' | 'aktaRev' | 'sk' | 'bank' | 'sales' | 'purchase' | 'petty' | 'inventory' | 'assets';
const DOC_IDS: DocId[] = ['akta', 'aktaRev', 'sk', 'bank', 'sales', 'purchase', 'petty', 'inventory', 'assets'];
const DOC_REQUIRED: DocId[] = ['akta', 'aktaRev', 'sk', 'bank', 'sales', 'purchase'];

export default function UmkmClosingPage() {
  const t = useTranslations('umkmClosing');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [step, setStep] = useState<StepId>('basic');
  const [uploaded, setUploaded] = useState<Set<DocId>>(new Set());
  const [signedUploaded, setSignedUploaded] = useState(false);

  const stepIdx = STEPS.indexOf(step);
  const goNext = () => stepIdx < STEPS.length - 1 && setStep(STEPS[stepIdx + 1]);
  const goPrev = () => stepIdx > 0 && setStep(STEPS[stepIdx - 1]);

  const uploadDoc = (id: DocId) => {
    setUploaded((prev) => new Set(prev).add(id));
    toast.success(t('collect.uploadedBadge'));
  };

  const progressPct = useMemo(() => {
    const need = DOC_IDS.length;
    return Math.round((uploaded.size / need) * 100);
  }, [uploaded]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Title row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            {t('pageTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard`)}>
          {t('backToDashboard')}
        </Button>
      </div>

      {/* Closing-type toggle (locked to UMKM in this page) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border-2 border-blue-500 bg-blue-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-blue-900">{t('typeLock.umkm')}</p>
            <p className="text-xs text-blue-700 mt-0.5">PPh Final 0.5%</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white">
            {t('typeLock.selected')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/tax/annual/pph25`)}
          className="rounded-xl border-2 border-slate-200 bg-white p-4 text-left hover:border-slate-300"
        >
          <p className="text-sm font-bold text-slate-900">{t('typeLock.other')}</p>
          <p className="text-xs text-slate-500 mt-0.5">PPh 25 일반 결산</p>
        </button>
      </div>

      {/* Requirement / Core box */}
      {step === 'basic' ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 mb-5">
          <p className="text-sm font-bold text-blue-900">{t('requirementBox.title')}</p>
          <ul className="text-xs text-blue-800 mt-2 space-y-0.5 list-disc ml-5">
            {(t.raw('requirementBox.items') as string[]).map((it) => <li key={it}>{it}</li>)}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 mb-5">
          <p className="text-sm font-bold text-blue-900">{t('coreBox.title')}</p>
          <ul className="text-xs text-blue-800 mt-2 space-y-0.5 list-disc ml-5">
            {(t.raw('coreBox.items') as string[]).map((it) => <li key={it}>{it}</li>)}
          </ul>
        </div>
      )}

      {/* Step indicator (dots) */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const active = step === s;
          const done = i < stepIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s)}
                className={cn(
                  'h-7 w-7 rounded-full text-xs font-bold transition-all',
                  active
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                )}
                title={t(`steps.${s}`)}
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
        {step === 'basic' && <BasicStep t={t} onNext={goNext} />}
        {step === 'collect' && (
          <CollectStep
            t={t}
            uploaded={uploaded}
            onUpload={uploadDoc}
            progressPct={progressPct}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}
        {step === 'statements' && <StatementsStep t={t} onPrev={goPrev} onNext={goNext} />}
        {step === 'sign' && (
          <SignStep
            t={t}
            tc={tc}
            signedUploaded={signedUploaded}
            onUpload={() => { setSignedUploaded(true); toast.success(t('collect.uploadedBadge')); }}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}
        {step === 'calc' && <CalcStep t={t} onPrev={goPrev} onNext={goNext} />}
        {step === 'billing' && <BillingStep t={t} tc={tc} onPrev={goPrev} onNext={goNext} />}
        {step === 'submit' && <SubmitStep t={t} tc={tc} onPrev={goPrev} />}
      </div>
    </div>
  );
}

// ---------- Step components ----------

type T = ReturnType<typeof useTranslations>;

function BasicStep({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('basic.title')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.companyName')}</Label>
          <Input defaultValue="PT Example Indonesia" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.npwp')}</Label>
          <Input defaultValue="0123456789012000" className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.fiscalYear')}</Label>
          <Input defaultValue="2025" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('basic.annualRevenue')}</Label>
          <Input defaultValue="Rp 3,200,000,000" />
        </div>
      </div>

      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 mt-5">
        <p className="text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {t('basic.okMsg')}
        </p>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mt-3">
        <p className="text-sm text-amber-800">{t('basic.deadlineMsg')}</p>
      </div>

      <div className="flex justify-end mt-5">
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onNext}>
          {t('basic.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function CollectStep({
  t,
  uploaded,
  onUpload,
  progressPct,
  onPrev,
  onNext,
}: {
  t: T;
  uploaded: Set<DocId>;
  onUpload: (id: DocId) => void;
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
        {DOC_IDS.map((id) => {
          const isReq = DOC_REQUIRED.includes(id);
          const isUp = uploaded.has(id);
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
                  <p className="text-[11px] text-blue-700 mt-2">
                    {t('collect.detailLink')} {t(`collect.items.${id}.detail`)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-8 text-xs"
                  onClick={() => onUpload(id)}
                >
                  <UploadIcon className="h-3 w-3 mr-1" />
                  {isUp ? t('collect.reuploadCta') : t('collect.uploadCta')}
                </Button>
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

function StatementsStep({ t, onPrev, onNext }: { t: T; onPrev: () => void; onNext: () => void }) {
  const plRows: (keyof { sales: 1; cogs: 1; salary: 1; opex: 1; petty: 1; deprec: 1 })[] = ['sales', 'cogs', 'salary', 'opex', 'petty', 'deprec'];
  const plValues: Record<string, string> = {
    sales: 'Rp 3,100,000,000', cogs: 'Rp 890,000,000', salary: 'Rp 420,000,000', opex: 'Rp 260,000,000', petty: 'Rp 35,000,000', deprec: 'Rp 72,000,000',
  };
  const bsAssets: ('cash' | 'ar' | 'inventory' | 'fa')[] = ['cash', 'ar', 'inventory', 'fa'];
  const bsAssetValues: Record<string, string> = {
    cash: 'Rp 1,405,000,000', ar: 'Rp 240,000,000', inventory: 'Rp 180,000,000', fa: 'Rp 288,000,000',
  };
  const bsLE: ('loan' | 'capital' | 'surplus' | 'retained')[] = ['loan', 'capital', 'surplus', 'retained'];
  const bsLEValues: Record<string, string> = {
    loan: 'Rp 95,000,000', capital: 'Rp 180,000,000', surplus: 'Rp 500,000,000', retained: 'Rp 1,338,000,000',
  };
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
            {plRows.map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-600">{t(`statements.pl.${k}`)}</span>
                <span className="text-slate-900 tabular-nums">{plValues[k]}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-3">
              <span className="font-semibold text-slate-900">{t('statements.pl.netIncome')}</span>
              <span className="font-bold text-slate-900 tabular-nums">Rp 1,423,000,000</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-5">
          <p className="text-sm font-bold text-slate-900 mb-3">{t('statements.bs.title')}</p>
          <div className="space-y-2 text-sm">
            {bsAssets.map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-600">{t(`statements.bs.${k}`)}</span>
                <span className="text-slate-900 tabular-nums">{bsAssetValues[k]}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="font-semibold text-slate-900">{t('statements.bs.totalAssets')}</span>
              <span className="font-bold text-slate-900 tabular-nums">Rp 2,113,000,000</span>
            </div>
            <div className="h-px bg-slate-100 my-2" />
            {bsLE.map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-600">{t(`statements.bs.${k}`)}</span>
                <span className="text-slate-900 tabular-nums">{bsLEValues[k]}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="font-semibold text-slate-900">{t('statements.bs.totalLE')}</span>
              <span className="font-bold text-slate-900 tabular-nums">Rp 2,113,000,000</span>
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

function SignStep({
  t,
  tc,
  signedUploaded,
  onUpload,
  onPrev,
  onNext,
}: {
  t: T;
  tc: T;
  signedUploaded: boolean;
  onUpload: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div>
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
          onClick={() => toast.info(tc('comingSoon'))}
          className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50"
        >
          <Printer className="h-5 w-5 mx-auto text-slate-700" />
          <p className="text-sm font-medium text-slate-900 mt-2">{t('sign.stepPrint')}</p>
        </button>
        <button
          type="button"
          onClick={() => toast.info(tc('comingSoon'))}
          className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50"
        >
          <FileText className="h-5 w-5 mx-auto text-slate-700" />
          <p className="text-sm font-medium text-slate-900 mt-2">{t('sign.stepLocation')}</p>
        </button>
        <button
          type="button"
          onClick={onUpload}
          className={cn(
            'rounded-lg border p-4 text-center transition-colors',
            signedUploaded ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
          )}
        >
          {signedUploaded ? (
            <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600" />
          ) : (
            <UploadIcon className="h-5 w-5 mx-auto text-slate-700" />
          )}
          <p className={cn('text-sm font-medium mt-2', signedUploaded ? 'text-emerald-800' : 'text-slate-900')}>
            {t('sign.stepUpload')}
          </p>
        </button>
      </div>

      <p className="text-xs text-slate-500 mt-4">{t('sign.hint')}</p>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('sign.prev')}
        </Button>
        <Button
          size="sm"
          className="bg-slate-900 text-white hover:bg-slate-800"
          onClick={onNext}
          disabled={!signedUploaded}
        >
          {t('sign.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function CalcStep({ t, onPrev, onNext }: { t: T; onPrev: () => void; onNext: () => void }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('calc.title')}</p>

      <div className="rounded-lg border border-slate-200 p-5 mt-5 max-w-xl mx-auto">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">{t('calc.base')}</span>
            <span className="text-slate-900 tabular-nums">{t('calc.baseValue')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{t('calc.rate')}</span>
            <span className="text-slate-900 tabular-nums">{t('calc.rateValue')}</span>
          </div>
          <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
            <span className="font-semibold text-slate-900">{t('calc.result')}</span>
            <span className="text-xl font-bold text-blue-700 tabular-nums">{t('calc.resultValue')}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4 text-center">{t('calc.note')}</p>

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

function BillingStep({ t, tc, onPrev, onNext }: { t: T; tc: T; onPrev: () => void; onNext: () => void }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('billing.title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('billing.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
        <div className="rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500">{t('billing.amount')}</p>
          <p className="text-xl font-bold text-slate-900 mt-2 tabular-nums">{t('billing.amountValue')}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500">{t('billing.method')}</p>
          <p className="text-sm font-medium text-slate-900 mt-2">{t('billing.methodValue')}</p>
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => toast.info(tc('comingSoon'))}>
          {t('billing.issueCta')}
        </Button>
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('billing.prev')}
        </Button>
        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={onNext}>
          {t('billing.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function SubmitStep({ t, tc, onPrev }: { t: T; tc: T; onPrev: () => void }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('submit.title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('submit.subtitle')}</p>

      <div className="flex flex-wrap justify-end gap-2 mt-5">
        <Button size="sm" variant="outline" onClick={() => toast.info(tc('comingSoon'))}>
          {t('submit.generateCta')}
        </Button>
        <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => toast.success(tc('comingSoon'))}>
          {t('submit.submitCta')}
        </Button>
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('submit.prev')}
        </Button>
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled>
          <CheckCircle2 className="h-4 w-4 mr-1" />
          {t('submit.done')}
        </Button>
      </div>
    </div>
  );
}
