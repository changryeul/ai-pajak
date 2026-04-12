'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Users, Plus, Trash2, Loader2, AlertTriangle,
  CheckCircle, X, Edit2, Building2, User,
  Sparkles, FileText, Save,
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

interface ExtractedShareholder {
  name: string;
  is_entity: boolean;
  npwp: string | null;
  nik: string | null;
  country_code: string;
  shareholding_pct: number;
  capital_amount: number | null;
  share_class: string | null;
  is_director: boolean;
  is_commissioner: boolean;
  is_beneficial_owner: boolean;
}

interface OcrResult {
  company_name: string | null;
  incorporation_date: string | null;
  notary_name: string | null;
  total_authorized_capital: number | null;
  total_paid_up_capital: number | null;
  shareholders: ExtractedShareholder[];
  confidence: number;
  warnings: string[];
}

export function ShareholderSection({ customerId }: ShareholderSectionProps) {
  const t = useTranslations('shareholder');
  const [list, setList] = useState<Shareholder[]>([]);
  const [totalPct, setTotalPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Akta OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrSelection, setOcrSelection] = useState<Set<number>>(new Set());
  const [ocrSaving, setOcrSaving] = useState(false);

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
      showMsg('error', t('errNamePct'));
      return;
    }
    const pct = Number(form.shareholding_pct);
    if (pct <= 0 || pct > 100) {
      showMsg('error', t('errPctRange'));
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
        showMsg('success', editingId ? t('editSuccess') : t('createSuccess'));
        resetForm();
        setShowForm(false);
        load();
      } else {
        showMsg('error', data.error || t('saveFailed'));
      }
    } catch {
      showMsg('error', t('serverError'));
    } finally {
      setSaving(false);
    }
  };

  const handleOcrUpload = async (file: File) => {
    setOcrLoading(true);
    setOcrResult(null);
    setOcrSelection(new Set());
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/shareholders/ocr', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data) {
        const result = data.data as OcrResult;
        setOcrResult(result);
        // Pre-select all extracted shareholders
        setOcrSelection(new Set(result.shareholders.map((_, i) => i)));
        const count = result.shareholders.length;
        if (count > 0) {
          showMsg('success', t('ocrSuccess', { count }));
        } else {
          showMsg('error', t('ocrNotFound'));
        }
      } else {
        showMsg('error', data.error || t('ocrFailed'));
      }
    } catch {
      showMsg('error', t('ocrServerError'));
    } finally {
      setOcrLoading(false);
    }
  };

  const toggleOcrSelection = (idx: number) => {
    setOcrSelection(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSaveOcrResults = async () => {
    if (!ocrResult) return;
    const selected = ocrResult.shareholders.filter((_, i) => ocrSelection.has(i));
    if (selected.length === 0) {
      showMsg('error', t('selectToSave'));
      return;
    }
    setOcrSaving(true);
    let successCount = 0;
    let errorCount = 0;
    for (const sh of selected) {
      try {
        const payload = {
          name: sh.name,
          is_entity: sh.is_entity,
          npwp: sh.npwp || undefined,
          nik: sh.nik || undefined,
          country_code: sh.country_code || 'ID',
          is_resident: (sh.country_code || 'ID').toUpperCase() === 'ID',
          shareholding_pct: sh.shareholding_pct,
          capital_amount: sh.capital_amount ?? undefined,
          share_class: sh.share_class || undefined,
          is_beneficial_owner: sh.is_beneficial_owner ?? true,
          is_director: sh.is_director,
          is_commissioner: sh.is_commissioner,
          source: 'AKTA_OCR',
          ...(customerId && { customerId }),
        };
        const res = await fetch('/api/shareholders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
    }
    setOcrSaving(false);
    if (successCount > 0) {
      showMsg('success', errorCount > 0 ? t('bulkSavePartial', { success: successCount, error: errorCount }) : t('bulkSaveSuccess', { success: successCount }));
      setOcrResult(null);
      setOcrSelection(new Set());
      load();
    } else {
      showMsg('error', t('bulkSaveAllFailed'));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('deleteConfirm', { name }))) return;
    try {
      const res = await fetch(`/api/shareholders?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showMsg('success', t('deleteSuccess'));
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
              {t('title')}
              <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                {t('count', { count: list.length })}
              </Badge>
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {t('description')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 cursor-pointer">
              {ocrLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {ocrLoading ? t('ocrLoading') : t('ocrBtn')}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={ocrLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleOcrUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
            <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              {showForm ? t('closeBtn') : t('addBtn')}
            </Button>
          </div>
        </div>

        {/* Total % summary */}
        {list.length > 0 && (
          <div className={`p-2 rounded text-xs flex items-center justify-between ${
            warnOver ? 'bg-red-50 text-red-800' : warnUnder ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'
          }`}>
            <span className="font-medium">
              {t('totalPct')} <b>{totalPct.toFixed(2)}%</b>
              {remainingPct > 0.01 && ` · {t('remaining', { pct: remainingPct.toFixed(2) })}`}
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

        {/* OCR extracted preview — review & save */}
        {ocrResult && ocrResult.shareholders.length > 0 && (
          <div className="border-2 border-purple-300 rounded-lg p-3 bg-gradient-to-br from-purple-50 to-indigo-50 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-700" />
              <p className="text-xs font-bold text-purple-900">{t('ocrResultTitle')}</p>
              <Badge className="bg-purple-600 text-white text-[9px]">
                {t('confidence', { pct: Math.round((ocrResult.confidence || 0) * 100) })}
              </Badge>
              <button
                onClick={() => { setOcrResult(null); setOcrSelection(new Set()); }}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {ocrResult.company_name && (
              <p className="text-[11px] text-purple-800">
                <b>{t('company')}</b> {ocrResult.company_name}
                {ocrResult.incorporation_date && ` · {t('established')} ${ocrResult.incorporation_date}`}
                {ocrResult.notary_name && ` · {t('notary')} ${ocrResult.notary_name}`}
              </p>
            )}
            {(ocrResult.total_authorized_capital || ocrResult.total_paid_up_capital) && (
              <p className="text-[11px] text-purple-700">
                {ocrResult.total_authorized_capital && `{t('authorizedCapital')} ${fmtRp(ocrResult.total_authorized_capital)}`}
                {ocrResult.total_authorized_capital && ocrResult.total_paid_up_capital && ' · '}
                {ocrResult.total_paid_up_capital && `{t('paidUpCapital')} ${fmtRp(ocrResult.total_paid_up_capital)}`}
              </p>
            )}

            {/* Warnings */}
            {ocrResult.warnings && ocrResult.warnings.length > 0 && (
              <div className="space-y-1">
                {ocrResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1 text-[10px] text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Extracted shareholder list with checkboxes */}
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {ocrResult.shareholders.map((sh, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-[11px] ${
                    ocrSelection.has(i) ? 'bg-white border-purple-400' : 'bg-white/50 border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={ocrSelection.has(i)}
                    onChange={() => toggleOcrSelection(i)}
                    className="accent-purple-600"
                  />
                  {sh.is_entity ? (
                    <Building2 className="h-3 w-3 text-blue-600 flex-shrink-0" />
                  ) : (
                    <User className="h-3 w-3 text-green-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold truncate">{sh.name}</span>
                      <Badge className="bg-purple-100 text-purple-700 text-[9px]">
                        {Number(sh.shareholding_pct).toFixed(2)}%
                      </Badge>
                      {sh.country_code !== 'ID' && (
                        <Badge className="bg-amber-100 text-amber-700 text-[9px]">{sh.country_code}</Badge>
                      )}
                      {Number(sh.shareholding_pct) >= 25 && (
                        <Badge className="bg-blue-100 text-blue-700 text-[9px]">≥25%</Badge>
                      )}
                      {sh.is_director && <Badge className="bg-gray-100 text-gray-700 text-[9px]">{t('director')}</Badge>}
                      {sh.is_commissioner && <Badge className="bg-gray-100 text-gray-700 text-[9px]">{t('commissioner')}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                      {sh.capital_amount && <span>{t('capitalAmount')} {fmtRp(sh.capital_amount)}</span>}
                      {sh.npwp && <span className="font-mono">{sh.npwp}</span>}
                      {sh.nik && <span className="font-mono">NIK {sh.nik}</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-purple-200">
              <p className="text-[10px] text-purple-600">
                {ocrSelection.size}/{ocrResult.shareholders.length}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const allIdx = new Set(ocrResult.shareholders.map((_, i) => i));
                    setOcrSelection(ocrSelection.size === allIdx.size ? new Set() : allIdx);
                  }}
                >
                  {ocrSelection.size === ocrResult.shareholders.length ? t('deselectAll') : t('selectAll')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveOcrResults}
                  disabled={ocrSaving || ocrSelection.size === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {ocrSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  {t('saveSelected', { count: ocrSelection.size })}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/50 space-y-3">
            <p className="text-xs font-bold text-purple-900">
              {editingId ? t('editTitle') : t('createTitle')}
            </p>

            {/* Entity / Individual toggle */}
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" checked={form.is_entity}
                  onChange={() => setForm({ ...form, is_entity: true })} />
                <Building2 className="h-3 w-3" /> {t('entitySh')}
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" checked={!form.is_entity}
                  onChange={() => setForm({ ...form, is_entity: false })} />
                <User className="h-3 w-3" /> {t('individualSh')}
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="md:col-span-2">
                <Label className="text-[10px]">{t('nameLabel')}</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={form.is_entity ? t('namePlaceholderEntity') : t('namePlaceholderIndividual')}
                  className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">{t('pctLabel')}</Label>
                <Input type="number" step="0.01" min="0" max="100"
                  value={form.shareholding_pct}
                  onChange={e => setForm({ ...form, shareholding_pct: e.target.value })}
                  placeholder="25" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[10px]">{t('capitalLabel')}</Label>
                <Input type="number" value={form.capital_amount}
                  onChange={e => setForm({ ...form, capital_amount: e.target.value })}
                  placeholder="500000000" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[10px]">{t('nationalityLabel')}</Label>
                <Input value={form.country_code} maxLength={2}
                  onChange={e => setForm({ ...form, country_code: e.target.value.toUpperCase() })}
                  placeholder="ID / KR / SG" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[10px]">{t('residentLabel')}</Label>
                <select value={form.is_resident ? 'Y' : 'N'}
                  onChange={e => setForm({ ...form, is_resident: e.target.value === 'Y' })}
                  className="w-full h-8 px-2 rounded border text-xs">
                  <option value="Y">{t('resident')}</option>
                  <option value="N">{t('nonResident')}</option>
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
                  <Label className="text-[10px]">{t('nikLabel')}</Label>
                  <Input value={form.nik}
                    onChange={e => setForm({ ...form, nik: e.target.value })}
                    placeholder={t('nikPlaceholder')} className="h-8 text-xs font-mono" />
                </div>
              )}
              <div>
                <Label className="text-[10px]">{t('shareClassLabel')}</Label>
                <Input value={form.share_class}
                  onChange={e => setForm({ ...form, share_class: e.target.value })}
                  placeholder={t('shareClassPlaceholder')} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">{t('joinDateLabel')}</Label>
                <Input type="date" value={form.joined_date}
                  onChange={e => setForm({ ...form, joined_date: e.target.value })}
                  className="h-8 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_beneficial_owner}
                  onChange={e => setForm({ ...form, is_beneficial_owner: e.target.checked })} />
                {t('beneficialOwner')}
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_voting_rights}
                  onChange={e => setForm({ ...form, is_voting_rights: e.target.checked })} />
                {t('votingRights')}
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_director}
                  onChange={e => setForm({ ...form, is_director: e.target.checked })} />
                {t('isDirector')}
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_commissioner}
                  onChange={e => setForm({ ...form, is_commissioner: e.target.checked })} />
                {t('isCommissioner')}
              </label>
            </div>

            <div>
              <Label className="text-[10px]">{t('memoLabel')}</Label>
              <Input value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder={t('memoPlaceholder')} className="h-8 text-xs" />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                {editingId ? t('submitEdit') : t('submitCreate')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Shareholder list */}
        {loading ? (
          <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            {t('emptyMsg')}
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
                    {s.is_director && <Badge className="bg-gray-100 text-gray-700 text-[9px]">{t('director')}</Badge>}
                    {s.is_commissioner && <Badge className="bg-gray-100 text-gray-700 text-[9px]">{t('commissioner')}</Badge>}
                  </div>
                  {s.capital_amount && (
                    <p className="text-[10px] text-gray-500 mt-0.5">{t('capitalAmount')} {fmtRp(Number(s.capital_amount))}</p>
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
