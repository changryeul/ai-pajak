'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Gift, Copy, CheckCircle, Users, DollarSign, Share2,
  Loader2, Sparkles, ArrowRight, MessageCircle,
} from 'lucide-react';

interface ReferralData {
  referralCode: string;
  referralUrl: string;
  rewards: { referrerReward: string; refereeReward: string; maxReferrals: number };
  stats: { totalReferrals: number; pendingRewards: number; earnedRewards: number };
}

export default function ReferralPage() {
  const t = useTranslations('killer');
  const tr = useTranslations('referral');
  const { session, isLoading: sessionLoading } = useSession();
  const [data, setData] = useState<ReferralData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  const loadData = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const res = await fetch('/api/referral');
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) { console.error(err); }
    finally { setDataLoading(false); }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  const copyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error(err); }
  };

  const shareWhatsApp = () => {
    if (!data) return;
    const text = tr('whatsappShare', { reward: data.rewards.refereeReward, url: data.referralUrl });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-700 via-rose-600 to-red-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-pink-200 text-sm flex items-center gap-2">
            <Gift className="h-4 w-4" />{t('referral.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('referral.title')}</h1>
          <p className="text-pink-200 mt-2 text-sm">{t('referral.subtitle')}</p>

          {data && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-pink-200 text-xs">{t('referral.referrerReward')}</p>
                <p className="font-bold text-lg">{data.rewards.referrerReward}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-pink-200 text-xs">{t('referral.refereeReward')}</p>
                <p className="font-bold text-lg">{data.rewards.refereeReward}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-pink-200 text-xs">{t('referral.totalReferrals')}</p>
                <p className="font-bold text-lg">{tr('countPeople', { count: data?.stats.totalReferrals || 0 })}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
      ) : data ? (
        <div className="space-y-4">
          {/* Referral Link */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm mb-3">{t('referral.myLink')}</h3>
              <div className="flex gap-2">
                <Input value={data.referralUrl} readOnly className="font-mono text-xs bg-gray-50" />
                <Button onClick={copyCode} variant="outline" className="flex-shrink-0">
                  {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="text-xs bg-pink-100 text-pink-700 font-mono">{data.referralCode}</Badge>
                <span className="text-xs text-gray-400">{t('referral.referralCode')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={shareWhatsApp} className="bg-green-600 hover:bg-green-700">
              <MessageCircle className="h-4 w-4 mr-2" />{t('referral.shareWhatsApp')}
            </Button>
            <Button onClick={copyCode} variant="outline">
              <Copy className="h-4 w-4 mr-2" />{copied ? t('referral.copied') : t('referral.copyLink')}
            </Button>
          </div>

          {/* How it works */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />{t('referral.howItWorks')}
              </h3>
              <div className="space-y-3">
                {[
                  { step: 1, icon: Share2, title: t('referral.step1'), desc: t('referral.step1Desc') },
                  { step: 2, icon: Users, title: t('referral.step2'), desc: t('referral.step2Desc', { reward: data.rewards.refereeReward }) },
                  { step: 3, icon: DollarSign, title: t('referral.step3'), desc: t('referral.step3Desc', { reward: data.rewards.referrerReward }) },
                ].map(item => {
                                    return (
                    <div key={item.step} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-pink-700">{item.step}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      {item.step < 3 && <ArrowRight className="h-4 w-4 text-gray-300" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm mb-3">{t('referral.myStats')}</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{t('referral.totalReferrals')}</p>
                  <p className="font-bold text-lg">{data.stats.totalReferrals}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <p className="text-xs text-yellow-600">{t('referral.pending')}</p>
                  <p className="font-bold text-lg">{data.stats.pendingRewards}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">{t('referral.earned')}</p>
                  <p className="font-bold text-lg">{data.stats.earnedRewards}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
