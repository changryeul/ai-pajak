'use client';

/**
 * Personal dashboard (INDIVIDUAL customer) — mockup-driven redesign.
 *
 * Ten sections, top to bottom:
 *   1. Header + nationality/tax-rule filters
 *   2. Last 3 years of filings
 *   3. Spouse filing mode + dependents
 *   4. Assets / Liabilities summary (two cards)
 *   5. Domestic asset trend line chart
 *   6. Domestic liability trend line chart
 *   7. Foreign asset trend line chart
 *   8. Foreign liability trend line chart
 *   9. Asset-growth anomaly alert + fund-source checklist
 *  10. AI analysis comment + CTAs (start filing / view progress)
 *
 * Data precedence:
 *   - Profile (customer_type, ptkp_status, nationality) from /api/customer/profile
 *   - Filings list from /api/tax/filings?customerId=X
 *   - Latest SPT_TAHUNAN taxData.harta/utang → totals + chart series
 *   - Historical series are derived per-year from filings; gaps fill with
 *     sample values so the chart is never an empty axis
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, CheckCircle, MessageCircle, Sparkles, User } from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { buildDashboardTrend, type TrendFiling } from '@/lib/tax/trend-from-filings';
import { detectAuditRisks, type AuditRisk } from '@/lib/audit/risk-detector';
import { TaxAdvisoryPanel } from '@/components/dashboard/TaxAdvisoryPanel';
import { ClosingQuarterlyView } from '@/components/closing/ClosingQuarterlyView';

type Nationality = 'ID' | 'KR' | 'US' | 'JP';
type FilingStatus = 'completed' | 'in_progress' | 'pending';

interface Filing {
  id: string;
  tax_type: string;
  tax_period: string;
  tax_year?: number;
  status: string;
  tax_data?: Record<string, unknown>;
  created_at: string;
}

interface ProfileSnapshot {
  id: string;
  nationality: Nationality | null;
  tax_residence_country: Nationality | null;
  ptkp_status: string | null;
}

interface AssetTotals {
  cashBank: number;
  realEstate: number;
  foreign: number;
}
interface LiabilityTotals {
  bankLoan: number;
  foreign: number;
}

function classifyStatus(s: string): FilingStatus {
  if (s === 'COMPLETED' || s === 'FILED' || s === 'PAID' || s === 'ACCEPTED') return 'completed';
  if (s === 'UNDER_REVIEW' || s === 'IN_PROGRESS' || s === 'SUBMITTED' || s === 'APPROVED') return 'in_progress';
  return 'pending';
}

function dependentsFromPtkp(ptkp?: string | null): number {
  if (!ptkp) return 0;
  const m = ptkp.match(/(\d)$/);
  return m ? Number(m[1]) : 0;
}
function isJointPtkp(ptkp?: string | null): boolean {
  return !!ptkp && ptkp.startsWith('K/I/');
}

interface Props {
  customerId: string;
  customerName?: string;
}

export function PersonalDashboardV3({ customerId, customerName }: Props) {
  const t = useTranslations('personalDashV3');
  const params = useParams();
  const locale = (params?.locale as string) || 'id';

  const [loading, setLoading] = useState(true);
  const [_profile, setProfile] = useState<ProfileSnapshot | null>(null);
  // 2026-06-28: /api/customer/profile 가 함께 반환하는 completion 점수 (0..100).
  // 100 미만일 때만 상단에 LinkedIn-style 안내 배너 노출 → /my-profile 로 점프.
  const [profileCompletion, setProfileCompletion] = useState<{
    score: number;
    firstMissing: string | null;
  } | null>(null);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [_nationality, setNationality] = useState<Nationality>('KR');
  const [_taxRule, setTaxRule] = useState<Nationality>('KR');
  const [_spouseMode, setSpouseMode] = useState<'joint' | 'separate'>('separate');
  const [_dependents, setDependents] = useState(0);
  const [fundSources, setFundSources] = useState<Record<string, boolean>>({});

  // Load profile + filings
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, filingsRes] = await Promise.all([
        fetch('/api/customer/profile', { credentials: 'include' }),
        fetch(`/api/tax/filings?customerId=${customerId}&limit=30`, { credentials: 'include' }),
      ]);
      if (profRes.ok) {
        const j = await profRes.json();
        const c = j?.data?.customer;
        if (c) {
          const p: ProfileSnapshot = {
            id: c.id,
            nationality: (c.nationality as Nationality) ?? null,
            tax_residence_country: (c.tax_residence_country as Nationality) ?? null,
            ptkp_status: c.ptkp_status ?? null,
          };
          setProfile(p);
          if (p.nationality) setNationality(p.nationality);
          if (p.tax_residence_country) setTaxRule(p.tax_residence_country);
          setDependents(dependentsFromPtkp(p.ptkp_status));
          setSpouseMode(isJointPtkp(p.ptkp_status) ? 'joint' : 'separate');
        }
        const comp = j?.data?.completion;
        if (comp && typeof comp.score === 'number') {
          setProfileCompletion({ score: comp.score, firstMissing: comp.firstMissing ?? null });
        }
      }
      if (filingsRes.ok) {
        const j = await filingsRes.json();
        setFilings((j?.data as Filing[]) || (j?.filings as Filing[]) || []);
      }
      // Hydrate funding-source selection for the most recent snapshot year.
      try {
        const fsRes = await fetch('/api/customer/funding-source', { credentials: 'include' });
        if (fsRes.ok) {
          const j = await fsRes.json();
          const latest = (j?.data || [])[0];
          const sources = (latest?.sources || []) as string[];
          const UI_KEY: Record<string, string> = {
            SALARY: 'salary', BUSINESS: 'business', INVESTMENT: 'investment',
            LOAN: 'loan', INHERITANCE: 'gift', OTHER: 'other',
          };
          const map: Record<string, boolean> = {};
          for (const s of sources) {
            const k = UI_KEY[s];
            if (k) map[k] = true;
          }
          setFundSources(map);
        }
      } catch { /* non-fatal */ }
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  // Last 3 years of SPT_TAHUNAN filings indexed by year
  const recentFilings = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const years = [thisYear, thisYear - 1, thisYear - 2];
    const byYear = new Map<number, Filing>();
    filings
      .filter((f) => f.tax_type === 'SPT_TAHUNAN')
      .forEach((f) => {
        const y = Number(f.tax_period) || f.tax_year || NaN;
        if (!isNaN(y) && !byYear.has(y)) byYear.set(y, f);
      });
    return years.map((y) => ({ year: y, filing: byYear.get(y) || null }));
  }, [filings]);

  // Build the real trend from historical SPT_TAHUNAN filings.
  const trend = useMemo(
    () => buildDashboardTrend(filings as TrendFiling[]),
    [filings],
  );

  // Latest filing's harta/utang snapshot powers the two summary cards.
  const latestYear = useMemo(() => {
    const ys = [...trend.hartaByYear.keys()].sort((a, b) => b - a);
    return ys[0] ?? null;
  }, [trend.hartaByYear]);

  const assetTotals: AssetTotals = useMemo(() => {
    const h = latestYear ? trend.hartaByYear.get(latestYear) : undefined;
    if (!h) return { cashBank: 0, realEstate: 0, foreign: 0 };
    return {
      cashBank: h.cashBank,
      realEstate: h.realEstate,
      foreign: h.foreignCash + h.foreignRealEstate + h.foreignStocks,
    };
  }, [latestYear, trend.hartaByYear]);

  const liabilityTotals: LiabilityTotals = useMemo(() => {
    const u = latestYear ? trend.utangByYear.get(latestYear) : undefined;
    if (!u) return { bankLoan: 0, foreign: 0 };
    return { bankLoan: u.bankLoan, foreign: u.foreignLoan };
  }, [latestYear, trend.utangByYear]);

  // Year-series points come straight from the helper. When the customer
  // has never filed (hasRealData=false) the helper returns all zeros —
  // keep an illustrative fallback so the chart isn't an empty axis.
  const SAMPLE_ASSETS = trend.years.map((y, i) => ({
    year: String(y),
    building: 140 + i * 15,
    vehicle: 40 + i * 20,
    stocks: 25 + i * 30,
    land: 170 + i * 10,
    cash: 10 + i * 1,
  }));
  const SAMPLE_LIABILITIES = trend.years.map((y, i) => ({
    year: String(y), loan: 420 - i * 30, credit: 50 + i * 3,
  }));
  const SAMPLE_FOREIGN_ASSETS = trend.years.map((y, i) => ({
    year: String(y),
    property: i === 0 ? 0 : 10 + i * 15,
    stocks: i === 0 ? 0 : 20 + i * 22,
    cash: i === 0 ? 0 : 15 + i * 20,
  }));
  const SAMPLE_FOREIGN_LIABILITIES = trend.years.map((y, i) => ({
    year: String(y), loan: i === 0 ? 0 : 20 + i * 20,
  }));

  const domesticAssetSeries = trend.hasRealData ? trend.domesticAssets : SAMPLE_ASSETS;
  const domesticLiabilitySeries = trend.hasRealData ? trend.domesticLiabilities : SAMPLE_LIABILITIES;
  const foreignAssetSeries = trend.hasRealData ? trend.foreignAssets : SAMPLE_FOREIGN_ASSETS;
  const foreignLiabilitySeries = trend.hasRealData ? trend.foreignLiabilities : SAMPLE_FOREIGN_LIABILITIES;
  const isSampleData = !trend.hasRealData;

  // Anomaly detection — real growth deltas when we have 2+ years of data
  const assetGrowthPct = trend.assetGrowthPct ?? (isSampleData ? 20 : 0);
  const incomeGrowthPct = trend.incomeGrowthPct ?? (isSampleData ? 11 : 0);
  const anomalyTriggered = isSampleData
    ? true
    : trend.assetGrowthPct !== null &&
      trend.incomeGrowthPct !== null &&
      assetGrowthPct - incomeGrowthPct >= 5;

  // Multi-rule AI risk detection — lifestyle mismatch, asset drop, income
  // dip, foreign assets, debt > asset. Sample data returns the baseline
  // placeholder only; we filter that out so the card stays empty when
  // there is nothing real to say.
  const detectedRisks: AuditRisk[] = useMemo(() => {
    if (isSampleData) return [];
    const { risks } = detectAuditRisks(trend, 'general');
    return risks.filter((r) => r.id !== 'baseline');
  }, [trend, isSampleData]);

  const toggleFundSource = (k: string) => {
    setFundSources((s) => {
      const next = { ...s, [k]: !s[k] };
      // Persist to the customer_funding_source table (upsert by year).
      const API_KEY: Record<string, string> = {
        salary: 'SALARY', business: 'BUSINESS', investment: 'INVESTMENT',
        loan: 'LOAN', gift: 'INHERITANCE', other: 'OTHER',
      };
      const sources = Object.entries(next)
        .filter(([, v]) => v)
        .map(([key]) => API_KEY[key])
        .filter(Boolean);
      const year = new Date().getFullYear();
      fetch('/api/customer/funding-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ snapshot_year: year, sources }),
      }).catch(() => { /* non-fatal */ });
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 0. 2026-06-28: 프로필 완성도 배너 — INDIVIDUAL 도 회사와 동일한 폭의 안내.
          /api/customer/profile 의 completion.score 기준, 100 미만일 때만 노출. */}
      {profileCompletion && profileCompletion.score < 100 && (() => {
        const score = profileCompletion.score;
        const isReady = score >= 80;
        const gradient = isReady
          ? 'from-emerald-50 via-teal-50 to-cyan-50 border-emerald-200'
          : score >= 50
          ? 'from-amber-50 via-orange-50 to-yellow-50 border-amber-200'
          : 'from-red-50 via-rose-50 to-pink-50 border-red-200';
        const progressColor = isReady ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
        const ringColor = isReady ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
        const MISSING_LABEL: Record<string, string> = {
          name: t('missingName'),
          id: t('missingId'),
          email: t('missingEmail'),
          phone: t('missingPhone'),
          taxCredentials: t('missingTaxCredentials'),
        };
        const missingLabel = profileCompletion.firstMissing
          ? MISSING_LABEL[profileCompletion.firstMissing] ?? t('missingOther')
          : null;
        return (
          <div className={`p-5 rounded-2xl border-2 bg-gradient-to-br ${gradient}`}>
            <div className="flex items-start gap-4">
              <div className="relative h-14 w-14 flex-shrink-0 flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                  <circle cx="28" cy="28" r="24" fill="none"
                    stroke={ringColor}
                    strokeWidth="5"
                    strokeDasharray={`${(score / 100) * 150.8} 150.8`}
                    strokeLinecap="round"
                    className="transition-all duration-700" />
                </svg>
                <span className="text-sm font-bold text-gray-800">{score}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-bold text-sm text-gray-900 flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {isReady ? t('profileAlmostDone') : t('profileCompleteMe')}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {isReady
                        ? t('profileReadyDesc')
                        : t('profileNotReadyDesc')}
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/my-profile`}
                    className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors ${
                      isReady ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {t('profileCta')}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="h-2 bg-white/70 rounded-full overflow-hidden mt-3">
                  <div className={`h-full ${progressColor} transition-all duration-700 ease-out`} style={{ width: `${score}%` }} />
                </div>
                {missingLabel && (
                  <div className="mt-3">
                    <Link
                      href={`/${locale}/my-profile`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 hover:bg-white border border-gray-200 rounded-full text-[11px] font-medium text-gray-700"
                    >
                      <span className="text-indigo-700 font-bold">+20%</span>
                      {missingLabel}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 1. Header (keynote v2: 국적/세법기준 필터 삭제) */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('headerTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('headerSubtitle')}</p>
      </div>

      {/* 2. Recent 3-year filings */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <p className="font-semibold text-gray-900 mb-3">{t('recentFilings')}</p>
          <ul className="divide-y">
            {recentFilings.map(({ year, filing }) => {
              const status: FilingStatus = filing ? classifyStatus(filing.status) : 'pending';
              return (
                <li key={year} className="flex items-center justify-between py-2 text-sm">
                  <span>{t('yearFiling', { year })}</span>
                  <Badge
                    className={
                      status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : status === 'in_progress'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }
                  >
                    {t(
                      status === 'completed'
                        ? 'statusCompleted'
                        : status === 'in_progress'
                        ? 'statusInProgress'
                        : 'statusPending',
                    )}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* keynote v2: 배우자 신고방식 카드 삭제 — 이 정보는 SPT 시작 시
          배우자 정보 카드와 /my-profile 결혼상태에서 수집한다. */}

      {/* Sample data notice */}
      {isSampleData && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {t('sampleDataNotice')}
        </div>
      )}

      {/* Quarterly tax payment trend (PPh21 + PPh23 + PPh25 + PPN + PPh Final).
          Reuses the closing-trend Quarterly view so INDIVIDUAL customers
          get the same YoY comparison + by-tax-type breakdown the corporate
          /tax/annual page already exposes. */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <ClosingQuarterlyView />
        </CardContent>
      </Card>

      {/* 4. Assets / Liabilities summary */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-2">
            <p className="font-semibold text-gray-900 mb-2">{t('assetsTitle')}</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{t('cashBank')}</span>
              <span className="font-mono">{fmtRp(assetTotals.cashBank)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{t('realEstate')}</span>
              <span className="font-mono">{fmtRp(assetTotals.realEstate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-600">{t('foreignAssets')}</span>
              <span className="font-mono text-blue-600">{fmtRp(assetTotals.foreign)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-2">
            <p className="font-semibold text-gray-900 mb-2">{t('liabilitiesTitle')}</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{t('bankLoan')}</span>
              <span className="font-mono">{fmtRp(liabilityTotals.bankLoan)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-600">{t('foreignLiabilities')}</span>
              <span className="font-mono text-red-600">{fmtRp(liabilityTotals.foreign)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5-6. Domestic asset + liability trend */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="font-semibold text-gray-900 mb-3">{t('domesticAssetTrend')}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domesticAssetSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="year" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.10)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="building" name={t('serBuilding')} fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="vehicle" name={t('serVehicle')} fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="stocks" name={t('serStocks')} fill="#dc2626" radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="land" name={t('serLand')} fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="cash" name={t('serCash')} fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="font-semibold text-gray-900 mb-3">{t('domesticLiabilityTrend')}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domesticLiabilitySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="year" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.10)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="loan" name={t('serLoan')} fill="#991b1b" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="credit" name={t('serCredit')} fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-8. Foreign asset + liability trend */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="font-semibold text-gray-900 mb-3">{t('foreignAssetTrend')}</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={foreignAssetSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="year" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.10)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="property" name={t('serForeignRealEstate')} fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="stocks" name={t('serForeignStocks')} fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="cash" name={t('serForeignCash')} fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="font-semibold text-gray-900 mb-3">{t('foreignLiabilityTrend')}</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={foreignLiabilitySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="year" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.10)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="loan" name={t('serForeignLoan')} fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 9a. AI 위험 감지 — 다중 규칙 기반
          lifestyle mismatch / asset drop / income dip / foreign assets /
          debt-exceeds-asset. 샘플 데이터일 때는 기존 단일 anomaly 메시지로
          대체 표시 (실제 데이터 없을 때는 경고 대신 "실데이터 필요" 톤 유지). */}
      {/* 샘플 데이터(신규 고객, 실 신고 0건)일 때는 이상 감지·자금출처·AI
          코멘트 카드를 숨긴다 — 실제 값이 아닌 데모 수치로 "세무 검토 필요"
          같은 경고를 신규 고객에게 보여주지 않기 위함. 감사위험 카드가 이미
          같은 방식(sample → 빈 배열)으로 동작하므로 일관성도 맞춘다. */}
      {!isSampleData && (detectedRisks.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t('riskDetectionTitle')}
          </p>
          <p className="text-xs text-red-700 mt-1">
            {t('riskDetectionSubtitle', { count: detectedRisks.length })}
          </p>
          <ul className="mt-3 space-y-2">
            {detectedRisks.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-red-100 bg-white p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={
                      'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
                      (r.severity === 'high'
                        ? 'bg-red-100 text-red-800'
                        : r.severity === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700')
                    }
                  >
                    {t(`riskSeverity_${r.severity}`)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-700 mt-0.5">{r.detail}</p>
                    {r.regulation && (
                      <p className="text-[11px] text-gray-500 mt-1">
                        <span className="font-medium">{t('regulationLabel')}</span> {r.regulation}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : anomalyTriggered ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t('anomalyTitle')}
          </p>
          <p className="text-sm text-red-700 mt-1">
            {t('anomalyBody', { assetPct: assetGrowthPct, incomePct: incomeGrowthPct })}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('riskDetectionClear')}
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            {t('riskDetectionClearBody')}
          </p>
        </div>
      ))}

      {/* 9b. Fund source checklist */}
      {!isSampleData && (
      <div className="rounded-xl border border-blue-200 bg-white p-4">
        <p className="font-semibold text-blue-800 flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          {t('fundSourceTitle')}
        </p>
        <p className="text-sm text-gray-700 mt-1">{t('fundSourceHint')}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700">
          {[
            { key: 'salary', label: 'fsSalary' },
            { key: 'business', label: 'fsBusiness' },
            { key: 'investment', label: 'fsInvestment' },
            { key: 'loan', label: 'fsLoan' },
            { key: 'gift', label: 'fsGift' },
            { key: 'other', label: 'fsOther' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!fundSources[key]}
                onChange={() => toggleFundSource(key)}
              />
              {t(label)}
            </label>
          ))}
        </div>
      </div>
      )}

      {/* 10a. AI comment */}
      {!isSampleData && (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-2">
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            {t('aiCommentTitle')}
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>
              <span className="font-semibold">{t('aiAssetGrowth', { pct: assetGrowthPct })}</span>
            </li>
            <li>
              <span className="font-semibold">{t('aiIncomeGrowth', { pct: incomeGrowthPct })}</span>
            </li>
            {anomalyTriggered && (
              <li className="text-red-600 font-medium">{t('aiReviewNeeded')}</li>
            )}
            <li>{t('aiForeignNote')}</li>
          </ul>
        </CardContent>
      </Card>
      )}

      {/* AI Tax Advisory — only renders cards with actual signal for individuals */}
      <TaxAdvisoryPanel />

      {/* 10b. CTAs — keynote 2026-04-25: 진행현황보기 버튼 제거, 시작 버튼만 */}
      <div className="flex gap-3">
        <Button asChild className="bg-gray-800 hover:bg-gray-900 text-white">
          <Link href={`/${locale}/tax/spt-tahunan`}>{t('startFilingCta')}</Link>
        </Button>
      </div>

      {customerName && <span className="sr-only">{customerName}</span>}
    </div>
  );
}
