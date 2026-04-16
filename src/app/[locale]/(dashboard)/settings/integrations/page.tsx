'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Link2, CheckCircle, XCircle, RefreshCw, ArrowRight, Building2,
  FileSpreadsheet, Landmark, Loader2, Settings, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: typeof Building2;
  gradient: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  features: string[];
  connectAction: string;
  category: 'accounting' | 'banking';
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'accurate',
    name: 'Accurate Online',
    description: 'accurateDesc',
    icon: FileSpreadsheet,
    gradient: 'from-blue-600 to-blue-700',
    status: 'disconnected',
    features: ['syncEmployees', 'syncPayroll', 'syncInvoices', 'syncFinancial'],
    connectAction: '/settings/accurate?provider=ACCURATE',
    category: 'accounting',
  },
  {
    id: 'jurnal',
    name: 'Jurnal by Mekari',
    description: 'jurnalDesc',
    icon: Building2,
    gradient: 'from-emerald-600 to-emerald-700',
    status: 'disconnected',
    features: ['syncEmployees', 'syncInvoices', 'syncFinancial'],
    connectAction: '/settings/accurate?provider=MEKARI',
    category: 'accounting',
  },
  {
    id: 'banking',
    name: 'Open Banking',
    description: 'bankingDesc',
    icon: Landmark,
    gradient: 'from-amber-600 to-orange-600',
    status: 'disconnected',
    features: ['syncEmployees', 'syncPayroll', 'syncInvoices', 'syncFinancial'],
    connectAction: '/api/integrations/banking?action=get-widget-token',
    category: 'banking',
  },
];

type SyncAction = 'sync-employees' | 'sync-payroll' | 'sync-invoices' | 'sync-financial';

const SYNC_ACTIONS: { id: SyncAction; labelKey: string; descKey: string; integrations: string[] }[] = [
  { id: 'sync-employees', labelKey: 'integrations.syncEmployees', descKey: 'integrations.syncEmployeesDesc', integrations: ['accurate'] },
  { id: 'sync-payroll', labelKey: 'integrations.syncPayroll', descKey: 'integrations.syncPayrollDesc', integrations: ['accurate'] },
  { id: 'sync-invoices', labelKey: 'integrations.syncInvoices', descKey: 'integrations.syncInvoicesDesc', integrations: ['accurate', 'jurnal'] },
  { id: 'sync-financial', labelKey: 'integrations.syncFinancial', descKey: 'integrations.syncFinancialDesc', integrations: ['accurate', 'jurnal'] },
];

export default function IntegrationsPage() {
  const t = useTranslations('killer');
  const ti = useTranslations('integrations');
  const params = useParams();
  const locale = params.locale as string;
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const handleConnect = async (integration: Integration) => {
    // If connectAction is an internal route (starts with /settings), prepend locale
    if (integration.connectAction.startsWith('/settings')) {
      window.location.href = `/${locale}${integration.connectAction}`;
      return;
    }
    // Otherwise treat as external URL (e.g., OAuth authorize endpoint)
    window.location.href = integration.connectAction;
  };

  const handleSync = async (action: SyncAction, integrationId: string) => {
    setSyncing(action);
    try {
      const res = await fetch(`/api/integrations/${integrationId}?action=${action}`, {
        method: 'POST',
      });
      const data = await res.json();
      setSyncResults(prev => ({
        ...prev,
        [action]: { success: data.success || res.ok, message: data.message || (res.ok ? ti('syncSuccess') : ti('connectionRequired')) },
      }));
    } catch {
      setSyncResults(prev => ({
        ...prev,
        [action]: { success: false, message: ti('syncFailed') },
      }));
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <Button variant="ghost" size="sm" className="text-slate-400 mb-2 -ml-2" onClick={() => window.location.href = `/${locale}/settings`}>
            <ArrowLeft className="h-3 w-3 mr-1" />{t('integrations.backToSettings')}
          </Button>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" />{t('integrations.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('integrations.title')}</h1>
          <p className="text-slate-400 mt-2 text-sm">{t('integrations.subtitle')}</p>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-4 mb-8">
        {INTEGRATIONS.map(integration => {
          const Icon = integration.icon;
          const isConnected = integration.status === 'connected';

          return (
            <Card key={integration.id} className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Left: Icon + Name */}
                  <div className={`w-28 md:w-36 bg-gradient-to-br ${integration.gradient} p-4 flex flex-col items-center justify-center text-white`}>
                    <Icon className="h-8 w-8 mb-1" />
                    <span className="font-bold text-xs text-center leading-tight">{integration.name}</span>
                  </div>

                  {/* Right: Details */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-gray-600">{t(`integrations.${integration.description}`)}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {isConnected ? (
                            <Badge className="text-[10px] bg-green-100 text-green-700">
                              <CheckCircle className="h-2.5 w-2.5 mr-0.5" />{t('integrations.connected')}
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-gray-100 text-gray-500">
                              <XCircle className="h-2.5 w-2.5 mr-0.5" />{t('integrations.disconnected')}
                            </Badge>
                          )}
                          {integration.lastSync && (
                            <span className="text-[10px] text-gray-400">{t('integrations.lastSync')}: {integration.lastSync}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isConnected ? 'outline' : 'default'}
                        className={cn('h-8 text-xs', !isConnected && `bg-gradient-to-r ${integration.gradient} text-white`)}
                        onClick={() => handleConnect(integration)}
                      >
                        {isConnected ? (
                          <><Settings className="h-3 w-3 mr-1" />{t('integrations.manage')}</>
                        ) : (
                          <><Link2 className="h-3 w-3 mr-1" />{t('integrations.connect')}</>
                        )}
                      </Button>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {integration.features.map(f => (
                        <span key={f} className="text-[10px] bg-gray-50 text-gray-500 rounded px-1.5 py-0.5">{t(`integrations.${f}`)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sync Actions */}
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <RefreshCw className="h-5 w-5 text-blue-600" />{t('integrations.syncTitle')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SYNC_ACTIONS.map(action => {
          const result = syncResults[action.id];
          return (
            <Card key={action.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t(action.labelKey)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t(action.descKey)}</p>
                    <div className="flex gap-1 mt-1">
                      {action.integrations.map(i => (
                        <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">{i}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={syncing === action.id}
                    onClick={() => handleSync(action.id, action.integrations[0])}
                  >
                    {syncing === action.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <><RefreshCw className="h-3 w-3 mr-1" />{t('integrations.sync')}</>
                    )}
                  </Button>
                </div>
                {result && (
                  <div className={cn('mt-2 text-[10px] rounded p-1.5', result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                    {result.message}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
