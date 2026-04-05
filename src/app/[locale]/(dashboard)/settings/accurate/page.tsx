'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, CheckCircle, AlertTriangle, RefreshCw, Unlink, Database } from 'lucide-react';

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

export default function AccurateSettingsPage() {
  useParams();

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

  // Load connection status when customer changes
  useEffect(() => {
    if (!selectedCustomer) {
      setConnection(null);
      setCounts({ sales: 0, purchase: 0 });
      return;
    }
    setLoading(true);
    fetch(`/api/accurate/sync?customerId=${selectedCustomer}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setConnection(d.data.connection);
          setCounts(d.data.counts);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedCustomer]);

  const handleListDatabases = async () => {
    if (!accessToken) {
      showMsg('error', 'Access Token을 입력해주세요');
      return;
    }
    setListingDbs(true);
    try {
      const res = await fetch(`/api/accurate/connect?access_token=${encodeURIComponent(accessToken)}`);
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
    if (!selectedCustomer || !accessToken || !selectedDb) {
      showMsg('error', '고객, Access Token, DB를 모두 선택해주세요');
      return;
    }
    setConnecting(true);
    try {
      const db = databases.find(d => d.id === selectedDb);
      const res = await fetch('/api/accurate/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer,
          accessToken,
          databaseId: selectedDb,
          databaseName: db?.alias || db?.dbName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
        // Refresh connection info
        const statusRes = await fetch(`/api/accurate/sync?customerId=${selectedCustomer}`);
        const statusData = await statusRes.json();
        if (statusData.success) {
          setConnection(statusData.data.connection);
          setCounts(statusData.data.counts);
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
      const res = await fetch('/api/accurate/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer,
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
      // Refresh
      const statusRes = await fetch(`/api/accurate/sync?customerId=${selectedCustomer}`);
      const statusData = await statusRes.json();
      if (statusData.success) {
        setConnection(statusData.data.connection);
        setCounts(statusData.data.counts);
      }
    } catch {
      showMsg('error', '동기화 중 오류');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedCustomer || !confirm('Accurate 연결을 해제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/accurate/connect?customerId=${selectedCustomer}`, { method: 'DELETE' });
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
          Accurate Online 연동
        </h1>
        <p className="text-sm text-gray-500 mt-1">매출/매입 인보이스를 Accurate에서 AI Pajak으로 가져옵니다</p>
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
            <h2 className="font-bold text-sm">2. Accurate 연결</h2>
            <p className="text-xs text-gray-500">
              Accurate OAuth로 발급받은 Access Token이 필요합니다.{' '}
              <a href="https://api-doc.accurate.id/" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                발급 방법
              </a>
            </p>

            <div>
              <Label className="text-xs">Access Token</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="password"
                  placeholder="aat.xxx..."
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button size="sm" onClick={handleListDatabases} disabled={listingDbs || !accessToken}>
                  {listingDbs ? <Loader2 className="h-3 w-3 animate-spin" /> : 'DB 조회'}
                </Button>
              </div>
            </div>

            {databases.length > 0 && (
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

            <Button onClick={handleConnect} disabled={connecting || !selectedDb} className="w-full">
              {connecting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Link2 className="h-3 w-3 mr-2" />}
              연결하기
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Sync (only if connected) */}
      {selectedCustomer && connection?.is_active && (
        <Card className="border-0 shadow-sm">
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
    </div>
  );
}
