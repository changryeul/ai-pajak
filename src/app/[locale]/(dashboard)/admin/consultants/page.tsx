'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users, ShieldCheck, Briefcase, Loader2, Search,
  UserCheck, UserX, FileText, Building2, Edit2, Check,
} from 'lucide-react';

interface Consultant {
  id: string; email: string; firmName: string; isActive: boolean;
  isAdvisor: boolean; licenseNumber?: string; specializations: string[];
  advisorActive: boolean; activeClients: number; totalClients: number; filingCount: number;
}

export default function AdminConsultantsPage() {
  const t = useTranslations('admin');
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [stats, setStats] = useState<{ totalConsultants: number; activeConsultants: number; licensedAdvisors: number; totalClients: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingLicense, setEditingLicense] = useState<string | null>(null);
  const [licenseInput, setLicenseInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/consultants');
      const data = await res.json();
      if (data.success) { setConsultants(data.data.consultants); setStats(data.data.stats); }
    } catch { /* */ }
    finally { setIsLoading(false); }
  };

  const doAction = async (consultantId: string, action: string, extra?: Record<string, unknown>) => {
    await fetch('/api/admin/consultants', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultantId, action, ...extra }),
    });
    setMessage(`${action} success`);
    setTimeout(() => setMessage(null), 3000);
    setEditingLicense(null);
    loadData();
  };

  const filtered = consultants.filter(c => !search || c.email.toLowerCase().includes(search.toLowerCase()) || c.firmName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-red-600 to-rose-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-orange-200 text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" />{t('admin')}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('consultantMgmt')}</h1>
          {stats && (
            <div className="grid grid-cols-4 gap-3 mt-6">
              {[
                { label: t('totalLabel'), value: stats.totalConsultants },
                { label: t('activeLabel'), value: stats.activeConsultants },
                { label: t('licensedLabel'), value: stats.licensedAdvisors },
                { label: t('totalClients'), value: stats.totalClients },
              ].map((s, i) => (
                <div key={i} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-[10px] text-orange-200">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">{message}</div>}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder={t('searchEmailFirm')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Card key={c.id} className="border-0 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${c.isAdvisor ? 'from-purple-500 to-violet-600' : 'from-green-500 to-emerald-600'} ${!c.isActive ? 'opacity-40' : ''}`}>
                    {c.isAdvisor ? <ShieldCheck className="h-5 w-5 text-white" /> : <Briefcase className="h-5 w-5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{c.email}</span>
                      <Badge className={c.isAdvisor ? 'bg-purple-100 text-purple-700 text-[10px]' : 'bg-green-100 text-green-700 text-[10px]'}>
                        {c.isAdvisor ? t('taxAdvisor') : t('consultant')}
                      </Badge>
                      {!c.isActive && <Badge className="bg-red-100 text-red-700 text-[10px]">{t('inactive')}</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{c.firmName}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.activeClients} {t('activeClients')}</span>
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{c.filingCount} {t('filingLabel')}</span>
                      {c.licenseNumber && (
                        <span className="flex items-center gap-1 font-mono">
                          <ShieldCheck className="h-3 w-3 text-purple-500" />{c.licenseNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* License edit */}
                    {c.isAdvisor && editingLicense === c.id ? (
                      <div className="flex gap-1">
                        <Input className="text-xs h-7 w-32 font-mono" value={licenseInput} onChange={e => setLicenseInput(e.target.value)} placeholder="License No" />
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => doAction(c.id, 'update-license', { licenseNumber: licenseInput })}>
                          <Check className="h-3 w-3 text-green-600" />
                        </Button>
                      </div>
                    ) : c.isAdvisor ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingLicense(c.id); setLicenseInput(c.licenseNumber || ''); }}>
                        <Edit2 className="h-3 w-3 mr-1" />{t('license')}
                      </Button>
                    ) : null}

                    {c.isActive ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => doAction(c.id, 'deactivate')}>
                        <UserX className="h-3 w-3 mr-1" />{t('deactivate')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => doAction(c.id, 'activate')}>
                        <UserCheck className="h-3 w-3 mr-1" />{t('activate')}
                      </Button>
                    )}
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
