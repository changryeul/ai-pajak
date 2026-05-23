'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
  FileText, Receipt, Loader2, CheckCircle, AlertTriangle,
  Plus, DollarSign, Globe, Shield, ClipboardList, Send,
  Sparkles, BarChart3, Upload, Download, Trash2, UserPlus, Camera,
} from 'lucide-react';
import { generateTemplate } from '@/lib/tax/bulk-import/csv-parser';

// Types
interface Transaction {
  id: string;
  transaction_date: string;
  service_type?: string;
  income_type?: string;
  gross_amount: number;
  tax_rate: number;
  tax_amount: number;
  counterparty_name?: string;
  recipient_name?: string;
  counterparty_npwp?: string;
  recipient_country?: string;
  treaty_applied?: boolean;
  bukti_potong_number?: string;
}

type TabId = 'transactions' | 'ebupot' | 'filing';
type TaxType = 'PPh23' | 'PPh26';

const SERVICE_TYPES = [
  { value: 'JASA_TEKNIK', label: 'Jasa Teknik (2%)' },
  { value: 'JASA_MANAJEMEN', label: 'Jasa Manajemen (2%)' },
  { value: 'JASA_KONSULTAN', label: 'Jasa Konsultan (2%)' },
  { value: 'JASA_LAINNYA', label: 'Jasa Lainnya (2%)' },
  { value: 'SEWA', label: 'Sewa (2%)' },
  { value: 'DIVIDEN', label: 'Dividen (15%)' },
  { value: 'BUNGA', label: 'Bunga (15%)' },
  { value: 'ROYALTI', label: 'Royalti (15%)' },
];

const INCOME_TYPES = [
  { value: 'dividend', label: 'Dividen' },
  { value: 'interest', label: 'Bunga' },
  { value: 'royalty', label: 'Royalti' },
  { value: 'service', label: 'Jasa Teknik/Manajemen' },
];

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }
function pct(n: number) { return `${(n * 100).toFixed(n % 0.01 === 0 ? 0 : 2)}%`; }

