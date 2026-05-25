'use client';

/**
 * 세무 기준 설정 — Admin / Tax Engine 페이지.
 *
 * PDF 「수퍼바이저 화면 메신저 포함 20260525」 p.26-27 spec 그대로:
 *   상단 5-카드 (귀속연도 / 플랫폼 / Coretax 상태 / 관리대상 + Admin badge)
 *   1. 신고연도 / 양식버전 — Badan / OP Form Profile
 *   2. 운영 기준 — 4-박스 (왜 / 누가 / 보이나 / 통제)
 *   3. Tax Code Rules — 7-row 테이블
 *   4. 판단 조건 — 6-박스
 *   5. 기준 변경이력 — Audit row list
 *
 * 현재는 정적 informational. 다음 트랙에서 admin-edit 모드 + Coretax API
 * 토글 + 변경이력 영구 저장 추가 예정.
 */

import { useTranslations } from 'next-intl';
import { PageTitle } from '@/components/layout/PageTitle';

interface TaxRuleRow {
  category: string;
  taxCode: string;
  rate: string;
  condition: string;
  doc: string;
  review: string;
}

// PDF p.27 의 Tax Code Rules 7행을 그대로 표시.
const TAX_RULES_KO: TaxRuleRow[] = [
  { category: 'PPh21',    taxCode: '411121-100', rate: '급여/비정기소득별 누진·TER 기준',     condition: '직원 급여, THR, bonus, benefit 등',         doc: 'Payroll, A1/A2, employee master',         review: '직원구분/비과세/공제항목 확인' },
  { category: 'PPh23',    taxCode: '411124-104', rate: '일반 용역 2% 등',                    condition: '서비스 수수료, management fee, royalty 등', doc: 'Invoice, contract, bukti potong',         review: '서비스 성격과 계약서 문구 확인' },
  { category: 'PPh4(2)',  taxCode: '411128-403', rate: '최종분리과세 항목별 상이',             condition: '건물 임대, 특정 건설서비스, 토지/건물 거래 등', doc: '계약서, 라이선스, invoice',                  review: 'PPh23과 혼동 위험이 큰 항목 우선검토' },
  { category: 'PPh22',    taxCode: '411122-100', rate: '거래/수입/기관별 상이',               condition: '수입, 정부거래, 특정 상품 거래',            doc: 'PIB, purchase document, payment proof',   review: '거래주체와 과세대상 여부 확인' },
  { category: 'PPh26',    taxCode: '411127-100', rate: '기본 20% / 조세조약 적용 가능',         condition: '비거주자 지급, royalty, interest, technical fee', doc: 'DGT Form, treaty residence certificate, contract', review: '조세조약 적용 가능성과 DGT 유효성 확인' },
  { category: 'PPN',      taxCode: '411211-100', rate: '현재 적용 VAT rate 기준',             condition: '과세 재화/용역, PKP 거래',                doc: 'Faktur Pajak, invoice, e-Faktur data',    review: 'PKP 여부, VAT credit 가능 여부 확인' },
  { category: 'PPh25',    taxCode: '411126-100', rate: '전년도 기준 월할 또는 신규 기준',        condition: '법인/개인 월별 선납세액',                  doc: '전년도 SPT, PPh25 billing history',       review: 'UMKM final 전환 여부와 법인나이 확인' },
];

interface AuditRow {
  titleKey: string;
  body: string;
  byKey: 'sampleByTaxAdmin' | 'sampleBySystem';
  ts: string;
  stateKey: 'stateApplied' | 'stateReviewing';
}

const AUDIT_ROWS: AuditRow[] = [
  { titleKey: 'SPT OP Form Profile', body: '1770/1770S/1770SS 선택 기준 대신 Coretax 단일 OP Form 기준 표시',          byKey: 'sampleByTaxAdmin', ts: '2026-05-25', stateKey: 'stateApplied' },
  { titleKey: 'PPh23/PPh4(2) 판단',  body: '건물 임대·서비스 혼합 계약은 Supervisor 검토필요로 상향',                  byKey: 'sampleByTaxAdmin', ts: '2026-05-25', stateKey: 'stateReviewing' },
  { titleKey: 'Coretax Integration', body: 'API 미연동 / 상담원 수동처리 기준 유지',                                  byKey: 'sampleBySystem',   ts: '2026-05-25', stateKey: 'stateApplied' },
];

export default function OperatorSettingsPage() {
  const t = useTranslations('operatorSettings');
  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title={t('pageTitle')} />

      {/* ── header: title + admin badge + page desc ── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900">{t('pageHeading')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{t('pageDesc')}</p>
        </div>
        <span className="flex-shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
          {t('adminBadge')}
        </span>
      </div>

      {/* ── 4-card header strip ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <Header label={t('header.fiscalYear')} value="2025" />
        <Header label={t('header.platform')} value="Coretax DJP" />
        <Header label={t('header.coretaxStatus')} value={t('header.coretaxStatusValue')} tone="amber" />
        <Header label={t('header.manageTarget')} value={t('header.manageTargetValue')} />
      </div>

      {/* ── 1. 신고연도 / 양식버전 + 2. 운영 기준 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">1. {t('badan.title')}</h2>
            <Pill tone="blue">Form Profile</Pill>
          </div>
          <p className="text-sm text-slate-600">{t('badan.desc')}</p>

          {/* Badan Form Profile */}
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

          {/* OP Form Profile */}
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

        {/* 2. 운영 기준 */}
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

      {/* ── 3. Tax Code Rules ── */}
      <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-black text-slate-900">{t('rules.title')}</h2>
          <Pill tone="blue">{t('rules.badge')}</Pill>
        </div>
        <p className="text-sm text-slate-600 mb-4">{t('rules.intro')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">{t('rules.colCategory')}</th>
                <th className="text-left px-3 py-2">{t('rules.colCode')}</th>
                <th className="text-left px-3 py-2">{t('rules.colRate')}</th>
                <th className="text-left px-3 py-2">{t('rules.colCondition')}</th>
                <th className="text-left px-3 py-2">{t('rules.colDoc')}</th>
                <th className="text-left px-3 py-2">{t('rules.colReview')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TAX_RULES_KO.map((r) => (
                <tr key={r.category}>
                  <td className="px-3 py-2.5 font-bold text-slate-900">{r.category}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-700">{r.taxCode}</td>
                  <td className="px-3 py-2.5 text-slate-700">{r.rate}</td>
                  <td className="px-3 py-2.5 text-slate-700">{r.condition}</td>
                  <td className="px-3 py-2.5 text-slate-700">{r.doc}</td>
                  <td className="px-3 py-2.5 text-slate-700">{r.review}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. 판단 조건 + 5. 기준 변경이력 ── */}
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
          <ul className="space-y-3">
            {AUDIT_ROWS.map((row) => (
              <li key={row.titleKey} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{row.titleKey}</p>
                  <Pill tone={row.stateKey === 'stateApplied' ? 'emerald' : 'amber'}>
                    {t(`audit.${row.stateKey}`)}
                  </Pill>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{row.body}</p>
                <p className="mt-2 text-[10px] text-slate-400">
                  {row.ts} · {t(`audit.${row.byKey}`)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Header({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'amber';
}) {
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

function Pill({
  tone,
  children,
}: {
  tone: 'slate' | 'blue' | 'indigo' | 'amber' | 'emerald';
  children: React.ReactNode;
}) {
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
