'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Clock, Play, Loader2, CheckCircle, XCircle, RefreshCw,
  Newspaper, Bell, CreditCard, FileText, Trash2, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CronJob {
  id: string;
  name: string;
  endpoint: string;
  schedule: string;
  scheduleDesc: string;
  icon: typeof Clock;
  description: string;
  isEnabled: boolean;
  lastStatus?: 'success' | 'error' | 'running' | 'skipped' | null;
  lastResult?: string;
  lastDuration?: string;
  lastRunAt?: string;
}

const CRON_JOBS: CronJob[] = [
  {
    id: 'deadline-reminders',
    name: '마감 리마인더',
    endpoint: '/api/cron/deadline-reminders',
    schedule: '0 8 * * *',
    scheduleDesc: '매일 08:00',
    icon: Bell,
    description: '세금 마감일 D-30/14/7/3/1 알림 (이메일 + WhatsApp)',
    isEnabled: true,
  },
  {
    id: 'payment-reminders',
    name: '납부 리마인더',
    endpoint: '/api/cron/payment-reminders',
    schedule: '0 9 * * *',
    scheduleDesc: '매일 09:00',
    icon: CreditCard,
    description: '미납 세금 납부 촉구 알림 (WhatsApp + in-app)',
    isEnabled: true,
  },
  {
    id: 'monthly-report',
    name: '월간 리포트',
    endpoint: '/api/cron/monthly-report',
    schedule: '0 10 1 * *',
    scheduleDesc: '매월 1일 10:00',
    icon: FileText,
    description: '월간 세금 분석 리포트 생성 + 알림',
    isEnabled: true,
  },
  {
    id: 'news-fetch',
    name: '세금 뉴스 수집',
    endpoint: '/api/cron/news-fetch',
    schedule: '0 7 * * *',
    scheduleDesc: '매일 07:00',
    icon: Newspaper,
    description: 'Google News RSS → AI 요약 (한/영/인니) → DB 저장',
    isEnabled: true,
  },
  {
    id: 'cleanup-expired-tokens',
    name: '만료 토큰 정리',
    endpoint: '/api/cron/cleanup-expired-tokens',
    schedule: '0 0 * * *',
    scheduleDesc: '매일 00:00',
    icon: Trash2,
    description: '만료된 세션/인증 토큰 정리',
    isEnabled: true,
  },
];

