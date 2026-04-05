'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, Search, Users, Globe, FileText, Trash2,
  CheckCircle, AlertTriangle, X, Sparkles, Building2,
} from 'lucide-react';

interface License {
  type: string;
  number: string;
  issuer?: string;
  issued_at?: string;
  expires_at?: string;
  status?: string;
}

interface Counterparty {
  id: string;
  name: string;
  npwp: string | null;
  address: string | null;
  kbli_code: string | null;
  country: string | null;
  is_foreign: boolean;
  qualification_grade: string | null;
  has_cod: boolean;
  licenses: License[] | null;
  tax_treaty_info: { article?: string; rate?: number; notes?: string } | null;
  type: string;
  is_related_party: boolean;
  nickname: string | null;
  notes: string | null;
  created_at: string;
  registry?: { verified?: boolean; usage_count?: number } | null;
}

interface RegistryHit {
  id: string;
  name: string;
  npwp: string | null;
  address: string | null;
  kbli_code: string | null;
  country_code: string;
  is_foreign: boolean;
  has_cod: boolean;
  licenses: License[];
  tax_treaty_info: { article?: string; rate?: number; notes?: string } | null;
  phone: string | null;
  email: string | null;
  verified: boolean;
  usage_count: number;
}

export default function CounterpartiesPage() {
  const { session } = useSession();
  const [list, setList] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formNpwp, setFormNpwp] = useState('');
  const [formKbli, setFormKbli] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCountry, setFormCountry] = useState('ID');
  const [formIsForeign, setFormIsForeign] = useState(false);
  const [formHasCod, setFormHasCod] = useState(false);
  const [formQualification, setFormQualification] = useState('');
  const [formType, setFormType] = useState<'VENDOR' | 'CLIENT' | 'BOTH'>('VENDOR');
  const [formRelatedParty, setFormRelatedParty] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // Licenses (dynamic list)
  const [licenses, setLicenses] = useState<License[]>([]);
  const [newLicense, setNewLicense] = useState<License>({ type: '', number: '', expires_at: '' });

  // Tax treaty
  const [treatyArticle, setTreatyArticle] = useState('');
  const [treatyRate, setTreatyRate] = useState('');
  const [treatyNotes, setTreatyNotes] = useState('');

  // Registry search
  const [searchResults, setSearchResults] = useState<RegistryHit[]>([]);
  const [searching, setSearching] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/counterparties');
      const data = await res.json();
      if (data.success) setList(data.data || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // Registry auto-fill search (debounced)
  useEffect(() => {
    if (formNpwp.replace(/\D/g, '').length >= 15) {
      (async () => {
        setSearching(true);
        try {
          const res = await fetch(`/api/counterparties/search?npwp=${encodeURIComponent(formNpwp)}`);
          const data = await res.json();
          if (data.success && data.data.length > 0) {
            autofillFromRegistry(data.data[0]);
            showMsg('success', `기존 등록된 회사 정보를 자동 입력했습니다 (이전 이용자 ${data.data[0].usage_count}명)`);
          }
        } catch { /* */ }
        finally { setSearching(false); }
      })();
      return;
    }
    if (formName.length >= 2 && !formNpwp) {
      const timer = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await fetch(`/api/counterparties/search?q=${encodeURIComponent(formName)}`);
          const data = await res.json();
          if (data.success) setSearchResults(data.data || []);
        } catch { /* */ }
        finally { setSearching(false); }
      }, 400);
      return () => clearTimeout(timer);
    }
    setSearchResults([]);
  }, [formNpwp, formName]);

  const autofillFromRegistry = (hit: RegistryHit) => {
    setFormName(hit.name);
    setFormNpwp(hit.npwp || '');
    setFormKbli(hit.kbli_code || '');
    setFormAddress(hit.address || '');
    setFormCountry(hit.country_code || 'ID');
    setFormIsForeign(hit.is_foreign);
    setFormHasCod(hit.has_cod);
    setFormPhone(hit.phone || '');
    setFormEmail(hit.email || '');
    setLicenses(hit.licenses || []);
    if (hit.tax_treaty_info) {
      setTreatyArticle(hit.tax_treaty_info.article || '');
      setTreatyRate(String(hit.tax_treaty_info.rate ?? ''));
      setTreatyNotes(hit.tax_treaty_info.notes || '');
    }
    setSearchResults([]);
  };

  const addLicense = () => {
    if (!newLicense.type || !newLicense.number) return;
    setLicenses(prev => [...prev, { ...newLicense, status: 'ACTIVE' }]);
    setNewLicense({ type: '', number: '', expires_at: '' });
  };

  const removeLicense = (i: number) => {
    setLicenses(prev => prev.filter((_, idx) => idx !== i));
  };

  const resetForm = () => {
    setFormName(''); setFormNpwp(''); setFormKbli(''); setFormAddress('');
    setFormCountry('ID'); setFormIsForeign(false); setFormHasCod(false);
    setFormQualification(''); setFormType('VENDOR'); setFormRelatedParty(false);
    setFormPhone(''); setFormEmail('');
    setLicenses([]); setNewLicense({ type: '', number: '', expires_at: '' });
    setTreatyArticle(''); setTreatyRate(''); setTreatyNotes('');
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          npwp: formNpwp || undefined,
          kbli_code: formKbli || undefined,
          address: formAddress || undefined,
          country_code: formCountry,
          is_foreign: formIsForeign,
          has_cod: formHasCod,
          qualification_grade: formQualification || undefined,
          type: formType,
          is_related_party: formRelatedParty,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          licenses: licenses.length > 0 ? licenses : undefined,
          tax_treaty_info: treatyArticle || treatyRate || treatyNotes
            ? { article: treatyArticle, rate: treatyRate ? Number(treatyRate) : undefined, notes: treatyNotes }
            : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', '거래 상대방이 등록되었습니다');
        resetForm();
        setShowForm(false);
        loadList();
      } else {
        showMsg('error', data.error || '등록 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredList = list;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            거래 상대방 회사
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            원천세/부가세 계산에 필요한 거래처 정보를 관리합니다
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? '닫기' : '거래처 추가'}
        </Button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Registry info banner */}
      <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">AI Pajak 글로벌 거래처 레지스트리</p>
          <p className="text-[11px] text-blue-700 mt-0.5">
            NPWP나 회사명을 입력하면 다른 이용자가 먼저 등록한 거래처 정보를 자동으로 불러옵니다.
            본인이 등록한 정보도 다른 이용자에게 공유되어 인도네시아 세무 커뮤니티 품질을 향상시킵니다.
          </p>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-bold text-sm">거래처 추가</h3>

              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">회사명 *</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)}
                    placeholder="PT / CV / 회사 이름" required />
                </div>
                <div>
                  <Label className="text-xs">NPWP (15자리)</Label>
                  <Input value={formNpwp} onChange={e => setFormNpwp(e.target.value)}
                    placeholder="00.000.000.0-000.000" className="font-mono" />
                  {searching && <p className="text-[10px] text-gray-400 mt-1">🔍 레지스트리 검색 중...</p>}
                </div>
              </div>

              {/* Registry search suggestions */}
              {searchResults.length > 0 && !formNpwp && (
                <div className="border border-blue-200 rounded-lg bg-blue-50 p-2">
                  <p className="text-[10px] font-medium text-blue-700 mb-1">✨ 레지스트리 추천 (클릭하여 자동 입력)</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {searchResults.map(hit => (
                      <button
                        key={hit.id} type="button"
                        onClick={() => autofillFromRegistry(hit)}
                        className="w-full text-left p-2 rounded hover:bg-white text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{hit.name}</span>
                          {hit.verified && <Badge className="bg-green-100 text-green-700 text-[9px]">검증됨</Badge>}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {hit.npwp && <span className="font-mono">NPWP: {hit.npwp} · </span>}
                          {hit.is_foreign ? '🌍 국외' : '🇮🇩 국내'} · 이용자 {hit.usage_count}명
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">주소</Label>
                  <Input value={formAddress} onChange={e => setFormAddress(e.target.value)}
                    placeholder="회사 주소" />
                </div>
                <div>
                  <Label className="text-xs">KBLI 코드 (5자리)</Label>
                  <Input value={formKbli} onChange={e => setFormKbli(e.target.value)}
                    placeholder="예: 62010" className="font-mono" />
                </div>
                <div>
                  <Label className="text-xs">전화번호</Label>
                  <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+62 ..." />
                </div>
                <div>
                  <Label className="text-xs">이메일</Label>
                  <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="info@..." />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">거래 유형</Label>
                  <select value={formType} onChange={e => setFormType(e.target.value as 'VENDOR' | 'CLIENT' | 'BOTH')}
                    className="w-full h-9 px-3 rounded-md border border-input text-sm">
                    <option value="VENDOR">공급자 (매입)</option>
                    <option value="CLIENT">고객 (매출)</option>
                    <option value="BOTH">양방향</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">자격 등급 (건설)</Label>
                  <select value={formQualification} onChange={e => setFormQualification(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input text-sm">
                    <option value="">해당 없음</option>
                    <option value="SMALL">SMALL</option>
                    <option value="MEDIUM_LARGE">MEDIUM_LARGE</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={formIsForeign} onChange={e => setFormIsForeign(e.target.checked)} />
                    국외 법인
                  </label>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={formRelatedParty} onChange={e => setFormRelatedParty(e.target.checked)} />
                    관계사 (TP)
                  </label>
                </div>
              </div>

              {/* Foreign-specific fields */}
              {formIsForeign && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <Globe className="h-3 w-3" />국외 법인 — 조세조약 정보
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px]">국가 (ISO 2)</Label>
                      <Input value={formCountry} onChange={e => setFormCountry(e.target.value.toUpperCase())}
                        placeholder="KR / US / SG ..." className="font-mono" maxLength={2} />
                    </div>
                    <div>
                      <Label className="text-[10px]">조세조약 조항</Label>
                      <Input value={treatyArticle} onChange={e => setTreatyArticle(e.target.value)}
                        placeholder="예: Article 12" />
                    </div>
                    <div>
                      <Label className="text-[10px]">적용 세율 (%)</Label>
                      <Input type="number" step="0.01" value={treatyRate} onChange={e => setTreatyRate(e.target.value)}
                        placeholder="10" />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={formHasCod} onChange={e => setFormHasCod(e.target.checked)} />
                        COD 보유
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">조약 비고</Label>
                    <Input value={treatyNotes} onChange={e => setTreatyNotes(e.target.value)}
                      placeholder="특이사항 (적용 제한, 유효기간 등)" />
                  </div>
                </div>
              )}

              {/* Licenses */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <FileText className="h-3 w-3" />라이센스 / 인허가
                </p>
                {licenses.length > 0 && (
                  <div className="space-y-1">
                    {licenses.map((lic, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white p-2 rounded text-xs">
                        <Badge className="bg-indigo-100 text-indigo-700">{lic.type}</Badge>
                        <span className="font-mono">{lic.number}</span>
                        {lic.expires_at && <span className="text-gray-500">만료 {lic.expires_at}</span>}
                        {lic.issuer && <span className="text-gray-400">({lic.issuer})</span>}
                        <button type="button" onClick={() => removeLicense(i)} className="ml-auto">
                          <X className="h-3 w-3 text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Input value={newLicense.type} onChange={e => setNewLicense({ ...newLicense, type: e.target.value })}
                    placeholder="유형 (SIUP, NIB, SBU...)" className="h-8 text-xs" />
                  <Input value={newLicense.number} onChange={e => setNewLicense({ ...newLicense, number: e.target.value })}
                    placeholder="번호" className="h-8 text-xs font-mono" />
                  <Input value={newLicense.issuer || ''} onChange={e => setNewLicense({ ...newLicense, issuer: e.target.value })}
                    placeholder="발급 기관" className="h-8 text-xs" />
                  <Input type="date" value={newLicense.expires_at || ''}
                    onChange={e => setNewLicense({ ...newLicense, expires_at: e.target.value })}
                    className="h-8 text-xs" />
                  <Button type="button" size="sm" variant="outline" onClick={addLicense}
                    disabled={!newLicense.type || !newLicense.number}>
                    <Plus className="h-3 w-3 mr-1" />추가
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting || !formName}>
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                  저장
                </Button>
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-sm mb-3">등록된 거래처 ({filteredList.length})</h3>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              등록된 거래처가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {filteredList.map(cp => {
                const licenseCount = Array.isArray(cp.licenses) ? cp.licenses.length : 0;
                const expiringSoon = Array.isArray(cp.licenses) && cp.licenses.some(l => {
                  if (!l.expires_at) return false;
                  const d = new Date(l.expires_at);
                  const days = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                  return days >= 0 && days <= 60;
                });

                return (
                  <div key={cp.id} className="p-3 rounded-lg border hover:border-gray-300 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{cp.name}</span>
                          <Badge className={
                            cp.type === 'VENDOR' ? 'text-[9px] bg-purple-100 text-purple-700' :
                            cp.type === 'CLIENT' ? 'text-[9px] bg-blue-100 text-blue-700' :
                            'text-[9px] bg-gray-100 text-gray-700'
                          }>
                            {cp.type === 'VENDOR' ? '공급자' : cp.type === 'CLIENT' ? '고객' : cp.type}
                          </Badge>
                          {cp.is_foreign && <Badge className="text-[9px] bg-amber-100 text-amber-700"><Globe className="h-2.5 w-2.5 mr-0.5 inline" />{cp.country}</Badge>}
                          {cp.has_cod && <Badge className="text-[9px] bg-green-100 text-green-700">COD</Badge>}
                          {cp.is_related_party && <Badge className="text-[9px] bg-red-100 text-red-700">관계사</Badge>}
                          {cp.registry?.verified && <Badge className="text-[9px] bg-emerald-100 text-emerald-700">검증</Badge>}
                        </div>
                        <div className="text-[11px] text-gray-500 space-y-0.5">
                          {cp.npwp && <div>NPWP: <span className="font-mono">{cp.npwp}</span></div>}
                          {cp.kbli_code && <div>KBLI: <span className="font-mono">{cp.kbli_code}</span></div>}
                          {cp.address && <div className="truncate">주소: {cp.address}</div>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        {licenseCount > 0 && (
                          <div className="text-[10px] text-gray-500 flex items-center gap-1">
                            <FileText className="h-2.5 w-2.5" />
                            라이센스 {licenseCount}개
                            {expiringSoon && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
