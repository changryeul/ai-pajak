'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Eye, AlertTriangle, CheckCircle2, Upload, Building2 } from 'lucide-react';

type Category =
  | 'AKTA_PENDIRIAN'
  | 'AKTA_PERUBAHAN'
  | 'NIB_OSS'
  | 'LICENSE_SBU_SKK'
  | 'COMPANY_NPWP'
  | 'CORETAX_ACCESS';

interface DocRow {
  id: string;
  customer_id: string;
  category: Category;
  is_required: boolean;
  storage_path: string | null;
  original_filename: string | null;
  valid_until: string | null;
  note: string | null;
  uploaded_at: string;
  version: number;
}

interface Customer {
  id: string;
  full_name: string;
  company_name: string | null;
  npwp: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
}

const CATEGORIES: { key: Category; label: string; group: string; required: boolean }[] = [
  { key: 'AKTA_PENDIRIAN', label: '최초정관 (Akta Pendirian)', group: '정관/법인설립', required: true },
  { key: 'AKTA_PERUBAHAN', label: '수정정관 (Akta Perubahan)', group: '정관/법인설립', required: true },
  { key: 'NIB_OSS', label: 'NIB / OSS 자료', group: '사업허가', required: true },
  { key: 'LICENSE_SBU_SKK', label: '자격증 및 라이센스', group: '사업허가', required: false },
  { key: 'COMPANY_NPWP', label: '회사 NPWP', group: '세무등록', required: true },
  { key: 'CORETAX_ACCESS', label: 'Coretax 접속정보', group: '세무등록', required: false },
];

export function LegalityVault() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = customers.find((c) => c.id === customerId);

  const load = useCallback(async (cid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/consultant-erp/legality', window.location.origin);
      if (cid) url.searchParams.set('customerId', cid);
      const r = await fetch(url.toString());
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'failed');
      setCustomers(j.data.customers ?? []);
      setDocs(j.data.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (customerId) void load(customerId);
  }, [customerId, load]);

  const upload = async (category: Category, file: File) => {
    if (!customerId) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('customerId', customerId);
      form.append('category', category);
      form.append('file', file);
      const r = await fetch('/api/consultant-erp/legality', { method: 'POST', body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'upload failed');
      await load(customerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const updateMeta = async (docId: string, validUntil: string | null, note: string | null) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/legality/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validUntil, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'patch failed');
      await load(customerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const preview = async (docId: string) => {
    try {
      const r = await fetch(`/api/consultant-erp/legality/${docId}/download`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'sign failed');
      window.open(j.data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  // Pick latest version per category
  const latestByCategory = useMemo(() => {
    const m = new Map<Category, DocRow>();
    for (const d of docs) {
      const prev = m.get(d.category);
      if (!prev || prev.version < d.version) m.set(d.category, d);
    }
    return m;
  }, [docs]);

  const requiredFilled = CATEGORIES.filter((c) => c.required && latestByCategory.has(c.key)).length;
  const requiredTotal = CATEGORIES.filter((c) => c.required).length;

  return (
    <div className="space-y-6">
      {/* Customer select + stats */}
      <Card>
        <CardContent className="p-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-slate-400" />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— 고객 선택 —</option>
              {customers
                .filter((c) => c.customer_type === 'COMPANY')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ?? c.full_name} {c.npwp ? `· ${c.npwp}` : ''}
                  </option>
                ))}
            </select>
          </div>
          {selected && (
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
                완성도 {Math.round((requiredFilled / requiredTotal) * 100)}%
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                필수 {requiredFilled}/{requiredTotal}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="inline h-3 w-3 mr-1" /> {error}
        </div>
      )}

      {!customerId ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            상단에서 법인 고객을 선택하면 카테고리별 보관함이 표시됩니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const d = latestByCategory.get(c.key);
            return (
              <Card key={c.key} className={d ? 'ring-1 ring-emerald-200' : ''}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        {c.group}
                      </p>
                      <p className="mt-1 font-black text-slate-950">{c.label}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        c.required ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.required ? '필수' : '선택'}
                    </span>
                  </div>

                  {d ? (
                    <div className="rounded-lg bg-slate-50 p-2 space-y-1">
                      <p className="flex items-center gap-1.5 text-xs text-slate-700">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{d.original_filename}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        v{d.version} · {new Date(d.uploaded_at).toLocaleString('ko-KR')}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="date"
                          defaultValue={d.valid_until ?? ''}
                          onBlur={(e) => updateMeta(d.id, e.target.value || null, d.note)}
                          className="h-7 text-xs"
                          disabled={busy}
                        />
                        <Button size="sm" variant="outline" onClick={() => preview(d.id)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        defaultValue={d.note ?? ''}
                        onBlur={(e) => updateMeta(d.id, d.valid_until, e.target.value || null)}
                        placeholder="보관메모"
                        className="h-7 text-xs"
                        disabled={busy}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">아직 업로드된 파일이 없습니다.</p>
                  )}

                  <label className="block">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.csv,.zip"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(c.key, f);
                        e.target.value = '';
                      }}
                      disabled={busy}
                    />
                    <span className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Upload className="inline h-3 w-3 mr-1" />
                      {d ? '추가 업로드' : '업로드'}
                    </span>
                  </label>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {loading && (
        <p className="text-xs text-slate-500">
          <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
          로딩 중…
        </p>
      )}
      {requiredFilled === requiredTotal && customerId && (
        <p className="text-sm font-bold text-emerald-700">
          <CheckCircle2 className="inline h-4 w-4 mr-1" />
          필수 자료가 모두 등록되었습니다.
        </p>
      )}
    </div>
  );
}
