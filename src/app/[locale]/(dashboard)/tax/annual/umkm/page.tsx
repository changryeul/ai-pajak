'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Building2, FileText, Printer, Upload as UploadIcon, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useClosingSession, type ClosingDocument } from '@/hooks/useClosingSession';

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
  const { session: userSession } = useSession();

  // Default to (current calendar year - 1) as the closing fiscal year.
  const fiscalYear = new Date().getFullYear() - 1;
  const enabled = !!userSession?.customerId;
  const closing = useClosingSession({ fiscalYear, closingType: 'UMKM', enabled });

  const [step, setStep] = useState<StepId>('basic');

  // Hydrate step from server-saved value once it loads.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (closing.session?.current_step && STEPS.includes(closing.session.current_step as StepId)) {
      setStep(closing.session.current_step as StepId);
      hydratedRef.current = true;
    }
  }, [closing.session?.current_step]);

  // ── Wizard inputs (persisted in session.data) ───────────────────
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
  };
  const data = (closing.session?.data ?? {}) as WizardData;
  const annualRevenue = Number(data.annualRevenue ?? 0);
  const cogs = Number(data.cogs ?? 0);
  const salary = Number(data.salary ?? 0);
  const opex = Number(data.opex ?? 0);
  const petty = Number(data.petty ?? 0);
  const deprec = Number(data.deprec ?? 0);
  const netIncome = annualRevenue - cogs - salary - opex - petty - deprec;
  const finalTax = Math.round(annualRevenue * 0.005);
  const meetsUmkm = annualRevenue > 0 && annualRevenue <= 4_800_000_000;

  const updateData = (patch: Partial<WizardData>) => {
    const merged = { ...data, ...patch } as Record<string, unknown>;
    closing.patch({ data: merged });
  };

  const stepIdx = STEPS.indexOf(step);
  const goNext = () => {
    if (stepIdx >= STEPS.length - 1) return;
    const next = STEPS[stepIdx + 1];
    setStep(next);
    closing.patch({ currentStep: next });
  };
  const goPrev = () => {
    if (stepIdx <= 0) return;
    const prev = STEPS[stepIdx - 1];
    setStep(prev);
    closing.patch({ currentStep: prev });
  };

  const completeAndExit = async () => {
    await closing.patch({ status: 'COMPLETED' });
    toast.success(t('submit.done'));
  };

  const uploaded = useMemo(() => {
    const set = new Set<DocId>();
    for (const d of closing.documents) {
      if ((DOC_IDS as string[]).includes(d.doc_type)) {
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

  const progressPct = useMemo(() => {
    return Math.round((uploaded.size / DOC_IDS.length) * 100);
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
        {closing.loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            {tc('loading')}
          </div>
        ) : (
          <>
            {step === 'basic' && (
              <BasicStep
                t={t}
                data={data}
                onChange={updateData}
                meetsUmkm={meetsUmkm}
                onNext={goNext}
              />
            )}
            {step === 'collect' && (
              <CollectStep
                t={t}
                uploaded={uploaded}
                docMap={closing.documents}
                onUpload={uploadDoc}
                progressPct={progressPct}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step === 'statements' && (
              <StatementsStep
                t={t}
                values={{ annualRevenue, cogs, salary, opex, petty, deprec, netIncome }}
                onChange={updateData}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step === 'sign' && (
              <SignStep
                t={t}
                tc={tc}
                sessionId={closing.session?.id ?? null}
                signedUploaded={signedUploaded}
                onUpload={uploadSigned}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step === 'calc' && (
              <CalcStep
                t={t}
                annualRevenue={annualRevenue}
                finalTax={finalTax}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step === 'billing' && (
              <BillingStep
                t={t}
                tc={tc}
                finalTax={finalTax}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step === 'submit' && (
              <SubmitStep
                t={t}
                tc={tc}
                sessionId={closing.session?.id ?? null}
                onPrev={goPrev}
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

// ---------- Step components ----------

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
};

const fmtRp = (n: number) =>
  'Rp ' + new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(n)));

const parseNum = (s: string): number => {
  const cleaned = s.replace(/[^0-9.]/g, '');
  return Number(cleaned) || 0;
};

function BasicStep({
  t, data, onChange, meetsUmkm, onNext,
}: {
  t: T;
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  meetsUmkm: boolean;
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
            onBlur={(e) => onChange({ companyName: e.target.value })}
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
            placeholder="3,200,000,000"
            className="text-right tabular-nums"
          />
          {data.annualRevenue ? (
            <p className="text-xs text-slate-500">{fmtRp(data.annualRevenue)}</p>
          ) : null}
        </div>
      </div>

      {meetsUmkm ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 mt-5">
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {t('basic.okMsg')}
          </p>
        </div>
      ) : data.annualRevenue && data.annualRevenue > 4_800_000_000 ? (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 mt-5">
          <p className="text-sm text-rose-700">
            연매출 Rp 4.8B 초과 — UMKM 0.5% 적용 불가. PPh25 일반 결산으로 전환을 권장합니다.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mt-3">
        <p className="text-sm text-amber-800">{t('basic.deadlineMsg')}</p>
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
  t,
  uploaded,
  docMap,
  onUpload,
  progressPct,
  onPrev,
  onNext,
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
        {DOC_IDS.map((id) => {
          const isReq = DOC_REQUIRED.includes(id);
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
  values: { annualRevenue: number; cogs: number; salary: number; opex: number; petty: number; deprec: number; netIncome: number };
  onChange: (patch: Partial<WizardData>) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // PL is fully editable. BS values are derived from PL totals (best-effort
  // demo model — refined in Phase 4 once bank/inventory data is parsed).
  const totalAssets = Math.round(values.netIncome + 690_000_000); // placeholder offset
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
            <PlRow label={t('statements.pl.sales')} value={values.annualRevenue} readOnly />
            <PlRow label={t('statements.pl.cogs')} value={values.cogs} onChange={(v) => onChange({ cogs: v })} />
            <PlRow label={t('statements.pl.salary')} value={values.salary} onChange={(v) => onChange({ salary: v })} />
            <PlRow label={t('statements.pl.opex')} value={values.opex} onChange={(v) => onChange({ opex: v })} />
            <PlRow label={t('statements.pl.petty')} value={values.petty} onChange={(v) => onChange({ petty: v })} />
            <PlRow label={t('statements.pl.deprec')} value={values.deprec} onChange={(v) => onChange({ deprec: v })} />
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-3">
              <span className="font-semibold text-slate-900">{t('statements.pl.netIncome')}</span>
              <span className="font-bold text-slate-900 tabular-nums">{fmtRp(values.netIncome)}</span>
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

function PlRow({
  label, value, readOnly, onChange,
}: { label: string; value: number; readOnly?: boolean; onChange?: (v: number) => void }) {
  if (readOnly) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900 tabular-nums">{fmtRp(value)}</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-slate-600 flex-1">{label}</span>
      <Input
        type="text"
        inputMode="numeric"
        value={value ? String(value) : ''}
        onChange={(e) => onChange?.(parseNum(e.target.value))}
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
  t,
  tc,
  sessionId,
  signedUploaded,
  onUpload,
  onPrev,
  onNext,
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
        <button
          type="button"
          onClick={() => toast.info(tc('comingSoon'))}
          className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50"
        >
          <FileText className="h-5 w-5 mx-auto text-slate-700" />
          <p className="text-sm font-medium text-slate-900 mt-2">{t('sign.stepLocation')}</p>
        </button>
        <label
          className={cn(
            'rounded-lg border p-4 text-center transition-colors cursor-pointer block',
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

function CalcStep({
  t, annualRevenue, finalTax, onPrev, onNext,
}: {
  t: T;
  annualRevenue: number;
  finalTax: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('calc.title')}</p>

      <div className="rounded-lg border border-slate-200 p-5 mt-5 max-w-xl mx-auto">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">{t('calc.base')}</span>
            <span className="text-slate-900 tabular-nums">{fmtRp(annualRevenue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{t('calc.rate')}</span>
            <span className="text-slate-900 tabular-nums">0.5%</span>
          </div>
          <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
            <span className="font-semibold text-slate-900">{t('calc.result')}</span>
            <span className="text-xl font-bold text-blue-700 tabular-nums">{fmtRp(finalTax)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4 text-center">{t('calc.note')}</p>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('calc.prev')}
        </Button>
        <Button
          size="sm"
          className="bg-slate-900 text-white hover:bg-slate-800"
          onClick={onNext}
          disabled={finalTax <= 0}
        >
          {t('calc.next')}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function BillingStep({
  t, tc, finalTax, onPrev, onNext,
}: {
  t: T;
  tc: T;
  finalTax: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('billing.title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('billing.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
        <div className="rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500">{t('billing.amount')}</p>
          <p className="text-xl font-bold text-slate-900 mt-2 tabular-nums">{fmtRp(finalTax)}</p>
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

function SubmitStep({
  t, tc, sessionId, onPrev, onComplete, completed,
}: {
  t: T;
  tc: T;
  sessionId: string | null;
  onPrev: () => void;
  onComplete: () => Promise<void> | void;
  completed: boolean;
}) {
  const downloadSpt = () => {
    if (!sessionId) return;
    window.open(`/api/tax/annual-closing/${sessionId}/spt-pdf`, '_blank');
  };
  return (
    <div>
      <p className="text-base font-bold text-slate-900">{t('submit.title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('submit.subtitle')}</p>

      <div className="flex flex-wrap justify-end gap-2 mt-5">
        <Button size="sm" variant="outline" onClick={downloadSpt} disabled={!sessionId}>
          {t('submit.generateCta')}
        </Button>
        <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => toast.info(tc('comingSoon'))}>
          {t('submit.submitCta')}
        </Button>
      </div>

      <div className="flex justify-between mt-5">
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('submit.prev')}
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-500"
          onClick={() => void onComplete()}
          disabled={completed}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          {t('submit.done')}
        </Button>
      </div>
    </div>
  );
}
