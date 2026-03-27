'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gift, Copy, Check, Users, DollarSign } from 'lucide-react';

export default function ReferralPage() {
  const [data, setData] = useState<{ referralCode: string; referralUrl: string; rewards: { referrerReward: string; refereeReward: string }; stats: { totalReferrals: number; earnedRewards: number } } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referral').then(r => r.json()).then(d => { if (d.success) setData(d.data); }).catch(() => {});
  }, []);

  const copyLink = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Gift className="h-6 w-6 text-purple-600" />Program Referral
      </h1>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-indigo-50 mb-6">
        <CardContent className="p-6 text-center">
          <Gift className="h-10 w-10 text-purple-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Ajak Teman, Dapat Hadiah!</h2>
          <p className="text-sm text-gray-600 mt-1">Anda dapat {data?.rewards.referrerReward}, teman Anda dapat {data?.rewards.refereeReward}</p>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader><CardTitle className="text-base">Link Referral Anda</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={data.referralUrl} readOnly className="font-mono text-xs" />
                <Button onClick={copyLink} variant="outline">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Kode: <span className="font-mono font-bold">{data.referralCode}</span></p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm"><CardContent className="p-5 text-center">
              <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{data.stats.totalReferrals}</p>
              <p className="text-xs text-gray-500">Total Referral</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-5 text-center">
              <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">Rp {data.stats.earnedRewards.toLocaleString('id-ID')}</p>
              <p className="text-xs text-gray-500">Total Hadiah</p>
            </CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}
