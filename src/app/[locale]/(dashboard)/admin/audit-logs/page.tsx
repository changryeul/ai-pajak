'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Loader2, ChevronLeft, ChevronRight, Clock,
  User, FileText, AlertTriangle, Eye, Calendar,
} from 'lucide-react';

interface AuditLog {
  id: string; activity_type: string; actor_user_id: string; actor_role: string;
  actorEmail: string; customer_id?: string; tax_filing_id?: string;
  details?: Record<string, unknown>; ip_address?: string; user_agent?: string;
  created_at: string;
}

const activityColors: Record<string, string> = {
  TAX_FILING_CREATE: 'bg-blue-100 text-blue-700',
  TAX_FILING_SUBMIT: 'bg-green-100 text-green-700',
  TAX_FILING_APPROVE: 'bg-emerald-100 text-emerald-700',
  TAX_FILING_REJECT: 'bg-red-100 text-red-700',
  POA_CREATE: 'bg-purple-100 text-purple-700',
  POA_SIGN: 'bg-indigo-100 text-indigo-700',
  POA_REVOKE: 'bg-orange-100 text-orange-700',
  TAX_CALCULATION: 'bg-cyan-100 text-cyan-700',
  DOCUMENT_UPLOAD: 'bg-teal-100 text-teal-700',
  LOGIN: 'bg-gray-100 text-gray-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
};

const roleColors: Record<string, string> = {
  CUSTOMER: 'bg-blue-50 text-blue-600',
  CONSULTANT_JTC: 'bg-green-50 text-green-600',
  TAX_ADVISOR_JTC: 'bg-purple-50 text-purple-600',
  PLATFORM_ADMIN: 'bg-orange-50 text-orange-600',
  SYSTEM: 'bg-gray-50 text-gray-600',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<{ typeStats: Record<string, number>; totalLogs: number } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams({ page: pagination.page.toString(), limit: '50' });
      if (activityFilter) p.append('activityType', activityFilter);
      if (roleFilter) p.append('actorRole', roleFilter);
      const res = await fetch(`/api/admin/audit-logs?${p}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setStats(data.data.stats);
        setPagination(data.data.pagination);
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [pagination.page, activityFilter, roleFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-red-600 to-rose-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-orange-200 text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Admin - Security</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Audit Logs</h1>
          <p className="text-orange-200 mt-1 text-sm">Semua aktivitas tercatat dan tidak dapat diubah (Hard Rule #5)</p>
          {stats && (
            <div className="flex gap-4 mt-4">
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                <span className="text-2xl font-bold">{stats.totalLogs}</span>
                <span className="text-xs text-orange-200 ml-1">total logs</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Select value={activityFilter} onValueChange={v => { setActivityFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semua Aktivitas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Aktivitas</SelectItem>
            <SelectItem value="TAX_FILING_CREATE">Filing Create</SelectItem>
            <SelectItem value="TAX_FILING_SUBMIT">Filing Submit</SelectItem>
            <SelectItem value="TAX_FILING_APPROVE">Filing Approve</SelectItem>
            <SelectItem value="TAX_FILING_REJECT">Filing Reject</SelectItem>
            <SelectItem value="POA_CREATE">POA Create</SelectItem>
            <SelectItem value="POA_SIGN">POA Sign</SelectItem>
            <SelectItem value="POA_REVOKE">POA Revoke</SelectItem>
            <SelectItem value="TAX_CALCULATION">Tax Calculation</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Semua Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Role</SelectItem>
            <SelectItem value="CUSTOMER">Customer</SelectItem>
            <SelectItem value="CONSULTANT_JTC">Consultant</SelectItem>
            <SelectItem value="TAX_ADVISOR_JTC">Tax Advisor</SelectItem>
            <SelectItem value="PLATFORM_ADMIN">Admin</SelectItem>
            <SelectItem value="SYSTEM">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs */}
      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" /></div>
      ) : logs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Shield className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada audit log</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0 divide-y">
            {logs.map(log => {
              const isExpanded = expandedLog === log.id;
              return (
                <button key={log.id} onClick={() => setExpandedLog(isExpanded ? null : log.id)} className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] ${activityColors[log.activity_type] || 'bg-gray-100 text-gray-600'}`}>
                          {log.activity_type}
                        </Badge>
                        <Badge className={`text-[10px] ${roleColors[log.actor_role] || 'bg-gray-50'}`}>
                          {log.actor_role}
                        </Badge>
                        <span className="text-xs text-gray-500">{log.actorEmail}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                            <div><span className="text-gray-400">Log ID</span><p className="font-mono text-[10px]">{log.id}</p></div>
                            <div><span className="text-gray-400">Actor ID</span><p className="font-mono text-[10px]">{log.actor_user_id}</p></div>
                            {log.customer_id && <div><span className="text-gray-400">Customer ID</span><p className="font-mono text-[10px]">{log.customer_id}</p></div>}
                            {log.tax_filing_id && <div><span className="text-gray-400">Filing ID</span><p className="font-mono text-[10px]">{log.tax_filing_id}</p></div>}
                            {log.ip_address && <div><span className="text-gray-400">IP Address</span><p className="font-mono">{log.ip_address}</p></div>}
                            {log.user_agent && <div className="col-span-2"><span className="text-gray-400">User Agent</span><p className="text-[10px] truncate">{log.user_agent}</p></div>}
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <span className="text-gray-400 text-[10px]">Details</span>
                              <pre className="text-[10px] font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500">{pagination.page} / {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Immutability Notice */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-start gap-2">
        <Shield className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-500" />
        <div>
          <p className="font-medium">Hard Rule #5: Audit Trail Immutability</p>
          <p>Semua log bersifat immutable (tidak dapat diubah atau dihapus). INSERT only - no UPDATE/DELETE.</p>
        </div>
      </div>
    </div>
  );
}