export default function AdminCronPage() {
  const [cronSecret, setCronSecret] = useState('');
  const [jobs, setJobs] = useState<CronJob[]>(CRON_JOBS);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Load DB cron settings on mount
  useEffect(() => {
    fetch('/api/admin/cron')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setJobs(prev => prev.map(job => {
            const dbSetting = data.data.find((s: { id: string }) => s.id === job.id);
            if (dbSetting) {
              return {
                ...job,
                isEnabled: dbSetting.is_enabled,
                lastStatus: dbSetting.last_status || null,
                lastDuration: dbSetting.last_duration_ms ? `${dbSetting.last_duration_ms}ms` : undefined,
                lastRunAt: dbSetting.last_run_at || undefined,
                lastResult: dbSetting.last_result ? JSON.stringify(dbSetting.last_result, null, 2) : undefined,
              };
            }
            return job;
          }));
        }
      })
      .catch(() => {});
  }, []);

  const toggleJob = async (jobId: string, currentEnabled: boolean) => {
    setTogglingId(jobId);
    try {
      const res = await fetch('/api/admin/cron', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, is_enabled: !currentEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, isEnabled: !currentEnabled } : j));
      }
    } catch { /* */ }
    finally { setTogglingId(null); }
  };

  const runJob = async (job: CronJob) => {
    if (!cronSecret) {
      alert('CRON_SECRET을 입력해주세요');
      return;
    }

    setRunningId(job.id);
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, lastStatus: 'running' as const, lastResult: undefined } : j));

    try {
      const res = await fetch(job.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        lastStatus: (res.ok && data.success !== false ? 'success' : 'error') as 'success' | 'error',
        lastResult: JSON.stringify(data, null, 2),
        lastDuration: data.duration || `${Date.now()}ms`,
      } : j));
    } catch (err) {
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        lastStatus: 'error' as const,
        lastResult: err instanceof Error ? err.message : 'Failed',
      } : j));
    } finally {
      setRunningId(null);
    }
  };

  const checkHealth = async (job: CronJob) => {
    try {
      const res = await fetch(job.endpoint);
      const data = await res.json();
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        lastStatus: data.status === 'ok' ? 'success' as const : 'error' as const,
        lastResult: JSON.stringify(data, null, 2),
      } : j));
    } catch {
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        lastStatus: 'error' as const,
        lastResult: 'Health check failed',
      } : j));
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-gray-400 text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />Admin
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Cron 작업 관리</h1>
          <p className="text-gray-400 mt-2 text-sm">예약 작업 모니터링 + 수동 실행</p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-gray-400 text-xs">등록 작업</p>
              <p className="font-bold text-lg">{CRON_JOBS.length}개</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-gray-400 text-xs">일간 실행</p>
              <p className="font-bold text-lg">{CRON_JOBS.filter(j => j.schedule.includes('* * *') && !j.schedule.includes('1 * *')).length}개</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-gray-400 text-xs">월간 실행</p>
              <p className="font-bold text-lg">{CRON_JOBS.filter(j => j.schedule.includes('1 * *')).length}개</p>
            </div>
          </div>
        </div>
      </div>

      {/* CRON_SECRET Input */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-4">
          <Label className="text-xs text-gray-500">CRON_SECRET (수동 실행 시 필요)</Label>
          <Input
            type="password"
            value={cronSecret}
            onChange={e => setCronSecret(e.target.value)}
            placeholder="CRON_SECRET 입력..."
            className="mt-1 font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Job Cards */}
      <div className="space-y-3">
        {jobs.map(job => {
          const Icon = job.icon;
          const isRunning = runningId === job.id;

          return (
            <Card key={job.id} className={cn(
              'border-0 shadow-sm transition-all',
              job.lastStatus === 'success' && 'border-l-4 border-l-green-500',
              job.lastStatus === 'error' && 'border-l-4 border-l-red-500',
              job.lastStatus === 'running' && 'border-l-4 border-l-blue-500',
            )}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg mt-0.5">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{job.name}</h3>
                        <Badge variant="outline" className="text-[10px] font-mono">{job.schedule}</Badge>
                        <span className="text-[10px] text-gray-400">{job.scheduleDesc}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{job.description}</p>
                      <p className="text-[10px] text-gray-300 font-mono mt-1">{job.endpoint}</p>
                      {job.lastRunAt && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          마지막 실행: {new Date(job.lastRunAt).toLocaleString('ko-KR')}
                        </p>
                      )}
                      {!job.isEnabled && (
                        <Badge className="text-[10px] bg-red-100 text-red-600 mt-1">비활성</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 items-center">
                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => toggleJob(job.id, job.isEnabled)}
                      disabled={togglingId === job.id}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        job.isEnabled ? 'bg-green-500' : 'bg-gray-300',
                        togglingId === job.id && 'opacity-50'
                      )}
                    >
                      <span className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                        job.isEnabled ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => checkHealth(job)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />Health
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                      disabled={isRunning || !cronSecret || !job.isEnabled}
                      onClick={() => runJob(job)}
                    >
                      {isRunning ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      실행
                    </Button>
                  </div>
                </div>

                {/* Result */}
                {job.lastStatus && (
                  <div className={cn(
                    'mt-3 rounded-lg p-3 text-xs',
                    job.lastStatus === 'success' && 'bg-green-50',
                    job.lastStatus === 'error' && 'bg-red-50',
                    job.lastStatus === 'running' && 'bg-blue-50',
                  )}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {job.lastStatus === 'success' && <CheckCircle className="h-3 w-3 text-green-500" />}
                      {job.lastStatus === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
                      {job.lastStatus === 'running' && <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />}
                      <span className="font-medium">
                        {job.lastStatus === 'success' ? '성공' : job.lastStatus === 'error' ? '실패' : '실행 중...'}
                      </span>
                      {job.lastDuration && <span className="text-gray-400">({job.lastDuration})</span>}
                    </div>
                    {job.lastResult && (
                      <pre className="text-[10px] text-gray-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {job.lastResult}
                      </pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Schedule Overview */}
      <Card className="border-0 shadow-sm mt-6">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />일간 실행 타임라인
          </h3>
          <div className="space-y-1.5">
            {[...CRON_JOBS]
              .sort((a, b) => {
                const timeA = a.schedule.split(' ').slice(0, 2).reverse().join('');
                const timeB = b.schedule.split(' ').slice(0, 2).reverse().join('');
                return timeA.localeCompare(timeB);
              })
              .map(job => {
                const Icon = job.icon;
                const parts = job.schedule.split(' ');
                const hour = parts[1];
                const minute = parts[0];
                return (
                  <div key={job.id} className="flex items-center gap-3 text-xs">
                    <span className="font-mono w-12 text-gray-400">{hour.padStart(2, '0')}:{minute.padStart(2, '0')}</span>
                    <Icon className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-700">{job.name}</span>
                    <span className="text-gray-300">—</span>
                    <span className="text-gray-400">{job.scheduleDesc}</span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
