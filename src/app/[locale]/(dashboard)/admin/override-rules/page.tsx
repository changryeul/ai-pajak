'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Plus, Save, Loader2, CheckCircle, AlertTriangle,
  Trash2, Power, Edit2, Sparkles, X,
} from 'lucide-react';

interface OverrideRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  condition_service_category: string | null;
  condition_recipient_type: string | null;
  condition_vendor_is_owner: boolean | null;
  condition_is_related_party: boolean | null;
  condition_kbli_pattern: string | null;
  condition_country: string | null;
  result_tax_type: string;
  result_rate: number;
  result_is_final: boolean;
  result_reason: string;
  result_legal_basis: string;
  created_at: string;
}

const SERVICE_CATEGORIES = ['', 'SERVICE', 'CONSTRUCTION', 'RENTAL', 'EMPLOYMENT', 'DIVIDEND', 'INTEREST', 'ROYALTY', 'IMPORT', 'SHIPPING', 'OTHER'];
const RECIPIENT_TYPES = ['', 'RESIDENT', 'NON_RESIDENT'];
const TAX_TYPES = ['PPh21', 'PPh23', 'PPh26', 'PPh4_2', 'PPh22', 'PPh15', 'PPN'];

function pct(n: number) { return `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2)}%`; }

const emptyForm = {
  name: '', description: '', priority: '100',
  conditionServiceCategory: '', conditionRecipientType: '',
  conditionVendorIsOwner: '', conditionIsRelatedParty: '',
  conditionKbliPattern: '', conditionCountry: '',
  resultTaxType: 'PPh23', resultRate: '', resultIsFinal: 'false',
  resultReason: '', resultLegalBasis: '',
};

