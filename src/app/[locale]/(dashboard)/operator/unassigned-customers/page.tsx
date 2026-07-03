'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Search, UserPlus } from 'lucide-react';

interface UnassignedCustomer {
  id: string;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  full_name: string;
  company_name: string | null;
  npwp: string | null;
  email: string;
  phone: string | null;
  created_at: string;
}

interface ConsultantOption {
  id: string;
  full_name: string;
  email: string;
  is_active?: boolean;
}

export default function UnassignedCustomersPage() {
  const [customers, setCustomers] = useState<UnassignedCustomer[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [custRes, consRes] = await Promise.all([
        fetch('/api/operator/unassigned-customers'),
        fetch('/api/admin/consultants'),
      ]);
      const custJson = await custRes.json();
      const consJson = await consRes.json();
      if (custJson.success) setCustomers(custJson.data.customers || []);
      if (consJson.success) {
        const list: ConsultantOption[] = consJson.data?.consultants || consJson.data || [];
        setConsultants(list.filter(c => c.is_active !== false));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const assign = async (customerId: string) => {
    const consultantId = selectedConsultant[customerId];
    if (!consultantId) return;
    setBusy(customerId);
    try {
      const res = await fetch(`/api/customers/${customerId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultantId }),
      });
      const json = await res.json();
      if (json.success) {
        setCustomers(prev => prev.filter(c => c.id !== customerId));
      }
    } finally {
      setBusy(null);
    }
  };

  const filtered = customers.filter(c =>
    !search
    || (c.company_name || c.full_name).toLowerCase().includes(search.toLowerCase())
    || (c.npwp || '').includes(search)
    || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 p-6 md:p-8 text-white mb-6">
        <div className="relative z-10">
          <p className="text-amber-100 text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />JTC Intake Queue
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">미배정 고객</h1>
          <p className="text-amber-50 text-sm mt-1">
            가입 후 아직 컨설턴트가 배정되지 않은 개인·일반법인 고객입니다.
          </p>
          <div className="flex gap-4 mt-6">
            <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-2">
              <span className="text-2xl font-bold">{customers.length}</span>
              <span className="text-xs text-amber-50 ml-2">건 대기 중</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="이름·NPWP·이메일 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            현재 대기 중인 미배정 고객이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => (
            <Card key={c.id}>
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={c.customer_type === 'COMPANY' ? 'default' : 'secondary'}>
                        {c.customer_type === 'COMPANY' ? '법인' : '개인'}
                      </Badge>
                      <span className="font-semibold truncate">
                        {c.company_name || c.full_name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{c.email}</span>
                      {c.npwp && <span>NPWP: {c.npwp}</span>}
                      {c.phone && <span>{c.phone}</span>}
                      <span>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[180px]"
                      value={selectedConsultant[c.id] || ''}
                      onChange={e => setSelectedConsultant(prev => ({ ...prev, [c.id]: e.target.value }))}
                      disabled={busy === c.id}
                    >
                      <option value="">컨설턴트 선택</option>
                      {consultants.map(cons => (
                        <option key={cons.id} value={cons.id}>{cons.full_name}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={() => assign(c.id)}
                      disabled={!selectedConsultant[c.id] || busy === c.id}
                    >
                      {busy === c.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><UserPlus className="h-4 w-4 mr-1" />배정</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
