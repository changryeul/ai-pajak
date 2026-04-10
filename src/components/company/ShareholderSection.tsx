'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Users, Plus, Trash2, Loader2, AlertTriangle,
  CheckCircle, X, Edit2, Building2, User,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface Shareholder {
  id: string;
  name: string;
  is_entity: boolean;
  npwp: string | null;
  nik: string | null;
  country_code: string;
  is_resident: boolean;
  shareholding_pct: number;
  capital_amount: number | null;
  share_class: string | null;
  is_beneficial_owner: boolean;
  is_voting_rights: boolean;
  is_director: boolean;
  is_commissioner: boolean;
  joined_date: string | null;
  exited_date: string | null;
  source: string;
  notes: string | null;
}

interface ShareholderSectionProps {
  customerId?: string;
}

const emptyForm = {
  name: '',
  is_entity: true,
  npwp: '',
  nik: '',
  country_code: 'ID',
  is_resident: true,
  shareholding_pct: '',
  capital_amount: '',
  share_class: '',
  is_beneficial_owner: true,
  is_voting_rights: true,
  is_director: false,
  is_commissioner: false,
  joined_date: '',
  notes: '',
};

export function ShareholderSection({ customerId }: ShareholderSectionProps) {
  const [list, setList] = useState<Shareholder[]>([]);
  const [totalPct, setTotalPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = customerId
        ? `/api/shareholders?customerId=${customerId}`
        : '/api/shareholders';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setList(data.data || []);
        setTotalPct(data.meta?.totalPct || 0);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (s: Shareholder) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      is_entity: s.is_entity,
      npwp: s.npwp || '',
      nik: s.nik || '',
      country_code: s.country_code,
      is_resident: s.is_resident,
      shareholding_pct: String(s.shareholding_pct),
      capital_amount: s.capital_amount != null ? String(s.capital_amount) : '',
      share_class: s.share_class || '',
      is_beneficial_owner: s.is_beneficial_owner,
      is_voting_rights: s.is_voting_rights,
      is_director: s.is_director,
      is_commissioner: s.is_commissioner,
      joined_date: s.joined_date || '',
      notes: s.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.shareholding_pct) {
      showMsg('error', '주주명과 지분율은 필수입니다');
      return;
    }
    const pct = Number(form.shareholding_pct);
    if (pct <= 0 || pct > 100) {
      showMsg('error', '지분율은 0~100 사이여야 합니다');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        shareholding_pct: pct,
        capital_amount: form.capital_amount ? Number(form.capital_amount) : undefined,
        ...(customerId && { customerId }),
      };

      const res = await fetch('/api/shareholders', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', editingId ? '주주 정보 수정 완료' : '주주 추가 완료');
        resetForm();
        setShowForm(false);
        load();
      } else {
        showMsg('error', data.error || '저장 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 주주를 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/shareholders?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showMsg('success', '삭제 완료');
        load();
      }
    } catch { /* */ }
  };

  const remainingPct = 100 - totalPct;
  const warnOver = totalPct > 100.01;
  const warnUnder = totalPct < 99.99 && list.length > 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              주주 관리
              <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                {list.length}명
              </Badge>
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              정관(Akta Pendirian) 기준 주주 정보. 배당 PPh 처리에 사용됩니다 (25% 임계값, UU HPP 면제 등).
            </p>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            {showForm ? '닫기' : '주주 추가'}
          </Button>
        </div>

        {/* Total % summary */}
        {list.length > 0 && (
          <div className={`p-2 rounded text-xs flex items-center justify-between ${
            warnOver ? 'bg-red-50 text-red-800' : warnUnder ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'
          }`}>
            <span className="font-medium">
              총 지분율 합계: <b>{totalPct.toFixed(2)}%</b>
              {remainingPct > 0.01 && ` · 미할당 ${remainingPct.toFixed(2)}%`}
            </span>
            {warnOver && <AlertTriangle className="h-3 w-3" />}
            {!warnOver && !warnUnder && <CheckCircle className="h-3 w-3" />}
          </div>
        )}

        {message && (
          <div className={`p-2 rounded text-xs flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {message.text}
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/50 space-y-3">
            <p className="text-xs font-bold text-purple-900">
              {editingId ? '주주 정보 수정' : '신규 주주 등록'}
            </p>

            {/* Entity / Individual toggle */}
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" checked={form.is_entity}
                  onChange={() => setForm({ ...form, is_entity: true })} />
                <Building2 className="h-3 w-3" /> 법인 주주
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" checked={!form.is_entity}
                  onChange={() => setForm({ ...form, is_entity: false })} />
                <User className="h-3 w-3" /> 개인 주주
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="md:col-span-2">
                <Label className="text-[10px]">주주명 *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={form.is_entity ? 'PT Example / Example Corp' : '홍길동 / John Doe'}
                  className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">지분율 (%) *</Label>
                <Input type="number" step="0.01" min="0" max="100"
                  value={form.shareholding_pct}
                  onChange={e => setForm({ ...form, shareholding_pct: e.target.value })}
                  placeholder="25" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[10px]">납입 자본금 (IDR)</Label>
                <Input type="number" value={form.capital_amount}
                  onChange={e => setForm({ ...form, capital_amount: e.target.value })}
                  placeholder="500000000" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[10px]">국적 (ISO 2)</Label>
                <Input value={form.country_code} maxLength={2}
                  onChange={e => setForm({ ...form, country_code: e.target.value.toUpperCase() })}
                  placeholder="ID / KR / SG" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[10px]">거주자 여부</Label>
                <select value={form.is_resident ? 'Y' : 'N'}
                  onChange={e => setForm({ ...form, is_resident: e.target.value === 'Y' })}
                  className="w-full h-8 px-2 rounded border text-xs">
                  <option value="Y">거주자</option>
                  <option value="N">비거주자</option>
                </select>
              </div>
              {form.is_entity ? (
                <div>
                  <Label className="text-[10px]">NPWP</Label>
                  <Input value={form.npwp}
                    onChange={e => setForm({ ...form, npwp: e.target.value })}
                    placeholder="XX.XXX.XXX.X-XXX.XXX" className="h-8 text-xs font-mono" />
                </div>
              ) : (
                <div>
                  <Label className="text-[10px]">NIK (KTP 번호)</Label>
                  <Input value={form.nik}
                    onChange={e => setForm({ ...form, nik: e.target.value })}
                    placeholder="16자리" className="h-8 text-xs font-mono" />
                </div>
              )}
              <div>
                <Label className="text-[10px]">주식 종류</Label>
                <Input value={form.share_class}
                  onChange={e => setForm({ ...form, share_class: e.target.value })}
                  placeholder="보통주 / 우선주" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">주주 합류일</Label>
                <Input type="date" value={form.joined_date}
                  onChange={e => setForm({ ...form, joined_date: e.target.value })}
                  className="h-8 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_beneficial_owner}
                  onChange={e => setForm({ ...form, is_beneficial_owner: e.target.checked })} />
                수익적 소유자 (nominee 아님)
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_voting_rights}
                  onChange={e => setForm({ ...form, is_voting_rights: e.target.checked })} />
                의결권 보유
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_director}
                  onChange={e => setForm({ ...form, is_director: e.target.checked })} />
                이사 (Direksi)
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_commissioner}
                  onChange={e => setForm({ ...form, is_commissioner: e.target.checked })} />
                감사 (Komisaris)
              </label>
            </div>

            <div>
              <Label className="text-[10px]">메모</Label>
              <Input value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="특이사항" className="h-8 text-xs" />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                {editingId ? '수정' : '추가'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
                취소
              </Button>
            </div>
          </div>
        )}

        {/* Shareholder list */}
        {loading ? (
          <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            등록된 주주가 없습니다. "주주 추가"로 정관상 주주 정보를 입력하세요.
          </div>
        ) : (
          <div className="space-y-1">
            {list.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded text-xs">
                {s.is_entity ? (
                  <Building2 className="h-3 w-3 text-blue-600 flex-shrink-0" />
                ) : (
                  <User className="h-3 w-3 text-green-600 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold truncate">{s.name}</span>
                    <Badge className="bg-purple-100 text-purple-700 text-[9px]">
                      {Number(s.shareholding_pct).toFixed(2)}%
                    </Badge>
                    {!s.is_resident && (
                      <Badge className="bg-amber-100 text-amber-700 text-[9px]">{s.country_code}</Badge>
                    )}
                    {Number(s.shareholding_pct) >= 25 && (
                      <Badge className="bg-blue-100 text-blue-700 text-[9px]">≥25%</Badge>
                    )}
                    {!s.is_beneficial_owner && (
                      <Badge className="bg-red-100 text-red-700 text-[9px]">Nominee</Badge>
                    )}
                    {s.is_director && <Badge className="bg-gray-100 text-gray-700 text-[9px]">이사</Badge>}
                    {s.is_commissioner && <Badge className="bg-gray-100 text-gray-700 text-[9px]">감사</Badge>}
                  </div>
                  {s.capital_amount && (
                    <p className="text-[10px] text-gray-500 mt-0.5">자본금 {fmtRp(Number(s.capital_amount))}</p>
                  )}
                </div>
                <button type="button" onClick={() => startEdit(s)} className="p-1 hover:bg-gray-100 rounded">
                  <Edit2 className="h-3 w-3 text-gray-500" />
                </button>
                <button type="button" onClick={() => handleDelete(s.id, s.name)} className="p-1 hover:bg-red-50 rounded">
                  <Trash2 className="h-3 w-3 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
