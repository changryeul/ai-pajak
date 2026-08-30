'use client';

/**
 * /admin/master/required-fields — MASTER 가 고객 데이터 "필수항목"을 선택/추가/삭제.
 * 고객 폼(회사/개인 프로필, 원천세·부가세·급여)은 이 설정을 읽어 별표(*) + 빈 값 입력유도.
 * RBAC: 진입 role guard(MASTER) + 서버 이중 게이트. (2026-08-30)
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { ArrowLeft, Plus, Trash2, Loader2, Asterisk } from 'lucide-react';

interface Row { id: string; form_key: string; field_key: string; label: string; is_required: boolean; sort_order: number }

const FORM_LABELS: Record<string, string> = {
  company_profile: '회사 프로필', my_profile: '개인 프로필',
  pph23: '원천세 (PPh23)', ppn: '부가세 (PPN)', payslip: '급여명세 (PPh21)',
};
const FORM_ORDER = ['company_profile', 'my_profile', 'pph23', 'ppn', 'payslip'];

export default function RequiredFieldsPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [newKey, setNewKey] = useState(''); const [newLabel, setNewLabel] = useState('');
  const isMaster = hasRole(session, UserRole.TAX_OPERATOR_MASTER);

  useEffect(() => {
    if (sessionLoading || !session) return;
    if (!isMaster) router.replace(`/${locale}/dashboard`);
  }, [session, sessionLoading, isMaster, router, locale]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/master/required-fields');
      const j = await r.json();
      if (Array.isArray(j.data)) setRows(j.data as Row[]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const toggle = async (row: Row) => {
    setBusy(row.id);
    try {
      await fetch(`/api/admin/master/required-fields?id=${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRequired: !row.is_required }),
      });
      await reload();
    } finally { setBusy(null); }
  };
  const remove = async (row: Row) => {
    if (!window.confirm(`'${row.label}' 항목을 삭제할까요?`)) return;
    setBusy(row.id);
    try {
      await fetch(`/api/admin/master/required-fields?id=${row.id}`, { method: 'DELETE' });
      await reload();
    } finally { setBusy(null); }
  };
  const add = async (formKey: string) => {
    if (!newKey.trim() || !newLabel.trim()) return;
    setBusy('add');
    try {
      const r = await fetch('/api/admin/master/required-fields', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formKey, fieldKey: newKey.trim(), label: newLabel.trim(), isRequired: true }),
      });
      const j = await r.json();
      if (!r.ok) { window.alert(typeof j.error === 'string' ? j.error : '추가 실패'); return; }
      setNewKey(''); setNewLabel(''); setAddFor(null); await reload();
    } finally { setBusy(null); }
  };

  if (sessionLoading || !isMaster) return null;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link href={`/${locale}/admin/master`} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="h-4 w-4" />Master</Link>
      <div className="mb-1 flex items-center gap-2"><Asterisk className="h-5 w-5 text-red-500" /><h1 className="text-xl font-bold">필수항목 관리</h1></div>
      <p className="mb-5 text-sm text-gray-500">고객 데이터 폼별 필수항목을 선택(on/off)·추가·삭제합니다. 필수(★)로 켜진 항목은 고객 화면에 별표로 표시되고, 비어 있으면 입력을 유도합니다.</p>

      {loading ? <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중…</div> : (
        <div className="space-y-5">
          {FORM_ORDER.map(formKey => {
            const fields = rows.filter(r => r.form_key === formKey);
            return (
              <div key={formKey} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h2 className="font-semibold text-gray-900">{FORM_LABELS[formKey] ?? formKey}</h2>
                  <button className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    onClick={() => { setAddFor(addFor === formKey ? null : formKey); setNewKey(''); setNewLabel(''); }}>
                    <Plus className="h-3 w-3" />항목 추가
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {fields.map(row => (
                    <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                      <button disabled={busy === row.id} onClick={() => toggle(row)}
                        className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${row.is_required ? 'bg-red-500' : 'bg-gray-300'}`} title="필수 여부">
                        <span className={`ml-0.5 h-5 w-5 rounded-full bg-white transition-transform ${row.is_required ? 'translate-x-5' : ''}`} />
                      </button>
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{row.label}</span>
                        {row.is_required && <span className="ml-1 font-bold text-red-500">*</span>}
                        <span className="ml-2 text-xs text-gray-400">{row.field_key}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.is_required ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{row.is_required ? '필수' : '선택'}</span>
                      <button disabled={busy === row.id} onClick={() => remove(row)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {fields.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">항목 없음</div>}
                  {addFor === formKey && (
                    <div className="flex items-center gap-2 bg-blue-50/40 px-4 py-3">
                      <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="field_key (영문)" className="h-8 w-40 rounded-md border border-gray-200 px-2 text-xs" />
                      <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="표시 라벨" className="h-8 flex-1 rounded-md border border-gray-200 px-2 text-xs" />
                      <button disabled={busy === 'add'} onClick={() => add(formKey)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">추가</button>
                      <button onClick={() => setAddFor(null)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs">취소</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
