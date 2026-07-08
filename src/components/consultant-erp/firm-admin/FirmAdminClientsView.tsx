'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, ClipboardList, Loader2 } from 'lucide-react';

interface ClientRow {
  customerId: string;
  name: string;
  email: string | null;
  npwp: string | null;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  consultantId: string | null;
  consultantName: string | null;
  filingCount: number;
  since: string;
}

interface WorkloadRow {
  consultantId: string;
  fullName: string;
  clientCount: number;
}

export function FirmAdminClientsView() {
  const t = useTranslations('firmAdmin');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/firm-admin/clients');
      const j = await r.json();
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : t('loadFailed'));
      } else {
        setClients(j.data.clients);
        setWorkload(j.data.workload);
      }
    } catch {
      setError(t('networkError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const reassign = async (client: ClientRow, consultantId: string) => {
    const target = workload.find((w) => w.consultantId === consultantId);
    if (!target || consultantId === client.consultantId) return;
    if (!window.confirm(t('reassignConfirm', { client: client.name, consultant: target.fullName })))
      return;
    setBusy(true);
    try {
      const r = await fetch('/api/firm-admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: client.customerId, consultantId }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === 'string' ? j.error : t('reassignFailed'));
      } else {
        toast.success(t('reassignDone', { client: client.name, consultant: target.fullName }));
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-red-600">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            {t('workloadTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workload.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-6 text-center text-sm text-slate-400">
              {t('noActiveStaff')}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {workload.map((w) => (
                <div
                  key={w.consultantId}
                  className="rounded-lg border border-slate-200 px-4 py-3"
                >
                  <p className="truncate text-sm font-medium text-slate-800">{w.fullName}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-600">
                    {w.clientCount}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      {t('clientsUnit')}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            {t('allClientsTitle')}
            <Badge variant="secondary">{clients.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-8 text-center text-sm text-slate-400">
              {t('emptyClients')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">{t('colClient')}</th>
                    <th className="py-2 pr-3">{t('colType')}</th>
                    <th className="py-2 pr-3">{t('colNpwp')}</th>
                    <th className="py-2 pr-3 text-right">{t('colFilings')}</th>
                    <th className="py-2">{t('colConsultant')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.customerId} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-slate-800">{c.name}</p>
                        {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          variant="secondary"
                          className={
                            c.customerType === 'COMPANY'
                              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-50'
                              : undefined
                          }
                        >
                          {c.customerType === 'COMPANY' ? t('company') : t('individual')}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs tabular-nums text-slate-500">
                        {c.npwp ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{c.filingCount}</td>
                      <td className="py-2.5">
                        <Select
                          value={c.consultantId ?? undefined}
                          disabled={busy}
                          onValueChange={(v) => void reassign(c, v)}
                        >
                          <SelectTrigger className="h-8 w-48">
                            <SelectValue placeholder={t('unassigned')} />
                          </SelectTrigger>
                          <SelectContent>
                            {workload.map((w) => (
                              <SelectItem key={w.consultantId} value={w.consultantId}>
                                {w.fullName} ({w.clientCount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
