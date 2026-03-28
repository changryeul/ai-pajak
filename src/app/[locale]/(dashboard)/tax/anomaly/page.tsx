'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import {
  ArrowLeft, Loader2, ShieldAlert, AlertTriangle, AlertCircle,
  Info, CheckCircle, Sparkles, Shield,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AnomalyAlert {
  id: string;
  category: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  recommendation: string;
  legalBasis?: string;
  metric?: string;
  threshold?: string;
  actualValue?: string;
}

interface AnomalyResult {
  overallRisk: string;
  riskScore: number;
  alerts: AnomalyAlert[];
  summary: string;
  auditProbability: string;
}

interface Customer { id: string; full_name: string; npwp: string; }

const riskConfig = {
  LOW: { color: 'bg-green-100 text-green-700', icon: CheckCircle, barColor: 'bg-green-500' },
  MEDIUM: { color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle, barColor: 'bg-yellow-500' },
  HIGH: { color: 'bg-orange-100 text-orange-700', icon: AlertCircle, barColor: 'bg-orange-500' },
  CRITICAL: { color: 'bg-red-100 text-red-700', icon: ShieldAlert, barColor: 'bg-red-500' },
};

export default function AnomalyDetectionPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { session, isLoading: isSessionLoading } = useSession();
  const t = useTranslations('pages');
  const currentYear = new Date().getFullYear();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [taxYear, setTaxYear] = useState(currentYear - 1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;
    fetchCustomers();
  }, [isSessionLoading]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers?type=INDIVIDUAL');
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch { /* ignore */ }
  };

  const runCheck = useCallback(async () => {
    if (!selectedCustomer) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tax/anomaly-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomer.id, taxYear, ptkpStatus: 'TK/0' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCustomer, taxYear]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/dashboard`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />{t('back')}
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-orange-500" />
          {t('anomalyTitle')}
        </h1>
        <p className="text-gray-500 mt-1">{t('anomalyDesc')}</p>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('selectClient')}</Label>
              <Select onValueChange={(v) => setSelectedCustomer(customers.find(c => c.id === v) || null)}>
                <SelectTrigger><SelectValue placeholder="Pilih klien..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tahun Pajak</Label>
              <Select value={taxYear.toString()} onValueChange={(v) => setTaxYear(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => currentYear - 1 - i).map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>}

          <Button onClick={runCheck} disabled={isLoading || !selectedCustomer} className="w-full bg-gradient-to-r from-orange-500 to-red-500">
            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menganalisis...</>
              : <><Shield className="h-4 w-4 mr-2" />{t('runAnomaly')}</>}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Risk Score */}
          <Card className={`border-0 shadow-sm ${result.riskScore >= 60 ? 'border-l-4 border-l-red-500' : result.riskScore >= 30 ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-green-500'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Skor Risiko: {result.riskScore}/100</h3>
                  <p className="text-sm text-gray-500">Probabilitas Pemeriksaan: {result.auditProbability}</p>
                </div>
                <Badge className={`text-sm px-3 py-1 ${riskConfig[result.overallRisk as keyof typeof riskConfig]?.color || 'bg-gray-100'}`}>
                  {result.overallRisk}
                </Badge>
              </div>
              <Progress value={result.riskScore} className="h-3" />
            </CardContent>
          </Card>

          {/* AI Summary */}
          {result.summary && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerts */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Anomali Terdeteksi ({result.alerts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.alerts.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Tidak ada anomali terdeteksi!</p>
                </div>
              ) : (
                result.alerts.map((alert) => {
                  const config = riskConfig[alert.riskLevel];
                  const Icon = config.icon;
                  return (
                    <div key={alert.id} className={`border rounded-xl p-4 ${alert.riskLevel === 'HIGH' || alert.riskLevel === 'CRITICAL' ? 'bg-red-50/50 border-red-200' : alert.riskLevel === 'MEDIUM' ? 'bg-yellow-50/50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${alert.riskLevel === 'HIGH' || alert.riskLevel === 'CRITICAL' ? 'text-red-500' : alert.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-400'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">{alert.title}</span>
                            <Badge className={`text-xs ${config.color}`}>{alert.riskLevel}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                          {alert.metric && (
                            <p className="text-xs text-gray-400 mb-1">
                              {alert.metric}: {alert.actualValue} (batas: {alert.threshold})
                            </p>
                          )}
                          <p className="text-xs text-blue-600 font-medium">Saran: {alert.recommendation}</p>
                          {alert.legalBasis && (
                            <p className="text-xs text-gray-400 mt-1">Dasar: {alert.legalBasis}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
