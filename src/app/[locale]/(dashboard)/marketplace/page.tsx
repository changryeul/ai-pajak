'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Star, ShieldCheck, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

interface Consultant { id: string; firmName: string; isLicensed: boolean; activeClients: number; rating: number; specializations: string[]; }

export default function MarketplacePage() {
  const t = useTranslations('pages');
  const tm = useTranslations('marketplace');
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/consultants').then(r => r.json()).then(d => {
      if (d.success) setConsultants(d.data.consultants);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  const filtered = consultants.filter(c => c.firmName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
        <Users className="h-6 w-6 text-blue-600" />{t('marketplaceTitle')}
      </h1>
      <p className="text-gray-500 mb-6">{t('marketplaceDesc')}</p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder={tm('searchFirm')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">{tm('noConsultants')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(c => (
            <Card key={c.id} className="border-0 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{c.firmName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {c.isLicensed && <Badge className="bg-green-100 text-green-700 text-[10px]"><ShieldCheck className="h-3 w-3 mr-0.5" />Licensed</Badge>}
                      <span className="text-xs text-gray-500 flex items-center gap-0.5"><Star className="h-3 w-3 text-yellow-500" />{c.rating}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{c.activeClients} {tm('clients')}</span>
                </div>
                <Button size="sm" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">{t('contact')}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
