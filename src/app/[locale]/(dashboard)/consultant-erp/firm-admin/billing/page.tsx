'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Receipt, TrendingUp } from 'lucide-react';

export default function FirmAdminBillingPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 p-6 md:p-8 text-white mb-6">
        <p className="text-indigo-100 text-sm flex items-center gap-2">
          <CreditCard className="h-4 w-4" />세무 컨설팅 법인 관리
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">청구·구독 관리</h1>
        <p className="text-indigo-100 text-sm mt-1">
          현재 Tier 상태 · 결제 이력 · 업그레이드 요청 (P6.2 스캐폴딩)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-indigo-600" />현재 구독</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Tier (Starter / Growth / Enterprise) · 클라이언트 한도 · 다음 결제일.
            <div className="mt-3 rounded-md bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400">
              endpoint 대기
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" />Tier 업그레이드</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            클라이언트 수 증가 시 상위 Tier 로 전환. Midtrans 결제 후 즉시 반영.
            <div className="mt-3 rounded-md bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400">
              UI 구현 대기
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-slate-600" />결제 이력</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            <div className="rounded-md bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              tax_partner_subscription 이력 + billing_transaction CONS-*
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
