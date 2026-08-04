'use client';

/**
 * ID Billing 발행 보드 (v19 상담원 백오피스 §4).
 *
 * 좌측: 발행대상 — 수퍼바이저 승인완료 건만, 회사별 카드 (세금별 항목:
 *       기간/KAP·KJS/Tax Base/세율/세액). 작성본 다운로드 후에만 발행 가능
 *       (게이트는 서버가 강제 — 버튼 상태는 서버 canIssue 반영).
 * 우측: 발행완료 — 일련번호 리스트. 수동 완료처리 없음. NTPN 은 납부 후
 *       Coretax 자동생성 badge 로 표기.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Download, ExternalLink, Loader2, Mail, ReceiptText, RefreshCw, Send,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

const CORETAX_URL = 'https://coretaxdjp.pajak.go.id/';

interface BillingItem {
  taxType: string; period: string; kap: string; kjs: string;
  taxBase: number | null; rateLabel: string; amount: number;
}
interface BillingTarget {
  sourceKind: 'ERP_SESSION' | 'OPERATOR_QUEUE';
  sourceId: string;
  customer: { id: string; name: string; npwp: string | null; email: string | null };
  items: BillingItem[];
  totalAmount: number;
  workbookGeneratedAt: string | null;
  canIssue: boolean;
}
interface IssuedRow {
  id: string; serial_no: string; customer_name: string; tax_type: string;
  tax_period: string; amount: number; billing_code: string | null;
  status: string; customer_email: string | null; sent_at: string | null;
  ntpn: string | null; paid_at: string | null; created_at: string;
}

export default function IdBillingBoard() {
  const t = useTranslations('idBilling');
  const [targets, setTargets] = useState<BillingTarget[]>([]);
  const [issued, setIssued] = useState<IssuedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/id-billing/board');
      const json = await res.json();
      if (json.success) {
        setTargets(json.data.targets ?? []);
        setIssued(json.data.issued ?? []);
      } else {
        showMsg('err', json.error || 'load failed');
      }
    } catch {
      showMsg('err', t('networkError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const downloadWorkbook = async (target?: BillingTarget) => {
    const key = target ? `wb-${target.sourceId}` : 'wb-all';
    setBusy(key);
    try {
      const res = await fetch('/api/id-billing/workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target ? { targets: [{ sourceKind: target.sourceKind, sourceId: target.sourceId }] } : {}),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showMsg('err', json.error || `HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      a.download = m ? decodeURIComponent(m[1]) : 'coretax-id-billing.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showMsg('ok', t('workbookDownloaded'));
      load(); // canIssue 갱신
    } catch {
      showMsg('err', t('networkError'));
    } finally {
      setBusy(null);
    }
  };

  const issue = async (target: BillingTarget) => {
    setBusy(`issue-${target.sourceId}`);
    try {
      const email = emailEdit[target.sourceId] ?? target.customer.email ?? undefined;
      const res = await fetch('/api/id-billing/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKind: target.sourceKind,
          sourceId: target.sourceId,
          ...(email ? { customerEmail: email } : {}),
        }),
      });
      const json = await res.json();
      if (json.success) {
        showMsg('ok', t('issued', { name: target.customer.name }));
        load();
      } else {
        showMsg('err', json.error || `HTTP ${res.status}`);
      }
    } catch {
      showMsg('err', t('networkError'));
    } finally {
      setBusy(null);
    }
  };

  const send = async (row: IssuedRow) => {
    setBusy(`send-${row.id}`);
    try {
      const res = await fetch('/api/id-billing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuanceIds: [row.id] }),
      });
      const json = await res.json();
      if (json.success && json.data.sent > 0) {
        showMsg('ok', t('sentOk'));
      } else {
        const reason = json.data?.skipped?.[0]?.reason;
        showMsg('err', reason === 'no-email' ? t('noEmail') : (json.error || t('sendFailed')));
      }
      load();
    } catch {
      showMsg('err', t('networkError'));
    } finally {
      setBusy(null);
    }
  };

  // Coretax API 보류 (2026-08-04): 운영자가 Coretax 에서 납부 확인 후 NTPN 을
  // 직접 입력해 PAID + (큐 소스면) COMPLETED 로 마감한다.
  const markPaid = async (row: IssuedRow) => {
    const ntpn = window.prompt(t('promptNtpn', { serial: row.serial_no }))?.trim();
    if (!ntpn) return;
    if (ntpn.length < 8) { showMsg('err', t('invalidNtpn')); return; }
    setBusy(`paid-${row.id}`);
    try {
      const res = await fetch('/api/id-billing/paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuanceId: row.id, ntpn }),
      });
      const json = await res.json();
      if (json.success) showMsg('ok', t('paidOk'));
      else showMsg('err', json.error || t('networkError'));
      load();
    } catch {
      showMsg('err', t('networkError'));
    } finally {
      setBusy(null);
    }
  };

  const readyCount = targets.filter(x => x.canIssue).length;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold text-gray-900 flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-indigo-600" />
          {t('pageTitle')}
        </h1>
        <p className="mt-1 text-[13px] text-gray-500">{t('pageDesc')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-violet-100 text-violet-700">{t('targetCount', { count: targets.length })}</Badge>
          <Badge className="bg-emerald-100 text-emerald-700">{t('readyCount', { count: readyCount })}</Badge>
          <Badge className="bg-blue-100 text-blue-700">{t('issuedCount', { count: issued.length })}</Badge>
          <Button variant="outline" size="sm" className="ml-auto h-8" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {message && (
        <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${message.type === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Coretax 작성본 안내 */}
      <div className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
        <p className="text-sm font-semibold text-cyan-900">{t('workbookBoxTitle')}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-cyan-800">{t('workbookBoxDesc')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="h-8 bg-cyan-700 text-white hover:bg-cyan-800"
            disabled={targets.length === 0 || busy === 'wb-all'}
            onClick={() => downloadWorkbook()}>
            {busy === 'wb-all' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
            {t('downloadAll')}
          </Button>
          <a href={CORETAX_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-cyan-300 bg-white px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100">
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            {t('openCoretax')}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ── 발행대상: 회사별 카드 ── */}
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-bold text-gray-900">{t('targetsTitle')}</h2>
            <Badge className="bg-violet-100 text-violet-700">{t('companiesUnit', { count: targets.length })}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
            {loading ? (
              <div className="col-span-full py-14 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" /></div>
            ) : targets.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-gray-200 py-14 text-center text-sm text-gray-400">
                {t('noTargets')}
              </div>
            ) : targets.map(target => (
              <div key={target.sourceId} className="rounded-xl border border-gray-200 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-gray-900">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      {target.customer.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {target.customer.npwp ?? '—'}
                      <span className="mx-1 text-gray-300">·</span>
                      {target.sourceKind === 'ERP_SESSION' ? t('sourceErp') : t('sourceQueue')}
                    </p>
                  </div>
                  <Badge className={target.canIssue ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                    {target.canIssue ? t('statusReady') : t('statusNeedsWorkbook')}
                  </Badge>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                  <input
                    className="h-7 w-full rounded-md border border-gray-200 px-2 text-[11px] outline-none focus:border-blue-300"
                    placeholder={t('emailPlaceholder')}
                    value={emailEdit[target.sourceId] ?? target.customer.email ?? ''}
                    onChange={e => setEmailEdit(prev => ({ ...prev, [target.sourceId]: e.target.value }))}
                  />
                </div>

                <div className="mt-2 space-y-1.5">
                  {target.items.map((item, i) => (
                    <div key={i} className="rounded-lg bg-gray-50 px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-800">{item.taxType}</span>
                        <Badge className="bg-blue-100 text-[10px] text-blue-700">{item.kap}-{item.kjs}</Badge>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-2 text-[11px] text-gray-500">
                        <span>{t('itemPeriod')} {item.period}</span>
                        <span>{t('itemRate')} {item.rateLabel}</span>
                        <span>{t('itemBase')} {item.taxBase != null ? fmtRp(item.taxBase) : '—'}</span>
                        <span className="font-semibold text-gray-700">{t('itemAmount')} {fmtRp(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500">{t('total')} {fmtRp(target.totalAmount)}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                      disabled={busy === `wb-${target.sourceId}`}
                      onClick={() => downloadWorkbook(target)}>
                      {busy === `wb-${target.sourceId}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                      {t('downloadWorkbook')}
                    </Button>
                    <Button size="sm" className="h-7 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700 disabled:opacity-45"
                      disabled={!target.canIssue || busy === `issue-${target.sourceId}`}
                      onClick={() => issue(target)}>
                      {busy === `issue-${target.sourceId}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      {t('issueBtn')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 발행완료: 일련번호 리스트 ── */}
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-bold text-gray-900">{t('issuedTitle')}</h2>
            <Badge className="bg-emerald-100 text-emerald-700">{t('rowsUnit', { count: issued.length })}</Badge>
          </div>
          <div className="overflow-auto p-4">
            <table className="min-w-[760px] w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="px-2 py-2">No.</th>
                  <th className="px-2 py-2">{t('colCompany')}</th>
                  <th className="px-2 py-2">{t('colTax')}</th>
                  <th className="px-2 py-2">{t('colPeriod')}</th>
                  <th className="px-2 py-2 text-right">{t('colAmount')}</th>
                  <th className="px-2 py-2">{t('colSend')}</th>
                  <th className="px-2 py-2">{t('colNtpn')}</th>
                </tr>
              </thead>
              <tbody>
                {issued.length === 0 ? (
                  <tr><td colSpan={7} className="px-2 py-10 text-center text-gray-400">{t('noIssued')}</td></tr>
                ) : issued.map((row, idx) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-2 py-2.5 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-2.5">
                      <p className="font-semibold text-gray-800">{row.customer_name}</p>
                      <p className="font-mono text-[10px] text-gray-400">{row.serial_no}</p>
                    </td>
                    <td className="px-2 py-2.5">{row.tax_type}</td>
                    <td className="px-2 py-2.5">{row.tax_period}</td>
                    <td className="px-2 py-2.5 text-right font-medium">{fmtRp(row.amount)}</td>
                    <td className="px-2 py-2.5">
                      {row.status === 'SENT' ? (
                        <Badge className="bg-emerald-100 text-emerald-700">{t('sentBadge')}</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                          disabled={busy === `send-${row.id}`}
                          onClick={() => send(row)}>
                          {busy === `send-${row.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="mr-1 h-2.5 w-2.5" />}
                          {t('sendBtn')}
                        </Button>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {row.status === 'PAID' ? (
                        <div>
                          <Badge className="bg-emerald-100 text-[10px] text-emerald-700">{t('paidBadge')}</Badge>
                          {row.ntpn && <p className="mt-1 font-mono text-[10px] text-gray-500">{row.ntpn}</p>}
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                          disabled={busy === `paid-${row.id}`}
                          onClick={() => markPaid(row)}>
                          {busy === `paid-${row.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : t('markPaidBtn')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-gray-400">{t('issuedFootnote')}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