export default function SPTMasaPage() {
  const t = useTranslations('sptMasa');
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // State
  const [activeTab, setActiveTab] = useState<TabId>('transactions');
  const [taxType, setTaxType] = useState<TaxType>('PPh23');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<{ totalGross: number; totalTax: number; transactionCount: number }>({ totalGross: 0, totalTax: 0, transactionCount: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Transaction form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    serviceType: 'JASA_TEKNIK',
    incomeType: 'service',
    grossAmount: '',
    counterpartyId: '',
    counterpartyName: '',
    counterpartyNpwp: '',
    recipientCountry: '',
    hasCod: false,
    description: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [resolution, setResolution] = useState<{ rate: number; reason: string } | null>(null);

  // CSV Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ totalRows: number; insertedCount: number; errorRows: number; errors?: Array<{ row: number; error: string }> } | null>(null);

  // Counterparty search
  const [counterparties, setCounterparties] = useState<Array<{ id: string; name: string; npwp: string }>>([]);
  const [cpSearch, setCpSearch] = useState('');
  const [showCpDropdown, setShowCpDropdown] = useState(false);

  // Customer selection — common hook handles consultant /api/customers
  // loading + auto-select. CUSTOMER role uses their own session.customerId.
  // (Previous hand-rolled fetch above also read `data.data` instead of the
  // correct `data.customers` shape, so consultants never got a populated
  // dropdown.)
  const {
    customerId: effectiveCustomerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
  } = useEffectiveCustomerId();

  const period = `${year}-${String(month).padStart(2, '0')}`;

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!effectiveCustomerId) return;
    setIsLoading(true);
    try {
      const endpoint = taxType === 'PPh23' ? 'pph23-transactions' : 'pph26-transactions';
      const res = await fetch(`/api/tax/${endpoint}?customerId=${effectiveCustomerId}&period=${period}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data.transactions || []);
        setSummary(data.data.summary || { totalGross: 0, totalTax: 0, transactionCount: 0 });
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [effectiveCustomerId, taxType, period]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // Load counterparties for autocomplete
  const loadCounterparties = useCallback(async () => {
    if (!effectiveCustomerId) return;
    try {
      const res = await fetch(`/api/tax/counterparties?customerId=${effectiveCustomerId}`);
      const data = await res.json();
      if (data.success) setCounterparties(data.data || []);
    } catch { /* */ }
  }, [effectiveCustomerId]);

  useEffect(() => { loadCounterparties(); }, [loadCounterparties]);

  // Preview rate with Resolution Engine
  const previewRate = async () => {
    const amount = parseFloat(formData.grossAmount);
    if (!amount || amount <= 0) return;

    try {
      const res = await fetch('/api/tax/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossAmount: amount,
          serviceCategory: taxType === 'PPh26' ? formData.incomeType.toUpperCase() : 'SERVICE',
          recipientType: taxType === 'PPh26' ? 'NON_RESIDENT' : 'RESIDENT',
          recipientNpwp: formData.counterpartyNpwp,
          recipientCountry: formData.recipientCountry,
          hasCertificateOfDomicile: formData.hasCod,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResolution({
          rate: data.data.resolution.rate,
          reason: data.data.resolution.reason,
        });
      }
    } catch { /* */ }
  };

  // Validate form
  const validateForm = (): string | null => {
    const amount = parseFloat(formData.grossAmount);
    if (!amount || amount <= 0) return t('validationGrossPositive');
    if (amount > 999_999_999_999) return t('validationGrossTooLarge');
    if (!formData.counterpartyName.trim()) return t('validationCounterpartyRequired');
    if (formData.counterpartyNpwp && !/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/.test(formData.counterpartyNpwp) && formData.counterpartyNpwp.length > 0 && formData.counterpartyNpwp.length < 15) {
      return t('validationNpwpInvalid');
    }
    if (taxType === 'PPh26') {
      if (!formData.recipientCountry || formData.recipientCountry.length !== 2) return t('validationCountryCode');
    }
    return null;
  };

  // Save transaction
  const saveTransaction = async () => {
    if (!effectiveCustomerId) return;

    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    const amount = parseFloat(formData.grossAmount);
    if (!amount || amount <= 0) return;

    setIsSaving(true);
    try {
      const endpoint = taxType === 'PPh23' ? 'pph23-transactions' : 'pph26-transactions';
      const body = taxType === 'PPh23'
        ? {
            customerId: effectiveCustomerId,
            taxPeriod: period,
            serviceType: formData.serviceType,
            grossAmount: amount,
            counterpartyId: formData.counterpartyId || undefined,
            counterpartyName: formData.counterpartyName,
            counterpartyNpwp: formData.counterpartyNpwp,
            description: formData.description,
          }
        : {
            customerId: effectiveCustomerId,
            taxPeriod: period,
            incomeType: formData.incomeType,
            grossAmount: amount,
            counterpartyId: formData.counterpartyId || undefined,
            recipientName: formData.counterpartyName,
            recipientCountry: formData.recipientCountry,
            hasCod: formData.hasCod,
            description: formData.description,
          };

      const res = await fetch(`/api/tax/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('transactionSaved') });
        setShowForm(false);
        setResolution(null);
        setFormData({ serviceType: 'JASA_TEKNIK', incomeType: 'service', grossAmount: '', counterpartyId: '', counterpartyName: '', counterpartyNpwp: '', recipientCountry: '', hasCod: false, description: '' });
        loadTransactions();
      } else {
        setMessage({ type: 'error', text: data.error || t('errorSave') });
      }
    } catch { setMessage({ type: 'error', text: t('errorGeneral') }); }
    finally { setIsSaving(false); setTimeout(() => setMessage(null), 3000); }
  };

  // CSV Upload handler
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveCustomerId) return;

    setIsSaving(true);
    setUploadResult(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/tax/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: taxType,
          csvContent: text,
          customerId: effectiveCustomerId,
          taxPeriod: period,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUploadResult(data.data);
        setMessage({ type: 'success', text: t('csvImportResult', { inserted: data.data.insertedCount, total: data.data.totalRows }) });
        loadTransactions();
      } else {
        setMessage({ type: 'error', text: data.error || t('errorSave') });
      }
    } catch { setMessage({ type: 'error', text: t('errorGeneral') }); }
    finally { setIsSaving(false); e.target.value = ''; setTimeout(() => setMessage(null), 5000); }
  };

  const downloadTemplate = () => {
    const csv = generateTemplate(taxType as 'PPh23' | 'PPh21' | 'PPN');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${taxType}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate Bukti Potong
  const generateBupot = async () => {
    if (!effectiveCustomerId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/ebupot-pph23', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: effectiveCustomerId, period }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `${data.data.generated} Bukti Potong generated` });
        loadTransactions();
      }
    } catch { setMessage({ type: 'error', text: t('errorGeneral') }); }
    finally { setIsSaving(false); setTimeout(() => setMessage(null), 3000); }
  };

  // Create SPT Masa DRAFT
  const createSptMasaDraft = async (sptTaxType: string) => {
    if (!effectiveCustomerId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/spt-masa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: effectiveCustomerId, taxType: sptTaxType, period }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('draftCreated') });
      } else {
        setMessage({ type: 'error', text: data.error || t('errorSave') });
      }
    } catch { setMessage({ type: 'error', text: t('errorGeneral') }); }
    finally { setIsSaving(false); setTimeout(() => setMessage(null), 3000); }
  };

  // Export to Excel
  const exportExcel = async () => {
    if (!effectiveCustomerId) return;
    try {
      const res = await fetch('/api/tax/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: taxType, customerId: effectiveCustomerId, period }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${taxType}_${period}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || t('errorSave') });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch { /* */ }
  };

  // Scan invoice with AI
  const [isScanning, setIsScanning] = useState(false);
  const handleInvoiceScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch('/api/tax/classify-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (data.success) {
          const c = data.data.classification;
          setFormData({
            ...formData,
            grossAmount: String(c.grossAmount || ''),
            counterpartyName: c.counterpartyName || '',
            counterpartyNpwp: c.counterpartyNpwp || '',
            description: c.description || '',
            serviceType: c.serviceCode || 'JASA_LAINNYA',
          });
          if (data.data.resolution) {
            setResolution({ rate: data.data.resolution.rate, reason: data.data.resolution.reason });
          }
          setShowForm(true);
          setMessage({ type: 'success', text: t('aiClassified', { confidence: Math.round(c.confidence * 100) }) });
        } else {
          setMessage({ type: 'error', text: data.error || t('errorSave') });
        }
        setIsScanning(false);
        setTimeout(() => setMessage(null), 5000);
      };
      reader.readAsDataURL(file);
    } catch { setIsScanning(false); setMessage({ type: 'error', text: t('errorGeneral') }); }
    finally { e.target.value = ''; }
  };

  // Delete transaction
  const deleteTransaction = async (txId: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      const endpoint = taxType === 'PPh23' ? 'pph23-transactions' : 'pph26-transactions';
      const res = await fetch(`/api/tax/${endpoint}?id=${txId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('deleted') });
        loadTransactions();
      } else {
        setMessage({ type: 'error', text: data.error || t('errorSave') });
      }
    } catch { setMessage({ type: 'error', text: t('errorGeneral') }); }
    finally { setTimeout(() => setMessage(null), 3000); }
  };

  // Add new counterparty inline
  const [showNewCp, setShowNewCp] = useState(false);
  const [newCpName, setNewCpName] = useState('');
  const [newCpNpwp, setNewCpNpwp] = useState('');

  const saveNewCounterparty = async () => {
    if (!effectiveCustomerId || !newCpName) return;
    try {
      const res = await fetch('/api/tax/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: effectiveCustomerId, name: newCpName, npwp: newCpNpwp, type: 'VENDOR' }),
      });
      const data = await res.json();
      if (data.success) {
        setFormData({ ...formData, counterpartyId: data.data?.id || '', counterpartyName: newCpName, counterpartyNpwp: newCpNpwp });
        setShowNewCp(false);
        setNewCpName('');
        setNewCpNpwp('');
        loadCounterparties();
        setMessage({ type: 'success', text: t('counterpartySaved') });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch { /* */ }
  };

  // Download SPT Masa PDF
  const downloadSptMasaPDF = async (sptTaxType: string) => {
    if (!effectiveCustomerId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/spt-masa-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: effectiveCustomerId, taxType: sptTaxType, period }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SPT_Masa_${sptTaxType}_${period}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setMessage({ type: 'error', text: t('errorSave') });
      }
    } catch { setMessage({ type: 'error', text: t('errorGeneral') }); }
    finally { setIsSaving(false); setTimeout(() => setMessage(null), 3000); }
  };

  const tabs: Array<{ id: TabId; label: string; icon: typeof FileText }> = [
    { id: 'transactions', label: t('transactionsTab'), icon: Receipt },
    { id: 'ebupot', label: t('ebupotTab'), icon: ClipboardList },
    { id: 'filing', label: t('filingTab'), icon: Send },
  ];

  const bupotGenerated = transactions.filter(tx => tx.bukti_potong_number).length;
  const bupotPending = transactions.filter(tx => !tx.bukti_potong_number).length;

  if (!session) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-4" />
        <p className="text-gray-500 text-sm">{t('loadingSession')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-indigo-200 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />{t('title')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('title')}</h1>
          <p className="text-indigo-200 mt-2 text-sm">{t('subtitle')}</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-200 text-xs">{t('totalGross')}</p>
              <p className="font-bold text-lg">{fmt(summary.totalGross)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-200 text-xs">{t('totalTax')}</p>
              <p className="font-bold text-lg">{fmt(summary.totalTax)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-200 text-xs">{t('transactionCount')}</p>
              <p className="font-bold text-lg">{summary.transactionCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Period + Tax Type + Customer Selectors */}
      <div className="flex flex-wrap gap-3 mb-6">
        {isConsultant && customers.length > 0 && (
          <Select value={selectedCustomerId} onValueChange={v => setSelectedCustomerId(v)}>
            <SelectTrigger className="w-52"><SelectValue placeholder={t('selectCustomer')} /></SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.customer_type === 'INDIVIDUAL'
                    ? c.full_name
                    : c.company_name || c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={taxType} onValueChange={(v) => setTaxType(v as TaxType)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PPh23">PPh 23 (Resident)</SelectItem>
            <SelectItem value="PPh26">PPh 26 (Non-Resident)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {new Date(2024, i).toLocaleString(locale, { month: 'long' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Transactions */}
      {activeTab === 'transactions' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">
              {taxType === 'PPh23' ? 'PPh 23 Transactions' : 'PPh 26 Transactions'} — {period}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportExcel} disabled={transactions.length === 0}>
                <Download className="h-3 w-3 mr-1" />Excel
              </Button>
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="h-3 w-3 mr-1" />Template
              </Button>
              <label className="cursor-pointer">
                <Button size="sm" variant="outline" asChild>
                  <span><Upload className="h-3 w-3 mr-1" />CSV Upload</span>
                </Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              </label>
              <label className="cursor-pointer">
                <Button size="sm" variant="outline" asChild disabled={isScanning}>
                  <span>{isScanning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Camera className="h-3 w-3 mr-1" />}AI Scan</span>
                </Button>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleInvoiceScan} capture="environment" />
              </label>
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-1" />{t('addTransaction')}
              </Button>
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
              <p className="font-medium text-indigo-800">
                {t('csvImportResult', { inserted: uploadResult.insertedCount, total: uploadResult.totalRows })}
                {uploadResult.errorRows > 0 && <span className="text-red-600 ml-2">{t('csvImportErrors', { count: uploadResult.errorRows })}</span>}
              </p>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-2 max-h-20 overflow-y-auto">
                  {uploadResult.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-red-500">Row {err.row}: {err.error}</p>
                  ))}
                  {uploadResult.errors.length > 5 && <p className="text-gray-400">{t('csvImportMoreErrors', { count: uploadResult.errors.length - 5 })}</p>}
                </div>
              )}
            </div>
          )}

          {/* Transaction Form */}
          {showForm && (
            <Card className="mb-4 border-indigo-200 shadow-md">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {taxType === 'PPh23' ? (
                    <div>
                      <Label className="text-xs">{t('serviceType')}</Label>
                      <Select value={formData.serviceType} onValueChange={v => setFormData({ ...formData, serviceType: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs">{t('incomeType')}</Label>
                        <Select value={formData.incomeType} onValueChange={v => setFormData({ ...formData, incomeType: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INCOME_TYPES.map(it => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">{t('recipientCountry')}</Label>
                        <Input className="h-9" placeholder="KR, SG, JP..." value={formData.recipientCountry} onChange={e => setFormData({ ...formData, recipientCountry: e.target.value.toUpperCase() })} />
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-xs">{t('grossAmount')}</Label>
                    <Input className="h-9 font-mono" type="number" placeholder="100000000" value={formData.grossAmount}
                      onChange={e => { setFormData({ ...formData, grossAmount: e.target.value }); setResolution(null); }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Label className="text-xs">{t('counterparty')}</Label>
                    <Input className="h-9" placeholder="PT ABC..."
                      value={cpSearch || formData.counterpartyName}
                      onChange={e => {
                        setCpSearch(e.target.value);
                        setShowCpDropdown(true);
                        setFormData({ ...formData, counterpartyId: '', counterpartyName: e.target.value, counterpartyNpwp: '' });
                      }}
                      onFocus={() => setShowCpDropdown(true)}
                    />
                    {showCpDropdown && cpSearch.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {counterparties
                          .filter(cp => cp.name.toLowerCase().includes(cpSearch.toLowerCase()) || (cp.npwp && cp.npwp.includes(cpSearch)))
                          .slice(0, 5)
                          .map(cp => (
                            <button key={cp.id} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs border-b last:border-b-0"
                              onClick={() => {
                                setFormData({ ...formData, counterpartyId: cp.id, counterpartyName: cp.name, counterpartyNpwp: cp.npwp || '' });
                                setCpSearch('');
                                setShowCpDropdown(false);
                              }}>
                              <span className="font-medium">{cp.name}</span>
                              {cp.npwp && <span className="text-gray-400 ml-2 font-mono">{cp.npwp}</span>}
                            </button>
                          ))}
                        {counterparties.filter(cp => cp.name.toLowerCase().includes(cpSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2">
                            <p className="text-xs text-gray-400 mb-1">{t('noMatchFound')}</p>
                            <button className="text-xs text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-800"
                              onClick={() => { setShowCpDropdown(false); setShowNewCp(true); setNewCpName(cpSearch); }}>
                              <UserPlus className="h-3 w-3" />{t('registerNew')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">NPWP</Label>
                    <Input className="h-9 font-mono" placeholder="01.234.567.8-901.234" value={formData.counterpartyNpwp}
                      onChange={e => setFormData({ ...formData, counterpartyNpwp: e.target.value })}
                      disabled={!!formData.counterpartyId} />
                  </div>
                </div>

                {taxType === 'PPh26' && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="cod" checked={formData.hasCod} onChange={e => setFormData({ ...formData, hasCod: e.target.checked })} className="rounded" />
                    <Label htmlFor="cod" className="text-xs cursor-pointer">{t('hasCod')}</Label>
                  </div>
                )}

                {/* Inline Counterparty Registration */}
                {showNewCp && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                    <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1"><UserPlus className="h-3 w-3" />{t('registerCounterparty')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input className="h-8 text-xs" placeholder="Name" value={newCpName} onChange={e => setNewCpName(e.target.value)} />
                      <Input className="h-8 text-xs font-mono" placeholder="NPWP" value={newCpNpwp} onChange={e => setNewCpNpwp(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewCp(false)}>Cancel</Button>
                      <Button size="sm" className="h-7 text-xs bg-indigo-600" onClick={saveNewCounterparty}>Register</Button>
                    </div>
                  </div>
                )}

                {/* Rate Preview */}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={previewRate} disabled={!formData.grossAmount}>
                    <Sparkles className="h-3 w-3 mr-1" />{t('autoRate')}
                  </Button>
                  {resolution && (
                    <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-xs">
                      <span className="font-bold text-indigo-700">{t('resolvedRate')}: {pct(resolution.rate)}</span>
                      <span className="text-indigo-600 ml-2">— {resolution.reason}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setResolution(null); }}>{t('cancel')}</Button>
                  <Button size="sm" onClick={saveTransaction} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction List */}
          {isLoading ? (
            <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('noTransactions')}</p>
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2.5 px-3">Date</th>
                        <th className="text-left py-2.5 px-3">{taxType === 'PPh23' ? 'Service' : 'Income'}</th>
                        <th className="text-left py-2.5 px-3">{t('counterparty')}</th>
                        <th className="text-right py-2.5 px-3">DPP</th>
                        <th className="text-right py-2.5 px-3">Rate</th>
                        <th className="text-right py-2.5 px-3">Tax</th>
                        <th className="text-center py-2.5 px-3">BP</th>
                        <th className="text-center py-2.5 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="py-2 px-3 text-xs text-gray-500">{tx.transaction_date}</td>
                          <td className="py-2 px-3 text-xs">{tx.service_type || tx.income_type}</td>
                          <td className="py-2 px-3 text-xs">
                            {tx.counterparty_name || tx.recipient_name}
                            {tx.recipient_country && <Badge variant="outline" className="ml-1 text-[10px]">{tx.recipient_country}</Badge>}
                            {tx.treaty_applied && <Badge className="ml-1 text-[10px] bg-green-100 text-green-700">P3B</Badge>}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{fmt(tx.gross_amount)}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{pct(tx.tax_rate)}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs font-medium">{fmt(tx.tax_amount)}</td>
                          <td className="py-2 px-3 text-center">
                            {tx.bukti_potong_number ? (
                              <Badge variant="outline" className="text-[10px] text-green-600">{tx.bukti_potong_number}</Badge>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button onClick={() => deleteTransaction(tx.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: e-Bupot */}
      {activeTab === 'ebupot' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">e-Bupot — {period}</h2>
            <Button size="sm" onClick={generateBupot} disabled={isSaving || bupotPending === 0}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardList className="h-4 w-4 mr-1" />}
              {t('generateBupot')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100"><CheckCircle className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">{t('bupotGenerated')}</p>
                  <p className="text-xl font-bold">{bupotGenerated}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">{t('bupotPending')}</p>
                  <p className="text-xl font-bold">{bupotPending}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Generated Bupot list */}
          {transactions.filter(tx => tx.bukti_potong_number).length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500 text-xs">
                      <th className="text-left py-2.5 px-3">{t('bupotNumber')}</th>
                      <th className="text-left py-2.5 px-3">{t('counterparty')}</th>
                      <th className="text-right py-2.5 px-3">DPP</th>
                      <th className="text-right py-2.5 px-3">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.filter(tx => tx.bukti_potong_number).map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs text-indigo-600">{tx.bukti_potong_number}</td>
                        <td className="py-2 px-3 text-xs">{tx.counterparty_name || tx.recipient_name}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{fmt(tx.gross_amount)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs font-medium">{fmt(tx.tax_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 3: SPT Masa Filing */}
      {activeTab === 'filing' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">{t('filingTab')} — {period}</h2>

          {['PPh21', 'PPh23', 'PPh_FINAL', 'PPN'].map(sptType => {
            const config: Record<string, { icon: typeof FileText; gradient: string; label: string }> = {
              PPh21: { icon: FileText, gradient: 'from-blue-500 to-indigo-600', label: 'SPT Masa PPh 21' },
              PPh23: { icon: Receipt, gradient: 'from-emerald-500 to-green-600', label: 'SPT Masa PPh 23' },
              PPh_FINAL: { icon: Shield, gradient: 'from-amber-500 to-yellow-600', label: 'SPT Masa PPh 4(2) Final' },
              PPN: { icon: DollarSign, gradient: 'from-orange-500 to-red-500', label: 'SPT Masa PPN' },
            };
            const c = config[sptType];
            const Icon = c.icon;

            return (
              <Card key={sptType} className="border-0 shadow-sm">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${c.gradient}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{c.label}</p>
                      <p className="text-xs text-gray-500">{period}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => downloadSptMasaPDF(sptType)} disabled={isSaving}>
                      <Download className="h-3 w-3 mr-1" />PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => createSptMasaDraft(sptType)} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3 mr-1" />}
                      {t('createDraft')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Info */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <Shield className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">{t('djpSubmitInfo')}</p>
              <p>{t('djpSubmitDesc')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
