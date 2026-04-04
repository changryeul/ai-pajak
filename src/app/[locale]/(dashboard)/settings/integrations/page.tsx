'use client';

import { useState } from 'react';
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
    description: '인도네시아 1위 회계 소프트웨어. 직원/급여/인보이스 자동 동기화.',
    icon: FileSpreadsheet,
    gradient: 'from-blue-600 to-blue-700',
    status: 'disconnected',
    features: ['직원 목록 동기화', '월급여 → PPh 21 자동 계산', '매출 인보이스 → PPN 정산', '재무제표 조회'],
    connectAction: '/api/integrations/accurate?action=authorize',
    category: 'accounting',
  },
  {
    id: 'jurnal',
    name: 'Jurnal by Mekari',
    description: 'Mekari 생태계 통합 회계. 거래처/인보이스/손익계산서 연동.',
    icon: Building2,
    gradient: 'from-emerald-600 to-emerald-700',
    status: 'disconnected',
    features: ['거래처 동기화', '매출 인보이스 조회', '손익계산서 조회', '대차대조표 조회'],
    connectAction: '/api/integrations/jurnal?action=authorize',
    category: 'accounting',
  },
  {
    id: 'banking',
    name: 'Open Banking',
    description: 'BCA, Mandiri, BNI 등 인니 주요 은행 계좌 연동. 매출 자동 집계.',
    icon: Landmark,
    gradient: 'from-amber-600 to-orange-600',
    status: 'disconnected',
    features: ['은행 거래내역 조회', '월 매출 자동 집계', 'PPh Final UMKM 계산', '거래 분류'],
    connectAction: '/api/integrations/banking?action=get-widget-token',
    category: 'banking',
  },
];

type SyncAction = 'sync-employees' | 'sync-payroll' | 'sync-invoices' | 'sync-financial';

const SYNC_ACTIONS: { id: SyncAction; label: string; description: string; integrations: string[] }[] = [
  { id: 'sync-employees', label: '직원 동기화', description: '직원 목록 + NPWP/NIK 가져오기', integrations: ['accurate'] },
  { id: 'sync-payroll', label: '급여 동기화', description: '월 급여 데이터 → PPh 21 계산', integrations: ['accurate'] },
  { id: 'sync-invoices', label: '인보이스 동기화', description: '매출 인보이스 → PPN 정산', integrations: ['accurate', 'jurnal'] },
  { id: 'sync-financial', label: '재무제표 조회', description: '대차대조표/손익계산서', integrations: ['accurate', 'jurnal'] },
];

export default function IntegrationsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const handleConnect = async (integration: Integration) => {
    // In production, this would redirect to OAuth
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
        [action]: { success: data.success || res.ok, message: data.message || (res.ok ? '동기화 완료' : '연결이 필요합니다') },
      }));
    } catch {
      setSyncResults(prev => ({
        ...prev,
        [action]: { success: false, message: '동기화 실패' },
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
            <ArrowLeft className="h-3 w-3 mr-1" />설정으로 돌아가기
          </Button>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" />Integrations
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">회계 소프트웨어 연동</h1>
          <p className="text-slate-400 mt-2 text-sm">Accurate, Jurnal, 은행 계좌를 연결하면 데이터가 자동으로 동기화됩니다</p>
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
                        <p className="text-sm text-gray-600">{integration.description}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {isConnected ? (
                            <Badge className="text-[10px] bg-green-100 text-green-700">
                              <CheckCircle className="h-2.5 w-2.5 mr-0.5" />연결됨
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-gray-100 text-gray-500">
                              <XCircle className="h-2.5 w-2.5 mr-0.5" />미연결
                            </Badge>
                          )}
                          {integration.lastSync && (
                            <span className="text-[10px] text-gray-400">마지막 동기화: {integration.lastSync}</span>
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
                          <><Settings className="h-3 w-3 mr-1" />관리</>
                        ) : (
                          <><Link2 className="h-3 w-3 mr-1" />연결하기</>
                        )}
                      </Button>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {integration.features.map(f => (
                        <span key={f} className="text-[10px] bg-gray-50 text-gray-500 rounded px-1.5 py-0.5">{f}</span>
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
        <RefreshCw className="h-5 w-5 text-blue-600" />데이터 동기화
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SYNC_ACTIONS.map(action => {
          const result = syncResults[action.id];
          return (
            <Card key={action.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{action.description}</p>
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
                      <><RefreshCw className="h-3 w-3 mr-1" />동기화</>
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
