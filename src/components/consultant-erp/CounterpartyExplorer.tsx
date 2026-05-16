'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Plus, ShieldCheck, AlertTriangle } from 'lucide-react';

interface SearchHit {
  id: string;
  name: string;
  npwp: string | null;
  country: string;
  kbli: string | null;
  suggested_pph_type: string | null;
  suggested_tax_rate: number | null;
  overall_trust: number;
}

interface Detail {
  master: SearchHit & {
    nib: string | null;
    pkp_status: string | null;
    business_description: string | null;
    aliases: string[] | null;
    evidence_sources: Record<string, unknown> | null;
    last_verified_at: string | null;
  };
  trust: Array<{
    field_name: string;
    field_value: string | null;
    trust_score: number;
    source: string | null;
  }>;
  candidates: Array<{
    id: string;
    proposed_payload: Record<string, unknown>;
    status: string;
    proposed_at: string;
  }>;
}

const TRUST_TONE = (n: number) =>
  n >= 80 ? 'bg-emerald-100 text-emerald-700'
  : n >= 60 ? 'bg-blue-100 text-blue-700'
  : n >= 40 ? 'bg-amber-100 text-amber-800'
  : 'bg-rose-100 text-rose-700';

export function CounterpartyExplorer() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create-form state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    npwp: '',
    country: 'ID',
    kbli: '',
    suggestedPph: '',
    suggestedRate: '',
  });

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/consultant-erp/counterparty', window.location.origin);
      if (q) url.searchParams.set('q', q);
      const r = await fetch(url.toString());
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'search failed');
      setHits(j.data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { void search(); }, [search]);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/consultant-erp/counterparty/${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'detail failed');
      setDetail(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const create = async () => {
    if (!form.name) return;
    setLoading(true);
    try {
      const r = await fetch('/api/consultant-erp/counterparty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          npwp: form.npwp || null,
          country: form.country,
          kbli: form.kbli || null,
          suggestedPph: form.suggestedPph || null,
          suggestedRate: form.suggestedRate ? Number(form.suggestedRate) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'create failed');
      setSelectedId(j.data.id);
      setForm({ name: '', npwp: '', country: 'ID', kbli: '', suggestedPph: '', suggestedRate: '' });
      setShowCreate(false);
      await search();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: hits.length,
    averageTrust: hits.length
      ? Math.round(hits.reduce((s, h) => s + (h.overall_trust ?? 0), 0) / hits.length)
      : 0,
    pendingCandidates: 0,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">
            Counterparty Master
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-black">{stats.total}</p>
              <p className="text-[10px] text-slate-400">검색결과</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-300">{stats.averageTrust}</p>
              <p className="text-[10px] text-slate-400">평균 신뢰도</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="회사명, NPWP, NIB, KBLI 검색"
                onKeyDown={(e) => e.key === 'Enter' && search()}
              />
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="h-3 w-3 mr-1" /> {showCreate ? '신규 등록 닫기' : '신규 거래처 등록'}
            </Button>

            {showCreate && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="회사명 *" />
                <Input value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} placeholder="NPWP (옵션)" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="국가" />
                  <Input value={form.kbli} onChange={(e) => setForm({ ...form, kbli: e.target.value })} placeholder="KBLI" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={form.suggestedPph} onChange={(e) => setForm({ ...form, suggestedPph: e.target.value })} placeholder="추천 PPh" />
                  <Input value={form.suggestedRate} onChange={(e) => setForm({ ...form, suggestedRate: e.target.value })} placeholder="세율 (예: 0.02)" />
                </div>
                <Button size="sm" className="w-full" onClick={create} disabled={!form.name || loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '등록'}
                </Button>
              </div>
            )}

            <ul className="max-h-[60vh] overflow-y-auto space-y-1">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => setSelectedId(h.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition ${
                      selectedId === h.id ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{h.name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${TRUST_TONE(h.overall_trust)}`}>
                        {h.overall_trust}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {h.npwp ?? '—'} · {h.kbli ?? 'KBLI?'} · {h.country}
                    </p>
                  </button>
                </li>
              ))}
              {hits.length === 0 && !loading && (
                <li className="text-xs text-slate-500 px-2 py-4 text-center">검색 결과가 없습니다.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div>
        {!detail && (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500">
              좌측에서 거래처를 선택하거나 신규 등록하세요.
            </CardContent>
          </Card>
        )}
        {detail && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-black text-slate-950">{detail.master.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {detail.master.npwp ?? 'NPWP 없음'} · {detail.master.country}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${TRUST_TONE(detail.master.overall_trust)}`}>
                  Trust {detail.master.overall_trust}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <KeyVal label="PKP" value={detail.master.pkp_status ?? '확인필요'} />
                <KeyVal label="KBLI" value={detail.master.kbli ?? '—'} />
                <KeyVal label="추천 PPh" value={detail.master.suggested_pph_type ?? '—'} />
                <KeyVal
                  label="추천 세율"
                  value={
                    detail.master.suggested_tax_rate !== null
                      ? `${(Number(detail.master.suggested_tax_rate) * 100).toFixed(2)}%`
                      : '—'
                  }
                />
                <KeyVal
                  label="Last Verified"
                  value={detail.master.last_verified_at ? new Date(detail.master.last_verified_at).toLocaleString('ko-KR') : '—'}
                />
                <KeyVal label="NIB" value={detail.master.nib ?? '—'} />
              </div>

              {detail.master.business_description && (
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-black text-slate-900 mb-1">업종 설명</p>
                  {detail.master.business_description}
                </div>
              )}

              <div>
                <p className="text-xs font-black text-slate-900 mb-2">필드별 신뢰도</p>
                {detail.trust.length === 0 ? (
                  <p className="text-xs text-slate-500">필드별 출처 기록이 아직 없습니다.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-1">필드</th>
                        <th className="py-1">값</th>
                        <th className="py-1">출처</th>
                        <th className="py-1 text-right">Trust</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.trust.map((t, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5 font-bold text-slate-900">{t.field_name}</td>
                          <td className="py-1.5 text-slate-700">{t.field_value ?? '—'}</td>
                          <td className="py-1.5 text-slate-500">{t.source ?? '—'}</td>
                          <td className="py-1.5 text-right">
                            <span className={`rounded-full px-2 py-0.5 font-black ${TRUST_TONE(t.trust_score)}`}>
                              {t.trust_score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {detail.candidates.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-900 mb-2">업데이트 후보</p>
                  <ul className="space-y-2">
                    {detail.candidates.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-xl border border-slate-200 p-2 text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{c.status}</p>
                          <p className="text-slate-500">
                            {new Date(c.proposed_at).toLocaleString('ko-KR')}
                          </p>
                          <pre className="mt-1 text-[10px] text-slate-600 bg-slate-50 rounded px-2 py-1 max-w-md overflow-x-auto">
                            {JSON.stringify(c.proposed_payload, null, 0)}
                          </pre>
                        </div>
                        {c.status === 'PROPOSED' && (
                          <span className="flex items-center text-amber-600 text-[10px] font-black">
                            <AlertTriangle className="h-3 w-3 mr-0.5" /> 검토 대기
                          </span>
                        )}
                        {c.status === 'APPROVED' && (
                          <span className="flex items-center text-emerald-600 text-[10px] font-black">
                            <ShieldCheck className="h-3 w-3 mr-0.5" /> 반영됨
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900 truncate">{value}</p>
    </div>
  );
}
