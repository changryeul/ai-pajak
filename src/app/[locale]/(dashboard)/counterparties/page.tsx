'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, Users, Globe, FileText, CheckCircle, AlertTriangle, X, Sparkles, Building2,
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
  const t = useTranslations('counterparties');
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

  // Phase 2: DTA documents + shareholder withholding fields
  const [formIsEntity, setFormIsEntity] = useState(true);
  const [formCorValidUntil, setFormCorValidUntil] = useState('');
  const [formCorDocUrl, setFormCorDocUrl] = useState('');
  const [formDgtFormType, setFormDgtFormType] = useState<'' | 'DGT_1' | 'DGT_2'>('');
  const [formDgtFormUrl, setFormDgtFormUrl] = useState('');
  const [formDgtValidUntil, setFormDgtValidUntil] = useState('');
  const [formIsShareholder, setFormIsShareholder] = useState(false);
  const [formShareholdingPct, setFormShareholdingPct] = useState('');
  const [formIsBeneficialOwner, setFormIsBeneficialOwner] = useState(false);
  const [formReceivesReinvested, setFormReceivesReinvested] = useState(false);
  const [formVendorIsOwner, setFormVendorIsOwner] = useState(false);

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
            showMsg('success', t('autoFilled', { count: data.data[0].usage_count }));
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
    // Phase 2 fields
    setFormIsEntity(true);
    setFormCorValidUntil(''); setFormCorDocUrl('');
    setFormDgtFormType(''); setFormDgtFormUrl(''); setFormDgtValidUntil('');
    setFormIsShareholder(false); setFormShareholdingPct('');
    setFormIsBeneficialOwner(false); setFormReceivesReinvested(false);
    setFormVendorIsOwner(false);
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
          // Phase 2 withholding fields
          is_entity: formIsEntity,
          cor_valid_until: formCorValidUntil || undefined,
          cor_document_url: formCorDocUrl || undefined,
          dgt_form_type: formDgtFormType || undefined,
          dgt_form_url: formDgtFormUrl || undefined,
          dgt_form_valid_until: formDgtValidUntil || undefined,
          is_shareholder: formIsShareholder,
          shareholding_pct: formShareholdingPct ? Number(formShareholdingPct) : undefined,
          is_beneficial_owner: formIsBeneficialOwner,
          receives_reinvested_dividend: formReceivesReinvested,
          vendor_is_property_owner: formVendorIsOwner,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', t('k2_844fe2'));
        resetForm();
        setShowForm(false);
        loadList();
      } else {
        showMsg('error', data.error || t('k3_71bfca'));
      }
    } catch {
      showMsg('error', t('k4_175c5f'));
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
            {t('k5_09c6ec')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('k6_28455f')}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? t('k7_218e2a') : t('k8_da7845')}
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
          <p className="font-medium">AI Pajak {t('k9_a0256c')}</p>
          <p className="text-[11px] text-blue-700 mt-0.5">
            NPWP{t('k10_6614ed')}
            {t('k11_21a5af')}
          </p>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-bold text-sm">{t('k8_da7845')}</h3>

              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('k12_2e47c1')} *</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)}
                    placeholder={`PT / CV / ${t('k13_559343')}`} required />
                </div>
                <div>
                  <Label className="text-xs">NPWP (15{t('k14_0821ab')}</Label>
                  <Input value={formNpwp} onChange={e => setFormNpwp(e.target.value)}
                    placeholder="00.000.000.0-000.000" className="font-mono" />
                  {searching && <p className="text-[10px] text-gray-400 mt-1">🔍 {t('k15_f87ec2')}</p>}
                </div>
              </div>

              {/* Registry search suggestions */}
              {searchResults.length > 0 && !formNpwp && (
                <div className="border border-blue-200 rounded-lg bg-blue-50 p-2">
                  <p className="text-[10px] font-medium text-blue-700 mb-1">✨ {t('k16_a64d93')}</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {searchResults.map(hit => (
                      <button
                        key={hit.id} type="button"
                        onClick={() => autofillFromRegistry(hit)}
                        className="w-full text-left p-2 rounded hover:bg-white text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{hit.name}</span>
                          {hit.verified && <Badge className="bg-green-100 text-green-700 text-[9px]">{t('k17_a17157')}</Badge>}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {hit.npwp && <span className="font-mono">NPWP: {hit.npwp} · </span>}
                          {hit.is_foreign ? '🌍 ' + t('foreignTag') : '🇮🇩 ' + t('domesticTag')} · {t('usageCount', { count: hit.usage_count })}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('k21_45f790')}</Label>
                  <Input value={formAddress} onChange={e => setFormAddress(e.target.value)}
                    placeholder={t('companyAddress')} />
                </div>
                <div>
                  <Label className="text-xs">{t('kbliCode')}</Label>
                  <Input value={formKbli} onChange={e => setFormKbli(e.target.value)}
                    placeholder={t('exampleKbli')} className="font-mono" />
                </div>
                <div>
                  <Label className="text-xs">{t('k24_ba8df0')}</Label>
                  <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+62 ..." />
                </div>
                <div>
                  <Label className="text-xs">{t('k25_af9b1e')}</Label>
                  <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="info@..." />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">{t('k26_521c49')}</Label>
                  <select value={formType} onChange={e => setFormType(e.target.value as 'VENDOR' | 'CLIENT' | 'BOTH')}
                    className="w-full h-9 px-3 rounded-md border border-input text-sm">
                    <option value="VENDOR">{t('k27_d76136')}</option>
                    <option value="CLIENT">{t('k28_4a773e')}</option>
                    <option value="BOTH">{t('k29_37a73c')}</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">{t('k30_bfb537')}</Label>
                  <select value={formQualification} onChange={e => setFormQualification(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input text-sm">
                    <option value="">{t('k31_61408f')}</option>
                    <option value="SMALL">SMALL</option>
                    <option value="MEDIUM_LARGE">MEDIUM_LARGE</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={formIsForeign} onChange={e => setFormIsForeign(e.target.checked)} />
                    {t('foreignEntity')}
                  </label>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={formRelatedParty} onChange={e => setFormRelatedParty(e.target.checked)} />
                    {t('k33_6afe8d')}
                  </label>
                </div>
              </div>

              {/* Entity vs Individual */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-700 mb-2">{t('k34_b57ec6')}</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="radio" checked={formIsEntity} onChange={() => setFormIsEntity(true)} />
                    {t('k35_ae355f')}
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="radio" checked={!formIsEntity} onChange={() => setFormIsEntity(false)} />
                    {t('k36_06e76f')}
                  </label>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  * {t('dividendExemptNote')}
                </p>
              </div>

              {/* Foreign-specific fields */}
              {formIsForeign && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <Globe className="h-3 w-3" />{t('foreignCounterparty')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px]">{t('k39_14c7e6')}</Label>
                      <Input value={formCountry} onChange={e => setFormCountry(e.target.value.toUpperCase())}
                        placeholder="KR / US / SG ..." className="font-mono" maxLength={2} />
                    </div>
                    <div>
                      <Label className="text-[10px]">{t('k40_c16332')}</Label>
                      <Input value={treatyArticle} onChange={e => setTreatyArticle(e.target.value)}
                        placeholder={t('exampleArticle')} />
                    </div>
                    <div>
                      <Label className="text-[10px]">{t('k41_fe1e6c')}</Label>
                      <Input type="number" step="0.01" value={treatyRate} onChange={e => setTreatyRate(e.target.value)}
                        placeholder="10" />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={formHasCod} onChange={e => setFormHasCod(e.target.checked)} />
                        COD {t('k42_286f58')}
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">{t('k43_f6aff4')}</Label>
                    <Input value={treatyNotes} onChange={e => setTreatyNotes(e.target.value)}
                      placeholder={t('k44_eddbd1')} />
                  </div>

                  {/* DTA documents — COR / DGT Form */}
                  <div className="border-t border-amber-200 pt-3">
                    <p className="text-[11px] font-bold text-amber-900 mb-2">DTA {t('k45_52e787')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">CoR/CoD {t('k46_a37db9')}</Label>
                        <Input type="date" value={formCorValidUntil}
                          onChange={e => setFormCorValidUntil(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">CoR {t('k47_dede63')}</Label>
                        <Input value={formCorDocUrl} onChange={e => setFormCorDocUrl(e.target.value)}
                          placeholder="https://..." className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">DGT Form {t('k48_d38ee7')}</Label>
                        <select value={formDgtFormType}
                          onChange={e => setFormDgtFormType(e.target.value as '' | 'DGT_1' | 'DGT_2')}
                          className="w-full h-8 px-2 rounded border text-xs">
                          <option value="">{t('k49_8c45d5')}</option>
                          <option value="DGT_1">DGT Form 1 ({t('k36_06e76f')})</option>
                          <option value="DGT_2">DGT Form 2 ({t('k51_0ab428')}</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px]">DGT Form {t('k46_a37db9')}</Label>
                        <Input type="date" value={formDgtValidUntil}
                          onChange={e => setFormDgtValidUntil(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-[10px]">DGT Form {t('k47_dede63')}</Label>
                        <Input value={formDgtFormUrl} onChange={e => setFormDgtFormUrl(e.target.value)}
                          placeholder="https://..." className="h-8 text-xs" />
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-700 mt-2">
                      * {t('dgtWarning')}
                    </p>
                  </div>
                </div>
              )}

              {/* Shareholder / Withholding info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-purple-900 flex items-center gap-1">
                  <Users className="h-3 w-3" />{t('k52_16e603')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={formIsShareholder}
                      onChange={e => setFormIsShareholder(e.target.checked)} />
                    {t('isShareholder')}
                  </label>
                  {formIsShareholder && (
                    <div>
                      <Label className="text-[10px]">{t('k56_e704b3')}</Label>
                      <Input type="number" step="0.01" min="0" max="100"
                        value={formShareholdingPct} onChange={e => setFormShareholdingPct(e.target.value)}
                        placeholder="25" className="h-8 text-xs" />
                      <p className="text-[10px] text-purple-700 mt-0.5">
                        * {t('shareholdingNote')}
                      </p>
                    </div>
                  )}
                </div>
                {formIsShareholder && (
                  <>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={formIsBeneficialOwner}
                        onChange={e => setFormIsBeneficialOwner(e.target.checked)} />
                      {t('beneficialOwner')}
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={formReceivesReinvested}
                        onChange={e => setFormReceivesReinvested(e.target.checked)} />
                      {t('reinvestDividend')}
                    </label>
                  </>
                )}
                <label className="flex items-center gap-1 text-xs border-t border-purple-200 pt-2">
                  <input type="checkbox" checked={formVendorIsOwner}
                    onChange={e => setFormVendorIsOwner(e.target.checked)} />
                  {t('isPropertyOwner')}
                </label>
              </div>

              {/* Licenses */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <FileText className="h-3 w-3" />{t('k63_d178a8')}
                </p>
                {licenses.length > 0 && (
                  <div className="space-y-1">
                    {licenses.map((lic, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white p-2 rounded text-xs">
                        <Badge className="bg-indigo-100 text-indigo-700">{lic.type}</Badge>
                        <span className="font-mono">{lic.number}</span>
                        {lic.expires_at && <span className="text-gray-500">{t('k64_0c9d60')} {lic.expires_at}</span>}
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
                    placeholder={`${t('k48_d38ee7')} (SIUP, NIB, SBU...)`} className="h-8 text-xs" />
                  <Input value={newLicense.number} onChange={e => setNewLicense({ ...newLicense, number: e.target.value })}
                    placeholder={t('k66_5ca2f7')} className="h-8 text-xs font-mono" />
                  <Input value={newLicense.issuer || ''} onChange={e => setNewLicense({ ...newLicense, issuer: e.target.value })}
                    placeholder={t('k67_3159d6')} className="h-8 text-xs" />
                  <Input type="date" value={newLicense.expires_at || ''}
                    onChange={e => setNewLicense({ ...newLicense, expires_at: e.target.value })}
                    className="h-8 text-xs" />
                  <Button type="button" size="sm" variant="outline" onClick={addLicense}
                    disabled={!newLicense.type || !newLicense.number}>
                    <Plus className="h-3 w-3 mr-1" />{t('k68_ebe4aa')}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting || !formName}>
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                  {t('k69_9d0a47')}
                </Button>
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
                  {t('k70_d9de21')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-sm mb-3">{t('k71_71d3cf')} ({filteredList.length})</h3>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              {t('noRegistered')}
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
                            {cp.type === 'VENDOR' ? t('k73_5da4af') : cp.type === 'CLIENT' ? t('k74_1edd91') : cp.type}
                          </Badge>
                          {cp.is_foreign && <Badge className="text-[9px] bg-amber-100 text-amber-700"><Globe className="h-2.5 w-2.5 mr-0.5 inline" />{cp.country}</Badge>}
                          {cp.has_cod && <Badge className="text-[9px] bg-green-100 text-green-700">COD</Badge>}
                          {cp.is_related_party && <Badge className="text-[9px] bg-red-100 text-red-700">{t('k75_6c8ca0')}</Badge>}
                          {cp.registry?.verified && <Badge className="text-[9px] bg-emerald-100 text-emerald-700">{t('k76_0a4c43')}</Badge>}
                        </div>
                        <div className="text-[11px] text-gray-500 space-y-0.5">
                          {cp.npwp && <div>NPWP: <span className="font-mono">{cp.npwp}</span></div>}
                          {cp.kbli_code && <div>KBLI: <span className="font-mono">{cp.kbli_code}</span></div>}
                          {cp.address && <div className="truncate">{t('k21_45f790')}: {cp.address}</div>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        {licenseCount > 0 && (
                          <div className="text-[10px] text-gray-500 flex items-center gap-1">
                            <FileText className="h-2.5 w-2.5" />
                            {t('licenseCount', { count: licenseCount })}
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
