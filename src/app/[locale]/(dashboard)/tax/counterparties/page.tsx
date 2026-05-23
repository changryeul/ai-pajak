'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import {
  Users, Plus, Search, Edit2, Trash2, Building2, User, Briefcase,
  Loader2, X, Check, AlertTriangle,
} from 'lucide-react';

interface Counterparty {
  id: string; name: string; npwp?: string; nik?: string;
  address?: string; phone?: string; email?: string;
  type: string; is_related_party: boolean;
  kbli_code?: string; qualification_grade?: string;
  country?: string; is_resident?: boolean;
  has_cod?: boolean; vendor_is_property_owner?: boolean;
}

export default function CounterpartiesPage() {
  const t = useTranslations();
  const tc = useTranslations('counterparties');

  const typeConfig: Record<string, { label: string; icon: typeof User; color: string }> = {
    VENDOR: { label: tc('vendor'), icon: Building2, color: 'bg-blue-100 text-blue-700' },
    CLIENT: { label: tc('client'), icon: Briefcase, color: 'bg-green-100 text-green-700' },
    EMPLOYEE: { label: tc('employee'), icon: User, color: 'bg-purple-100 text-purple-700' },
  };
  const { session } = useSession();
  const {
    customerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
  } = useEffectiveCustomerId();

  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', npwp: '', nik: '', address: '', phone: '', email: '',
    type: 'VENDOR', isRelatedParty: false,
    kbliCode: '', qualificationGrade: '', country: 'ID', isResident: true,
    hasCod: false, vendorIsPropertyOwner: false,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      if (customerId) p.append('customerId', customerId);
      if (filterType !== 'all') p.append('type', filterType);
      const res = await fetch(`/api/tax/counterparties?${p}`);
      const data = await res.json();
      if (data.success) setCounterparties(data.data.counterparties);
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [customerId, filterType]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setForm({ name: '', npwp: '', nik: '', address: '', phone: '', email: '', type: 'VENDOR', isRelatedParty: false, kbliCode: '', qualificationGrade: '', country: 'ID', isResident: true, hasCod: false, vendorIsPropertyOwner: false });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (cp: Counterparty) => {
    setForm({
      name: cp.name, npwp: cp.npwp || '', nik: cp.nik || '',
      address: cp.address || '', phone: cp.phone || '', email: cp.email || '',
      type: cp.type, isRelatedParty: cp.is_related_party,
      kbliCode: cp.kbli_code || '', qualificationGrade: cp.qualification_grade || '',
      country: cp.country || 'ID', isResident: cp.is_resident ?? true,
      hasCod: cp.has_cod ?? false, vendorIsPropertyOwner: cp.vendor_is_property_owner ?? false,
    });
    setEditingId(cp.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setIsSaving(true);
    try {
      await fetch('/api/tax/counterparties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, npwp: form.npwp, nik: form.nik,
          address: form.address, phone: form.phone, email: form.email,
          type: form.type, isRelatedParty: form.isRelatedParty,
          kbliCode: form.kbliCode, qualificationGrade: form.qualificationGrade,
          country: form.country, isResident: form.isResident,
          hasCod: form.hasCod, vendorIsPropertyOwner: form.vendorIsPropertyOwner,
          customerId: customerId,
          ...(editingId ? { id: editingId } : {}),
        }),
      });
      resetForm();
      loadData();
    } catch { /* */ }
    finally { setIsSaving(false); }
  };

  const filtered = counterparties.filter(cp =>
    (!search || cp.name.toLowerCase().includes(search.toLowerCase()) || cp.npwp?.includes(search))
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Debug: show if session loaded */}
      {!session && <p className="text-xs text-gray-400 mb-2">Loading session...</p>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            {tc('title')}
          </h1>
          <p className="text-gray-500 mt-1">{tc('subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />{tc('add')}
        </Button>
      </div>

      {/* Consultant customer picker. CUSTOMER role: card is not rendered. */}
      {isConsultant && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label htmlFor="cp-customer" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('taxScreen.selectCustomer')}
          </label>
          {customers.length === 0 ? (
            <span className="text-xs text-slate-400">{t('taxScreen.noAssignedCustomers')}</span>
          ) : (
            <select
              id="cp-customer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? tc('update') : tc('add')} {tc('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{tc('nameRequired')}</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="PT Example Indonesia" />
              </div>
              <div>
                <Label className="text-xs">{tc('type')}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VENDOR">{tc('vendor')}</SelectItem>
                    <SelectItem value="CLIENT">{tc('client')}</SelectItem>
                    <SelectItem value="EMPLOYEE">{tc('employee')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">NPWP</Label>
                <Input value={form.npwp} onChange={e => setForm({ ...form, npwp: e.target.value })} placeholder="XX.XXX.XXX.X-XXX.XXX" className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">{tc('nikLabel')}</Label>
                <Input value={form.nik} onChange={e => setForm({ ...form, nik: e.target.value })} placeholder="16 digit" className="font-mono" maxLength={16} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Alamat</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Jl. Example No. 123, Jakarta" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{tc('phone')}</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="021-12345678" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="finance@example.com" />
              </div>
            </div>
            {/* Tax Classification Fields */}
            <div className="p-3 bg-gray-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-gray-600">Tax Classification (Resolution Engine)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">KBLI Code</Label>
                  <Input className="h-8 text-xs font-mono" value={form.kbliCode} onChange={e => setForm({ ...form, kbliCode: e.target.value })} placeholder="62010" />
                </div>
                <div>
                  <Label className="text-xs">Qualification (SBU)</Label>
                  <Select value={form.qualificationGrade} onValueChange={v => setForm({ ...form, qualificationGrade: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="N/A" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">N/A</SelectItem>
                      <SelectItem value="SMALL">{tc('qualSmall')}</SelectItem>
                      <SelectItem value="MEDIUM_LARGE">Menengah/Besar</SelectItem>
                      <SelectItem value="QUALIFIED">Berkualifikasi</SelectItem>
                      <SelectItem value="NONE">Tanpa Kualifikasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Country</Label>
                  <Input className="h-8 text-xs" value={form.country} onChange={e => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="ID" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="related" checked={form.isRelatedParty} onChange={e => setForm({ ...form, isRelatedParty: e.target.checked })} className="rounded" />
                  <label htmlFor="related" className="text-xs">{tc('relatedPartyLabel')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="resident" checked={form.isResident} onChange={e => setForm({ ...form, isResident: e.target.checked })} className="rounded" />
                  <label htmlFor="resident" className="text-xs">{tc('residentLabel')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="cod" checked={form.hasCod} onChange={e => setForm({ ...form, hasCod: e.target.checked })} className="rounded" />
                  <label htmlFor="cod" className="text-xs">{tc('codLabel')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="owner" checked={form.vendorIsPropertyOwner} onChange={e => setForm({ ...form, vendorIsPropertyOwner: e.target.checked })} className="rounded" />
                  <label htmlFor="owner" className="text-xs">Owner = Vendor</label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={resetForm}>{tc('cancel')}</Button>
              <Button onClick={handleSave} disabled={isSaving || !form.name}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                {editingId ? tc('update') : tc('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder={tc('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('allTypes')}</SelectItem>
            <SelectItem value="VENDOR">{tc('vendor')}</SelectItem>
            <SelectItem value="CLIENT">{tc('client')}</SelectItem>
            <SelectItem value="EMPLOYEE">{tc('employee')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{search ? tc('notFound') : tc('noCounterparties')}</p>
            {!search && !showForm && (
              <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-1" />{tc('addFirst')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(cp => {
            const tCfg = typeConfig[cp.type] || typeConfig.VENDOR;
            const Icon = tCfg.icon;
            return (
              <Card key={cp.id} className="border-0 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${cp.type === 'VENDOR' ? 'from-blue-500 to-indigo-600' : cp.type === 'CLIENT' ? 'from-green-500 to-emerald-600' : 'from-purple-500 to-violet-600'}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{cp.name}</h3>
                        <Badge className={`text-[10px] ${tCfg.color}`}>{tCfg.label}</Badge>
                        {cp.is_related_party && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Related
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5">
                        {cp.npwp && <span className="font-mono">{cp.npwp}</span>}
                        {cp.address && <span className="truncate max-w-[200px]">{cp.address}</span>}
                        {cp.phone && <span>{cp.phone}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(cp)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-6">
        {tc('countLabel', { count: filtered.length })}
      </p>
    </div>
  );
}