export default function OverrideRulesAdmin() {
  const [rules, setRules] = useState<OverrideRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/override-rules');
      const data = await res.json();
      if (data.success) setRules(data.data || []);
    } catch { /* */ }
    finally { setIsLoading(false); }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const startEdit = (rule: OverrideRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || '',
      priority: String(rule.priority),
      conditionServiceCategory: rule.condition_service_category || '',
      conditionRecipientType: rule.condition_recipient_type || '',
      conditionVendorIsOwner: rule.condition_vendor_is_owner === null ? '' : String(rule.condition_vendor_is_owner),
      conditionIsRelatedParty: rule.condition_is_related_party === null ? '' : String(rule.condition_is_related_party),
      conditionKbliPattern: rule.condition_kbli_pattern || '',
      conditionCountry: rule.condition_country || '',
      resultTaxType: rule.result_tax_type,
      resultRate: String(rule.result_rate),
      resultIsFinal: String(rule.result_is_final),
      resultReason: rule.result_reason,
      resultLegalBasis: rule.result_legal_basis,
    });
    setShowForm(true);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const saveRule = async () => {
    if (!form.name || !form.resultRate || !form.resultReason || !form.resultLegalBasis) {
      showMsg('error', 'Name, Rate, Reason, Legal Basis are required');
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name,
        description: form.description || null,
        priority: parseInt(form.priority) || 100,
        conditionServiceCategory: form.conditionServiceCategory || null,
        conditionRecipientType: form.conditionRecipientType || null,
        conditionVendorIsOwner: form.conditionVendorIsOwner === '' ? null : form.conditionVendorIsOwner === 'true',
        conditionIsRelatedParty: form.conditionIsRelatedParty === '' ? null : form.conditionIsRelatedParty === 'true',
        conditionKbliPattern: form.conditionKbliPattern || null,
        conditionCountry: form.conditionCountry || null,
        resultTaxType: form.resultTaxType,
        resultRate: parseFloat(form.resultRate),
        resultIsFinal: form.resultIsFinal === 'true',
        resultReason: form.resultReason,
        resultLegalBasis: form.resultLegalBasis,
      };

      const res = await fetch('/api/admin/override-rules', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', editingId ? 'Rule updated' : 'Rule created');
        setShowForm(false);
        setEditingId(null);
        loadRules();
      } else {
        showMsg('error', data.error || 'Failed');
      }
    } catch { showMsg('error', 'Error saving'); }
    finally { setIsSaving(false); }
  };

  const toggleActive = async (rule: OverrideRule) => {
    try {
      const res = await fetch('/api/admin/override-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `Rule ${rule.is_active ? 'deactivated' : 'activated'}`);
        loadRules();
      }
    } catch { showMsg('error', 'Error'); }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-violet-200 text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />Admin — Tax Override Rules
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">Override Rule 관리</h1>
            <p className="text-violet-200 mt-2 text-sm">
              Resolution Engine의 최우선 규칙을 관리합니다. 모든 조건이 일치하면 다른 규칙보다 우선 적용됩니다.
            </p>
          </div>
          <Button onClick={startCreate} className="bg-white/20 hover:bg-white/30 text-white border-0">
            <Plus className="h-4 w-4 mr-1" />New Rule
          </Button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="mb-6 border-violet-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              {editingId ? 'Edit Rule' : 'New Override Rule'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Rule Name *</Label>
                <Input className="h-9" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Related Party Service Override" />
              </div>
              <div>
                <Label className="text-xs">Priority (높을수록 우선)</Label>
                <Input className="h-9 font-mono" type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input className="h-9" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>

            {/* Conditions */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-2">Conditions (비어있으면 해당 조건 무시)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Service Category</Label>
                  <Select value={form.conditionServiceCategory} onValueChange={v => setForm({ ...form, conditionServiceCategory: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map(c => <SelectItem key={c || 'any'} value={c || 'any'}>{c || '(Any)'}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Recipient Type</Label>
                  <Select value={form.conditionRecipientType} onValueChange={v => setForm({ ...form, conditionRecipientType: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      {RECIPIENT_TYPES.map(r => <SelectItem key={r || 'any'} value={r || 'any'}>{r || '(Any)'}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Country (ISO 2자리)</Label>
                  <Input className="h-9" value={form.conditionCountry} onChange={e => setForm({ ...form, conditionCountry: e.target.value.toUpperCase() })} placeholder="e.g., KR" />
                </div>
                <div>
                  <Label className="text-xs">Vendor = Owner</Label>
                  <Select value={form.conditionVendorIsOwner} onValueChange={v => setForm({ ...form, conditionVendorIsOwner: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">(Any)</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Related Party</Label>
                  <Select value={form.conditionIsRelatedParty} onValueChange={v => setForm({ ...form, conditionIsRelatedParty: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">(Any)</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">KBLI Pattern</Label>
                  <Input className="h-9 font-mono" value={form.conditionKbliPattern} onChange={e => setForm({ ...form, conditionKbliPattern: e.target.value })} placeholder="e.g., 41%" />
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="p-3 bg-violet-50 rounded-lg">
              <p className="text-xs font-semibold text-violet-700 mb-2">Result (매칭 시 적용)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Tax Type *</Label>
                  <Select value={form.resultTaxType} onValueChange={v => setForm({ ...form, resultTaxType: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TAX_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Rate (소수점) *</Label>
                  <Input className="h-9 font-mono" value={form.resultRate} onChange={e => setForm({ ...form, resultRate: e.target.value })} placeholder="e.g., 0.10 for 10%" />
                </div>
                <div>
                  <Label className="text-xs">Final Tax</Label>
                  <Select value={form.resultIsFinal} onValueChange={v => setForm({ ...form, resultIsFinal: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes (Final)</SelectItem>
                      <SelectItem value="false">No (Creditable)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Reason (판단 근거) *</Label>
                <Input className="h-9" value={form.resultReason} onChange={e => setForm({ ...form, resultReason: e.target.value })} placeholder="e.g., Related party — treated as rental" />
              </div>
              <div className="mt-2">
                <Label className="text-xs">Legal Basis (법적 근거) *</Label>
                <Input className="h-9" value={form.resultLegalBasis} onChange={e => setForm({ ...form, resultLegalBasis: e.target.value })} placeholder="e.g., PP 34/2017 Pasal 4(2)" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="h-3 w-3 mr-1" />Cancel
              </Button>
              <Button size="sm" onClick={saveRule} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-600" /></div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Override Rule이 없습니다</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={startCreate}><Plus className="h-3 w-3 mr-1" />Add First Rule</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id} className={`border-0 shadow-sm ${!rule.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={rule.is_active ? 'default' : 'secondary'} className={rule.is_active ? 'bg-violet-100 text-violet-700' : ''}>
                        P{rule.priority}
                      </Badge>
                      <span className="font-semibold text-sm">{rule.name}</span>
                      <Badge variant="outline" className="text-xs">{rule.result_tax_type}</Badge>
                      <Badge variant="outline" className="text-xs font-mono">{pct(rule.result_rate)}</Badge>
                      {rule.result_is_final && <Badge className="text-[10px] bg-amber-100 text-amber-700">Final</Badge>}
                      {!rule.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                    </div>
                    {rule.description && <p className="text-xs text-gray-500 mb-2">{rule.description}</p>}

                    {/* Conditions */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {rule.condition_service_category && <Badge variant="outline" className="text-[10px]">Category: {rule.condition_service_category}</Badge>}
                      {rule.condition_recipient_type && <Badge variant="outline" className="text-[10px]">Recipient: {rule.condition_recipient_type}</Badge>}
                      {rule.condition_vendor_is_owner !== null && <Badge variant="outline" className="text-[10px]">Owner: {rule.condition_vendor_is_owner ? 'Yes' : 'No'}</Badge>}
                      {rule.condition_is_related_party !== null && <Badge variant="outline" className="text-[10px]">Related: {rule.condition_is_related_party ? 'Yes' : 'No'}</Badge>}
                      {rule.condition_kbli_pattern && <Badge variant="outline" className="text-[10px] font-mono">KBLI: {rule.condition_kbli_pattern}</Badge>}
                      {rule.condition_country && <Badge variant="outline" className="text-[10px]">Country: {rule.condition_country}</Badge>}
                    </div>

                    <p className="text-xs text-gray-600">{rule.result_reason}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{rule.result_legal_basis}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 ml-3">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(rule)}><Edit2 className="h-3 w-3 text-gray-400" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(rule)}>
                      <Power className={`h-3 w-3 ${rule.is_active ? 'text-green-500' : 'text-gray-300'}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-800 flex items-start gap-2">
        <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 text-violet-500" />
        <div>
          <p className="font-medium">Override Rule 작동 방식</p>
          <p className="mt-1">모든 non-null 조건이 일치하면 Resolution Engine에서 최우선(Priority 1)으로 적용됩니다. Priority 숫자가 높을수록 먼저 평가됩니다. 비활성화하면 적용되지 않습니다.</p>
        </div>
      </div>
    </div>
  );
}
