'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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

const PROVIDERS: { id: ProviderId; name: string; requiresDb: boolean; hint: string }[] = [
  { id: 'ACCURATE', name: 'Accurate Online', requiresDb: true, hint: 'OAuth access token 발급 후 DB 선택 필요' },
  { id: 'MEKARI', name: 'Mekari Jurnal', requiresDb: false, hint: 'OAuth access token만 있으면 연결 가능 (DB 선택 불필요)' },
];

export default function AccountingSettingsPage() {
  useParams();
  const searchParams = useSearchParams();
  const initialProvider = (searchParams.get('provider') === 'MEKARI' ? 'MEKARI' : 'ACCURATE') as ProviderId;

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
      showMsg('error', 'Access Token을 입력해주세요');
      return;
    }
    setListingDbs(true);
    try {
      const res = await fetch(`/api/accounting/connect?provider=${provider}&access_token=${encodeURIComponent(accessToken)}`);
      const data = await res.json();
      if (data.success) {
        setDatabases(data.data || []);
        showMsg('success', `${data.data?.length || 0}개의 DB를 발견했습니다`);
      } else {
        showMsg('error', data.error || 'DB 조회 실패');
      }
    } catch {
      showMsg('error', 'DB 조회 중 오류');
    } finally {
      setListingDbs(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedCustomer || !accessToken) {
      showMsg('error', '고객과 Access Token을 입력해주세요');
      return;
    }
    if (currentProvider.requiresDb && !selectedDb) {
      showMsg('error', 'DB를 선택해주세요');
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
      showMsg('error', '연결 중 오류');
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
        showMsg('error', data.message || data.error || '동기화 실패');
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
      showMsg('error', '동기화 중 오류');
    } finally {
      setSyncing(false);
    }
  };

  const handleApplyAll = async () => {
    if (!selectedCustomer) return;
    if (!confirm('분류된 인보이스를 모두 세금 계산(tax_calculation)으로 적용하시겠습니까?')) return;
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
        showMsg('error', data.error || '적용 실패');
      }
    } catch {
      showMsg('error', '적용 중 오류');
    } finally {
      setApplying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedCustomer || !confirm(`${currentProvider.name} 연결을 해제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/accounting/connect?customerId=${selectedCustomer}&provider=${provider}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setConnection(null);
        setCounts({ sales: 0, purchase: 0 });
        showMsg('success', '연결이 해제되었습니다');
      }
    } catch {
      showMsg('error', '연결 해제 실패');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          회계 S/W 연동
        </h1>
        <p className="text-sm text-gray-500 mt-1">매출/매입 인보이스를 회계 소프트웨어에서 AI Pajak으로 가져옵니다</p>

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
          <h2 className="font-bold text-sm">1. 고객(법인) 선택</h2>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger><SelectValue placeholder="고객을 선택하세요" /></SelectTrigger>
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
                  <Link2 className="h-4 w-4" />연결 상태
                </h2>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-2" />
                ) : connection && connection.is_active ? (
                  <div className="mt-2 space-y-1">
                    <Badge className="bg-green-100 text-green-700">연결됨</Badge>
                    <p className="text-xs text-gray-500">DB: {connection.database_name || '-'}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{connection.host}</p>
                    {connection.last_sync_at && (
                      <p className="text-xs text-gray-500">
                        마지막 동기화: {new Date(connection.last_sync_at).toLocaleString('ko-KR')}
                      </p>
                    )}
                    {connection.last_error && (
                      <p className="text-xs text-red-600">오류: {connection.last_error}</p>
                    )}
                  </div>
                ) : (
                  <Badge className="bg-gray-100 text-gray-500 mt-2">연결되지 않음</Badge>
                )}
              </div>
              {connection?.is_active && (
                <Button size="sm" variant="outline" onClick={handleDisconnect}>
                  <Unlink className="h-3 w-3 mr-1" />연결 해제
                </Button>
              )}
            </div>

            {connection?.is_active && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
                <div>
                  <p className="text-[10px] text-gray-400">가져온 매출 인보이스</p>
                  <p className="font-bold">{counts.sales}건</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">가져온 매입 인보이스</p>
                  <p className="font-bold">{counts.purchase}건</p>
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
            <h2 className="font-bold text-sm">2. {currentProvider.name} 연결</h2>

            {provider === 'ACCURATE' && (
              <details className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3">
                <summary className="cursor-pointer font-medium text-blue-700">
                  📖 Accurate Access Token 발급 방법 (클릭하여 펼치기)
                </summary>
                <ol className="mt-2 space-y-2 text-gray-700 list-decimal list-inside">
                  <li>
                    <a href="https://account.accurate.id" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      account.accurate.id
                    </a> 접속 후 로그인
                  </li>
                  <li>우측 상단 프로필 → <b>Pengaturan</b> → <b>Aplikasi OAuth</b> 메뉴</li>
                  <li>
                    <b>새 앱 등록</b> — Name: <code className="bg-white px-1">AI Pajak</code>, Redirect URI: <code className="bg-white px-1">https://ai-pajak.vercel.app/api/accounting/callback</code>
                  </li>
                  <li>발급된 <b>Client ID</b> / <b>Client Secret</b> 확인</li>
                  <li>
                    브라우저에 다음 URL 입력 (YOUR_CLIENT_ID 교체):
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] break-all border">
                      https://account.accurate.id/oauth/authorize?response_type=code&amp;client_id=<b>YOUR_CLIENT_ID</b>&amp;redirect_uri=https://ai-pajak.vercel.app/api/accounting/callback&amp;scope=item_view+sales_invoice_view+purchase_invoice_view
                    </div>
                  </li>
                  <li>허용 클릭 → 리디렉트된 URL의 <code className="bg-white px-1">?code=xxx</code> 값 복사</li>
                  <li>
                    터미널에서 curl 실행:
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] border whitespace-pre">
{`curl -X POST https://account.accurate.id/oauth/token \\
  -d "grant_type=authorization_code" \\
  -d "code=YOUR_CODE" \\
  -d "redirect_uri=https://ai-pajak.vercel.app/api/accounting/callback" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
                    </div>
                  </li>
                  <li>응답의 <code className="bg-white px-1">access_token</code> 값(<code>aat.</code>로 시작)을 아래에 붙여넣기</li>
                </ol>
                <p className="mt-2 text-[10px] text-amber-700">
                  ⚠️ Aplikasi OAuth 메뉴가 안 보이면 계정 플랜에 API가 포함되지 않은 것일 수 있습니다.
                </p>
              </details>
            )}

            {provider === 'MEKARI' && (
              <details className="text-xs text-gray-500 bg-emerald-50 rounded-lg p-3">
                <summary className="cursor-pointer font-medium text-emerald-700">
                  📖 Mekari Jurnal Access Token 발급 방법 (클릭하여 펼치기)
                </summary>
                <ol className="mt-2 space-y-2 text-gray-700 list-decimal list-inside">
                  <li>
                    <a href="https://mekari.com/developers" target="_blank" rel="noreferrer" className="text-emerald-600 underline">
                      mekari.com/developers
                    </a> 접속 후 Jurnal 계정으로 로그인
                  </li>
                  <li>
                    <b>My Apps</b> 또는 <b>Applications</b> 메뉴 → <b>Create New App</b>
                  </li>
                  <li>
                    앱 정보 입력 — Name: <code className="bg-white px-1">AI Pajak</code>, Redirect URI:{' '}
                    <code className="bg-white px-1">https://ai-pajak.vercel.app/api/accounting/callback</code>
                  </li>
                  <li>
                    Scopes 선택: <code className="bg-white px-1">sales_invoice:read</code>, <code className="bg-white px-1">purchase_invoice:read</code>, <code className="bg-white px-1">contact:read</code>
                  </li>
                  <li>발급된 <b>Client ID</b> / <b>Client Secret</b> 확인</li>
                  <li>
                    브라우저에 authorize URL 입력 (YOUR_CLIENT_ID 교체):
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] break-all border">
                      https://api.mekari.com/oauth/authorize?response_type=code&amp;client_id=<b>YOUR_CLIENT_ID</b>&amp;redirect_uri=https://ai-pajak.vercel.app/api/accounting/callback&amp;scope=sales_invoice:read+purchase_invoice:read+contact:read
                    </div>
                  </li>
                  <li>허용 클릭 → 리디렉트된 URL의 <code className="bg-white px-1">?code=xxx</code> 값 복사</li>
                  <li>
                    터미널에서 curl 실행:
                    <div className="mt-1 bg-white p-2 rounded font-mono text-[10px] border whitespace-pre">
{`curl -X POST https://api.mekari.com/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=YOUR_CODE" \\
  -d "redirect_uri=https://ai-pajak.vercel.app/api/accounting/callback" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
                    </div>
                  </li>
                  <li>응답의 <code className="bg-white px-1">access_token</code> 값을 아래에 붙여넣기</li>
                </ol>
                <p className="mt-2 text-[10px] text-amber-700">
                  ⚠️ Mekari는 Jurnal 유료 플랜에서 API가 제공됩니다. API 미활성 시 고객센터 문의 필요.
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
                    {listingDbs ? <Loader2 className="h-3 w-3 animate-spin" /> : 'DB 조회'}
                  </Button>
                )}
              </div>
            </div>

            {currentProvider.requiresDb && databases.length > 0 && (
              <div>
                <Label className="text-xs">데이터베이스 선택</Label>
                <Select value={selectedDb ? String(selectedDb) : ''} onValueChange={v => setSelectedDb(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="DB 선택" /></SelectTrigger>
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
              {currentProvider.name} 연결하기
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Sync (only if connected) */}
      {selectedCustomer && connection?.is_active && (
        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-sm">3. 인보이스 가져오기</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">시작일</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">종료일</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSync} disabled={syncing} className="w-full">
              {syncing ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-2" />동기화 중...</>
              ) : (
                <><RefreshCw className="h-3 w-3 mr-2" />매출/매입 인보이스 가져오기</>
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
                4. 가져온 인보이스 및 자동 분류 ({invoices.length}건)
              </h2>
              <Button size="sm" onClick={handleApplyAll} disabled={applying}>
                {applying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                전체 세금계산 적용
              </Button>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {invoices.map(inv => (
                <div key={inv.id} className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 text-xs">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={inv.invoice_type === 'SALES' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                          {inv.invoice_type === 'SALES' ? '매출' : '매입'}
                        </Badge>
                        <span className="font-mono font-medium">{inv.invoice_number}</span>
                        <span className="text-gray-400">{inv.invoice_date}</span>
                      </div>
                      <p className="mt-1 text-gray-600 truncate">{inv.counterparty_name || '-'}</p>
                      <p className="text-[10px] text-gray-400">NPWP: {inv.counterparty_npwp || '없음'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold">{fmtRp(inv.total_amount)}</p>
                      {inv.tax_amount > 0 && <p className="text-[10px] text-gray-400">세액 {fmtRp(inv.tax_amount)}</p>}
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
                          <span className="text-[9px] text-gray-400">신뢰도: {cls.confidence}</span>
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
