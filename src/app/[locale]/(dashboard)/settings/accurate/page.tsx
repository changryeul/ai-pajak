'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getAppUrl } from '@/lib/app-url';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, CheckCircle, AlertTriangle, RefreshCw, Unlink, Database, FileText, Sparkles } from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface Database { id: number; alias: string; dbName: string; }
interface Customer { id: string; full_name: string; company_name?: string; }
interface ConnectionInfo {
  host: string;
  database_name: string;
  sync_status: string;
  last_sync_at: string | null;
  last_error: string | null;
  is_active: boolean;
}

interface Classification {
  tax_type: string;
  tax_rate: number;
  tax_base: number;
  calculated_tax: number;
  warnings: string[];
  confidence: string;
}

interface ImportedInvoice {
  id: string;
  invoice_type: 'SALES' | 'PURCHASE';
  invoice_number: string;
  invoice_date: string;
  counterparty_name: string | null;
  counterparty_npwp: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  has_ppn: boolean;
  status: string;
  classifications: Classification[];
}

type ProviderId = 'ACCURATE' | 'MEKARI';

export default function AccountingSettingsPage() {
  useParams();
  const searchParams = useSearchParams();
  const t = useTranslations('accurateSettings');
  const appUrl = getAppUrl();
  const initialProvider = (searchParams.get('provider') === 'MEKARI' ? 'MEKARI' : 'ACCURATE') as ProviderId;

  const PROVIDERS: { id: ProviderId; name: string; requiresDb: boolean; hint: string }[] = [
    { id: 'ACCURATE', name: 'Accurate Online', requiresDb: true, hint: t('accurateHint') },
    { id: 'MEKARI', name: 'Mekari Jurnal', requiresDb: false, hint: t('mekariHint') },
  ];

  const [provider, setProvider] = useState<ProviderId>(initialProvider);
  const currentProvider = PROVIDERS.find(p => p.id === provider)!;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [accessToken, setAccessToken] = useState('');
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<number | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [counts, setCounts] = useState({ sales: 0, purchase: 0 });

  const [loading, setLoading] = useState(false);
  const [listingDbs, setListingDbs] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [invoices, setInvoices] = useState<ImportedInvoice[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().substring(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().substring(0, 10));

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // OAuth callback result feedback (from /api/accounting/callback redirect)
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const oauthMessage = searchParams.get('oauth_message');
    if (oauthStatus === 'success') {
      showMsg('success', t('oauthSuccess'));
    } else if (oauthStatus === 'error') {
      showMsg('error', oauthMessage || t('oauthFailed'));
    }
  }, [searchParams, t]);

  const handleOneClickOAuth = async () => {
    if (!selectedCustomer) {
      showMsg('error', t('selectCustomerFirst'));
      return;
    }
    try {
      const res = await fetch('/api/accounting/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomer, provider }),
      });
      const data = await res.json();
      if (data.success && data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      } else {
        showMsg('error', data.error || t('oauthStartFailed'));
      }
    } catch {
      showMsg('error', t('oauthStartError'));
    }
  };

  // Load customers
  useEffect(() => {
    fetch('/api/customers?type=COMPANY')
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  // Load connection status when customer or provider changes
  useEffect(() => {
    if (!selectedCustomer) {
      setConnection(null);
      setCounts({ sales: 0, purchase: 0 });
      setInvoices([]);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/accounting/sync?customerId=${selectedCustomer}&provider=${provider}`).then(r => r.json()),
      fetch(`/api/accounting/classify?customerId=${selectedCustomer}&provider=${provider}`).then(r => r.json()),
    ]).then(([status, classify]) => {
      if (status.success) {
        const conn = (status.data.connections || []).find((c: { provider: string }) => c.provider === provider) || null;
        setConnection(conn);
        setCounts(status.data.counts?.[provider] || { sales: 0, purchase: 0 });
      }
      if (classify.success) {
        setInvoices(classify.data || []);
      }
    }).finally(() => setLoading(false));
  }, [selectedCustomer, provider]);

  const refreshInvoices = async () => {
    if (!selectedCustomer) return;
    const res = await fetch(`/api/accounting/classify?customerId=${selectedCustomer}&provider=${provider}`);
    const data = await res.json();
    if (data.success) setInvoices(data.data || []);
  };

  const handleListDatabases = async () => {
    if (!accessToken) {
      showMsg('error', t('enterAccessToken'));
      return;
    }
    setListingDbs(true);
    try {
      const res = await fetch(`/api/accounting/connect?provider=${provider}&access_token=${encodeURIComponent(accessToken)}`);
      const data = await res.json();
      if (data.success) {
        setDatabases(data.data || []);
        showMsg('success', t('dbFound', { count: data.data?.length || 0 }));
      } else {
        showMsg('error', data.error || t('dbQueryFailed'));
      }
    } catch {
      showMsg('error', t('dbQueryError'));
    } finally {
      setListingDbs(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedCustomer || !accessToken) {
      showMsg('error', t('enterCustomerAndToken'));
      return;
    }
    if (currentProvider.requiresDb && !selectedDb) {
      showMsg('error', t('selectDb'));
      return;
    }
    setConnecting(true);
    try {
      const db = databases.find(d => d.id === selectedDb);
      const res = await fetch('/api/accounting/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer,
          provider,
          accessToken,
          databaseId: selectedDb || undefined,
          databaseName: db?.alias || db?.dbName || currentProvider.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
        const statusRes = await fetch(`/api/accounting/sync?customerId=${selectedCustomer}&provider=${provider}`);
        const statusData = await statusRes.json();
        if (statusData.success) {
          const conn = (statusData.data.connections || []).find((c: { provider: string }) => c.provider === provider) || null;
          setConnection(conn);
          setCounts(statusData.data.counts?.[provider] || { sales: 0, purchase: 0 });
        }
      } else {
        showMsg('error', data.error);
      }
    } catch {
      showMsg('error', t('connectionError'));
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!selectedCustomer) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/accounting/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer,
          provider,
          fromDate,
          toDate,
          types: ['sales', 'purchase'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
      } else {
        showMsg('error', data.message || data.error || t('syncFailed'));
      }
      const statusRes = await fetch(`/api/accounting/sync?customerId=${selectedCustomer}&provider=${provider}`);
      const statusData = await statusRes.json();
      if (statusData.success) {
        const conn = (statusData.data.connections || []).find((c: { provider: string }) => c.provider === provider) || null;
        setConnection(conn);
        setCounts(statusData.data.counts?.[provider] || { sales: 0, purchase: 0 });
      }
      refreshInvoices();
    } catch {
      showMsg('error', t('syncError'));
    } finally {
      setSyncing(false);
    }
  };

  const handleApplyAll = async () => {
    if (!selectedCustomer) return;
    if (!confirm(t('applyAllConfirm'))) return;
    setApplying(true);
    try {
      const res = await fetch('/api/accounting/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomer, provider, applyToCalculation: true }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
        refreshInvoices();
      } else {
        showMsg('error', data.error || t('applyFailed'));
      }
    } catch {
      showMsg('error', t('applyError'));
    } finally {
      setApplying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedCustomer || !confirm(t('disconnectConfirm', { provider: currentProvider.name }))) return;
    try {
      const res = await fetch(`/api/accounting/connect?customerId=${selectedCustomer}&provider=${provider}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setConnection(null);
        setCounts({ sales: 0, purchase: 0 });
        showMsg('success', t('disconnected'));
      }
    } catch {
      showMsg('error', t('disconnectFailed'));
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('pageDescription')}</p>

        {/* Provider tabs */}
        <div className="mt-4 flex gap-2 border-b">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                provider === p.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">{currentProvider.hint}</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Step 1: Select customer */}
      <Card className="mb-4 border-0 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <h2 className="font-bold text-sm">{t('step1Title')}</h2>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger><SelectValue placeholder={t('selectCustomerPlaceholder')} /></SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name || c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Current connection status */}
      {selectedCustomer && (
        <Card className={`mb-4 border-0 shadow-sm ${connection ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-300'}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Link2 className="h-4 w-4" />{t('connectionStatus')}
                </h2>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-2" />
                ) : connection && connection.is_active ? (
                  <div className="mt-2 space-y-1">
                    <Badge className="bg-green-100 text-green-700">{t('statusConnected')}</Badge>
                    <p className="text-xs text-gray-500">DB: {connection.database_name || '-'}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{connection.host}</p>
                    {connection.last_sync_at && (
                      <p className="text-xs text-gray-500">
                        {t('lastSync')}: {new Date(connection.last_sync_at).toLocaleString('ko-KR')}
                      </p>
                    )}
                    {connection.last_error && (
                      <p className="text-xs text-red-600">{t('errorLabel')}: {connection.last_error}</p>
                    )}
                  </div>
                ) : (
                  <Badge className="bg-gray-100 text-gray-500 mt-2">{t('statusNotConnected')}</Badge>
                )}
              </div>
              {connection?.is_active && (
                <Button size="sm" variant="outline" onClick={handleDisconnect}>
                  <Unlink className="h-3 w-3 mr-1" />{t('disconnectButton')}
                </Button>
              )}
            </div>

            {connection?.is_active && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
                <div>
                  <p className="text-[10px] text-gray-400">{t('importedSalesInvoices')}</p>
                  <p className="font-bold">{t('invoiceCount', { count: counts.sales })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">{t('importedPurchaseInvoices')}</p>
                  <p className="font-bold">{t('invoiceCount', { count: counts.purchase })}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Connect (only if not connected) */}
      {selectedCustomer && !connection?.is_active && (
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-sm">{t('step2Title', { provider: currentProvider.name })}</h2>

            {/* One-click OAuth button (requires env vars) */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
              <p className="text-xs font-medium text-blue-900 mb-2">{t('oauthOneClickTitle')}</p>
              <p className="text-[11px] text-blue-700 mb-2">
                {t('oauthOneClickDescription', { provider: currentProvider.name })}
              </p>
              <Button size="sm" onClick={handleOneClickOAuth} disabled={!selectedCustomer} className="w-full">
                <Link2 className="h-3 w-3 mr-2" />{t('oauthConnectButton', { provider: currentProvider.name })}
              </Button>
            </div>

            <p className="text-[10px] text-gray-400 text-center">{t('orManualToken')}</p>


            {provider === 'ACCURATE' && (
              <details className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3">
                <summary className="cursor-pointer font-medium text-blue-700">
                  {t('accurateTokenGuideTitle')}
                </summary>
                <ol className="mt-2 space-y-2 text-gray-700 list-decimal list-inside">
                  <li>
                    <a href="https://account.accurate.id" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      account.accurate.id
                    </a> {t('accurateStep1')}
                  </li>
                  <li>{t('accurateStep2')}</li>
                  <li>
                    <b>{t('accurateStep3Register')}</b> — Name: <code className="bg-white px-1">AI Pajak</code>, Redirect URI: <code className="bg-white px-1">{appUrl}/api/accounting/callback</code>
                  </li>
                  <li>{t('accurateStep4')}</li>
                  <li>
                    {t('accurateStep5')}
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] break-all border">
                      https://account.accurate.id/oauth/authorize?response_type=code&amp;client_id=<b>YOUR_CLIENT_ID</b>&amp;redirect_uri={appUrl}/api/accounting/callback&amp;scope=item_view+sales_invoice_view+purchase_invoice_view
                    </div>
                  </li>
                  <li>{t('accurateStep6')}</li>
                  <li>
                    {t('accurateStep7')}
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] border whitespace-pre">
{`curl -X POST https://account.accurate.id/oauth/token \\
  -d "grant_type=authorization_code" \\
  -d "code=YOUR_CODE" \\
  -d "redirect_uri=${appUrl}/api/accounting/callback" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
                    </div>
                  </li>
                  <li>{t('accurateStep8')}</li>
                </ol>
                <p className="mt-2 text-[10px] text-amber-700">
                  {t('accurateApiWarning')}
                </p>
              </details>
            )}

            {provider === 'MEKARI' && (
              <details className="text-xs text-gray-500 bg-emerald-50 rounded-lg p-3">
                <summary className="cursor-pointer font-medium text-emerald-700">
                  {t('mekariTokenGuideTitle')}
                </summary>
                <ol className="mt-2 space-y-2 text-gray-700 list-decimal list-inside">
                  <li>
                    <a href="https://mekari.com/developers" target="_blank" rel="noreferrer" className="text-emerald-600 underline">
                      mekari.com/developers
                    </a> {t('mekariStep1')}
                  </li>
                  <li>
                    {t('mekariStep2')}
                  </li>
                  <li>
                    {t('mekariStep3')} — Name: <code className="bg-white px-1">AI Pajak</code>, Redirect URI:{' '}
                    <code className="bg-white px-1">{appUrl}/api/accounting/callback</code>
                  </li>
                  <li>
                    {t('mekariStep4')} <code className="bg-white px-1">sales_invoice:read</code>, <code className="bg-white px-1">purchase_invoice:read</code>, <code className="bg-white px-1">contact:read</code>
                  </li>
                  <li>{t('mekariStep5')}</li>
                  <li>
                    {t('mekariStep6')}
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] break-all border">
                      https://api.mekari.com/oauth/authorize?response_type=code&amp;client_id=<b>YOUR_CLIENT_ID</b>&amp;redirect_uri={appUrl}/api/accounting/callback&amp;scope=sales_invoice:read+purchase_invoice:read+contact:read
                    </div>
                  </li>
                  <li>{t('mekariStep7')}</li>
                  <li>
                    {t('mekariStep8')}
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] border whitespace-pre">
{`curl -X POST https://api.mekari.com/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=YOUR_CODE" \\
  -d "redirect_uri=${appUrl}/api/accounting/callback" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
                    </div>
                  </li>
                  <li>{t('mekariStep9')}</li>
                </ol>
                <p className="mt-2 text-[10px] text-amber-700">
                  {t('mekariApiWarning')}
                </p>
              </details>
            )}

            <div>
              <Label className="text-xs">Access Token</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="password"
                  placeholder={provider === 'ACCURATE' ? 'aat.xxx...' : 'Mekari Bearer token'}
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  className="font-mono text-xs"
                />
                {currentProvider.requiresDb && (
                  <Button size="sm" onClick={handleListDatabases} disabled={listingDbs || !accessToken}>
                    {listingDbs ? <Loader2 className="h-3 w-3 animate-spin" /> : t('dbQueryButton')}
                  </Button>
                )}
              </div>
            </div>

            {currentProvider.requiresDb && databases.length > 0 && (
              <div>
                <Label className="text-xs">{t('selectDbLabel')}</Label>
                <Select value={selectedDb ? String(selectedDb) : ''} onValueChange={v => setSelectedDb(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('selectDbPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {databases.map(db => (
                      <SelectItem key={db.id} value={String(db.id)}>
                        {db.alias || db.dbName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleConnect}
              disabled={connecting || !accessToken || (currentProvider.requiresDb && !selectedDb)}
              className="w-full"
            >
              {connecting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Link2 className="h-3 w-3 mr-2" />}
              {t('connectButton', { provider: currentProvider.name })}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Sync (only if connected) */}
      {selectedCustomer && connection?.is_active && (
        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-sm">{t('step3Title')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('startDate')}</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t('endDate')}</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSync} disabled={syncing} className="w-full">
              {syncing ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-2" />{t('syncing')}</>
              ) : (
                <><RefreshCw className="h-3 w-3 mr-2" />{t('syncInvoices')}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Imported Invoices + Auto-classify */}
      {selectedCustomer && invoices.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                {t('step4Title', { count: invoices.length })}
              </h2>
              <Button size="sm" onClick={handleApplyAll} disabled={applying}>
                {applying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {t('applyAllButton')}
              </Button>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {invoices.map(inv => (
                <div key={inv.id} className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 text-xs">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={inv.invoice_type === 'SALES' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                          {inv.invoice_type === 'SALES' ? t('sales') : t('purchase')}
                        </Badge>
                        <span className="font-mono font-medium">{inv.invoice_number}</span>
                        <span className="text-gray-400">{inv.invoice_date}</span>
                      </div>
                      <p className="mt-1 text-gray-600 truncate">{inv.counterparty_name || '-'}</p>
                      <p className="text-[10px] text-gray-400">NPWP: {inv.counterparty_npwp || t('none')}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold">{fmtRp(inv.total_amount)}</p>
                      {inv.tax_amount > 0 && <p className="text-[10px] text-gray-400">{t('taxAmount')} {fmtRp(inv.tax_amount)}</p>}
                      <Badge className={
                        inv.status === 'APPLIED' ? 'bg-green-100 text-green-700 text-[9px]' :
                        inv.status === 'CLASSIFIED' ? 'bg-yellow-100 text-yellow-700 text-[9px]' :
                        'bg-gray-100 text-gray-600 text-[9px]'
                      }>{inv.status}</Badge>
                    </div>
                  </div>

                  {/* Classification results */}
                  {inv.classifications.length > 0 && (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      {inv.classifications.map((cls, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-indigo-100 text-indigo-700 text-[9px]">
                            {cls.tax_type} {(cls.tax_rate * 100).toFixed(1)}%
                          </Badge>
                          <span className="font-mono text-[10px]">{fmtRp(cls.calculated_tax)}</span>
                          <span className="text-[9px] text-gray-400">{t('confidence')}: {cls.confidence}</span>
                          {cls.warnings.map((w, j) => (
                            <span key={j} className="text-[9px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" />{w}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
