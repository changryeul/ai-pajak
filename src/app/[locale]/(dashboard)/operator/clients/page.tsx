'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users, Search, Loader2, Building2, FileText, Clock,
  CheckCircle, AlertCircle,
} from 'lucide-react';

interface AssignedClient {
  customer_id: string;
  assigned_date: string;
  customer_name?: string;
  npwp?: string;
  pending_count?: number;
  completed_count?: number;
}

export default function OperatorClientsPage() {
  const [clients, setClients] = useState<AssignedClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/operator');
      const data = await res.json();
      if (data.success) {
        setClients(data.data.clients || []);
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const filtered = clients.filter(c =>
    !search ||
    (c.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.npwp || '').includes(search)
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-teal-200 text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />Operator
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">담당 고객</h1>
          <p className="text-teal-200 text-sm mt-1">배정된 고객 목록 및 현황</p>

          <div className="flex gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
              <span className="text-2xl font-bold">{clients.length}</span>
              <span className="text-xs text-teal-200 ml-1">전체 고객</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="고객명 또는 NPWP 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="text-center py-20">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {search ? '검색 결과가 없습니다' : '배정된 고객이 없습니다'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => (
            <Card key={client.customer_id} className="border-0 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {client.customer_name || `Customer ${client.customer_id.slice(0, 8)}`}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5">
                      {client.npwp && <span className="font-mono">{client.npwp}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        배정일: {new Date(client.assigned_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {(client.pending_count || 0) > 0 && (
                      <Badge className="bg-yellow-100 text-yellow-700">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {client.pending_count} 대기
                      </Badge>
                    )}
                    {(client.completed_count || 0) > 0 && (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {client.completed_count} 완료
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-6">
        {filtered.length}명의 담당 고객
      </p>
    </div>
  );
}
