'use client';

import { useState, useEffect, useCallback } from 'react';
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
    } catch { /* */ }
    finally { setDataLoading(false); }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  const copyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  const shareWhatsApp = () => {
    if (!data) return;
    const text = `AI Pajak으로 세금 신고가 쉬워졌어요! 🎉\n\n가입하면 ${data.rewards.refereeReward}을 받을 수 있습니다.\n\n${data.referralUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-700 via-rose-600 to-red-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-pink-200 text-sm flex items-center gap-2">
            <Gift className="h-4 w-4" />Referral Program
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">친구 추천 프로그램</h1>
          <p className="text-pink-200 mt-2 text-sm">친구를 초대하면 양쪽 모두 크레딧을 받습니다</p>

          {data && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-pink-200 text-xs">추천인 보상</p>
                <p className="font-bold text-lg">{data.rewards.referrerReward}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-pink-200 text-xs">피추천인 보상</p>
                <p className="font-bold text-lg">{data.rewards.refereeReward}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-pink-200 text-xs">총 추천</p>
                <p className="font-bold text-lg">{data?.stats.totalReferrals || 0}명</p>
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
              <h3 className="font-bold text-sm mb-3">내 추천 링크</h3>
              <div className="flex gap-2">
                <Input value={data.referralUrl} readOnly className="font-mono text-xs bg-gray-50" />
                <Button onClick={copyCode} variant="outline" className="flex-shrink-0">
                  {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="text-xs bg-pink-100 text-pink-700 font-mono">{data.referralCode}</Badge>
                <span className="text-xs text-gray-400">추천 코드</span>
              </div>
            </CardContent>
          </Card>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={shareWhatsApp} className="bg-green-600 hover:bg-green-700">
              <MessageCircle className="h-4 w-4 mr-2" />WhatsApp 공유
            </Button>
            <Button onClick={copyCode} variant="outline">
              <Copy className="h-4 w-4 mr-2" />{copied ? '복사됨!' : '링크 복사'}
            </Button>
          </div>

          {/* How it works */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />이용 방법
              </h3>
              <div className="space-y-3">
                {[
                  { step: 1, icon: Share2, title: '링크 공유', desc: '추천 링크를 친구에게 공유합니다' },
                  { step: 2, icon: Users, title: '친구 가입', desc: `친구가 링크로 가입하면 ${data.rewards.refereeReward} 지급` },
                  { step: 3, icon: DollarSign, title: '보상 수령', desc: `친구가 첫 결제 시 추천인에게 ${data.rewards.referrerReward}` },
                ].map(item => {
                  const Icon = item.icon;
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
              <h3 className="font-bold text-sm mb-3">내 추천 현황</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">총 추천</p>
                  <p className="font-bold text-lg">{data.stats.totalReferrals}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <p className="text-xs text-yellow-600">대기 보상</p>
                  <p className="font-bold text-lg">{data.stats.pendingRewards}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">지급 완료</p>
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
