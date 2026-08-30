/**
 * 세무 기준 설정 — Admin / Tax Engine 페이지. PDF p.26-27.
 *
 * Track A 이전이라 페이지 자체 접근은 operator/supervisor/master 모두 가능.
 * §3 "Tax Code Rules" 만 DB-backed + MASTER inline-editable (Track B);
 * 나머지 §1/§2/§4/§5 는 정적 view.
 */

import { redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { PageTitle } from '@/components/layout/PageTitle';
import { TaxCodeRulesTable } from './_components/TaxCodeRulesTable';
import { TaxCodeRuleAuditTimeline } from './_components/TaxCodeRuleAuditTimeline';
import { CoretaxStatusCard } from './_components/CoretaxStatusCard';
import { MfaPolicyCard } from './_components/MfaPolicyCard';
import type { TaxCodeRule } from '@/types/tax-code-rule';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadAuditRows } from '@/lib/tax-code-rule/audit-log';

export default async function OperatorSettingsPage() {
  const t = await getTranslations('operatorSettings');

  // Resolve current user role for canEdit gate.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user ? await resolveUserRole(supabase, user.id) : null;

  // Track A: narrow to MASTER + SUPERVISOR (PDF "Admin/Tax Engine" governance).
  // operator/layout.tsx 가 이미 4 operator-tier role 을 허용하지만, settings
  // 페이지는 governance scope 라 OPERATOR/LEAD 를 추가 차단. silent redirect
  // 패턴은 operator/layout.tsx 와 일관.
  const SETTINGS_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
  if (!role || !SETTINGS_ROLES.includes(role)) {
    const locale = await getLocale();
    redirect(`/${locale}/operator/dashboard`);
  }

  const canEdit = role === 'TAX_OPERATOR_MASTER';
  const pageLocale = await getLocale();

  // Fetch tax code rules. RLS policy `tax_code_rule_read` USING (true)
  // permits any authenticated session — exercise it instead of bypassing
  // with the service role, so a future RLS regression surfaces immediately.
  const { data: rulesRaw } = await supabase
    .from('tax_code_rule')
    .select('*')
    .order('sort_order', { ascending: true });
  const rules = (rulesRaw ?? []) as TaxCodeRule[];

  // Audit timeline — last 10 PATCH events with full diff. Shared helper.
  const initialAuditRows = await loadAuditRows(10);

  // Coretax toggle (Track D) — admin client for system_setting read.
  const admin = getSupabaseAdmin();
  const { data: coretaxRow } = await admin
    .from('system_setting')
    .select('value, updated_by, updated_at')
    .eq('key', 'coretax.submit_enabled')
    .single();
  const coretaxConfig = {
    enabled: (coretaxRow?.value as { enabled?: boolean } | undefined)?.enabled === true,
    updatedAt: coretaxRow?.updated_at ?? null,
    updatedBy: coretaxRow?.updated_by ?? null,
  };

  // Operator 2FA enforcement toggle — same kv pattern as coretax.
  const { data: mfaRow } = await admin
    .from('system_setting')
    .select('value, updated_by, updated_at')
    .eq('key', 'security.operator_mfa_required')
    .single();
  const mfaConfig = {
    enabled: (mfaRow?.value as { enabled?: boolean } | undefined)?.enabled === true,
    updatedAt: mfaRow?.updated_at ?? null,
    updatedBy: mfaRow?.updated_by ?? null,
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title={t('pageTitle')} />

      {/* ── header ── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900">{t('pageHeading')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{t('pageDesc')}</p>
        </div>
        <span className="flex-shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
          {t('adminBadge')}
        </span>
      </div>

      {/* ── header card strip ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <Header label={t('header.fiscalYear')} value="2025" />
        <Header label={t('header.platform')} value="Coretax DJP" />
        <CoretaxStatusCard initial={coretaxConfig} canEdit={canEdit} />
        <MfaPolicyCard initial={mfaConfig} canEdit={canEdit} />
        <Header label={t('header.manageTarget')} value={t('header.manageTargetValue')} />
      </div>

      {/* ── §1 + §2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">1. {t('badan.title')}</h2>
            <Pill tone="blue">Form Profile</Pill>
          </div>
          <p className="text-sm text-slate-600">{t('badan.desc')}</p>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">Badan Form Profile</h3>
              <Pill tone="slate">{t('badan.legacy')}</Pill>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">{t('badan.desc')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <KeyVal label={t('badan.current')} value={t('badan.currentValue')} />
              <KeyVal label={t('badan.model')}   value={t('badan.modelValue')} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">OP Form Profile</h3>
              <Pill tone="slate">{t('op.legacy')}</Pill>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">{t('op.desc')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <KeyVal label={t('op.current')} value={t('op.currentValue')} />
              <KeyVal label={t('op.model')}   value={t('op.modelValue')} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900">{t('control.title')}</h2>
            <Pill tone="indigo">{t('control.badge')}</Pill>
          </div>
          <div className="space-y-3">
            <ControlBox title={t('control.whyTitle')}     body={t('control.whyBody')} />
            <ControlBox title={t('control.whoTitle')}     body={t('control.whoBody')} />
            <ControlBox title={t('control.visibleTitle')} body={t('control.visibleBody')} />
            <ControlBox title={t('control.auditTitle')}   body={t('control.auditBody')} />
          </div>
        </section>
      </div>

      {/* ── §3 Tax Code Rules (DB-backed + inline edit) ── */}
      <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-black text-slate-900">{t('rules.title')}</h2>
          <Pill tone="blue">{t('rules.badge')}</Pill>
        </div>
        <p className="text-sm text-slate-600 mb-4">{t('rules.intro')}</p>
        <TaxCodeRulesTable initialRules={rules} canEdit={canEdit} />
      </section>

      {/* ── 필수항목 관리 (2026-08-30) — MASTER 가 고객 데이터 필수항목 선택/추가/삭제 ── */}
      <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">필수항목 관리</h2>
            <p className="text-sm text-slate-600 mt-1">고객 데이터 폼(회사/개인 프로필·원천세·부가세·급여)의 필수항목을 선택·추가·삭제합니다. 고객 화면에 별표(*) + 미입력 시 입력유도.</p>
          </div>
          <a href={`/${pageLocale}/admin/master/required-fields`}
            className="flex-shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">필수항목 설정 →</a>
        </div>
      </section>

      {/* ── §4 + §5 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900">{t('decision.title')}</h2>
            <Pill tone="blue">{t('decision.badge')}</Pill>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DecisionBox title={t('decision.box1Title')} body={t('decision.box1Body')} />
            <DecisionBox title={t('decision.box2Title')} body={t('decision.box2Body')} />
            <DecisionBox title={t('decision.box3Title')} body={t('decision.box3Body')} />
            <DecisionBox title={t('decision.box4Title')} body={t('decision.box4Body')} />
            <DecisionBox title={t('decision.box5Title')} body={t('decision.box5Body')} />
            <DecisionBox title={t('decision.box6Title')} body={t('decision.box6Body')} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900">{t('audit.title')}</h2>
            <Pill tone="blue">{t('audit.badge')}</Pill>
          </div>
          <TaxCodeRuleAuditTimeline initialRows={initialAuditRows} />
        </section>
      </div>
    </div>
  );
}

function Header({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  const cls = tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cls}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-black text-slate-900">{value}</p>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ControlBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function DecisionBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}

function Pill({ tone, children }: { tone: 'slate' | 'blue' | 'indigo' | 'amber' | 'emerald'; children: React.ReactNode }) {
  const cls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : tone === 'indigo'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  );
}
