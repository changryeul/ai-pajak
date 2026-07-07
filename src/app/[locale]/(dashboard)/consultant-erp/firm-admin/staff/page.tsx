'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, ShieldCheck } from 'lucide-react';

export default function FirmAdminStaffPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 p-6 md:p-8 text-white mb-6">
        <p className="text-indigo-100 text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />세무 컨설팅 법인 관리
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">직원 관리</h1>
        <p className="text-indigo-100 text-sm mt-1">
          자기 회사 안의 컨설턴트·세무사 초대·비활성화·자격증 임명 (P6.2 스캐폴딩)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-indigo-600" />직원 초대</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            이메일 초대 · 역할 선택 (CONSULTANT / TAX_ADVISOR) · 자동 tax_partner 연결.
            <div className="mt-3 rounded-md bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400">
              UI 구현 대기 (P6.2 다음 iteration)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />세무사 자격증 임명</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            컨설턴트 중에서 TAX_ADVISOR 로 승격 (자격증 소지자). Hard Rule 3 —
            자기 이름 신고를 위해 최소 1명 필요.
            <div className="mt-3 rounded-md bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400">
              UI 구현 대기
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-slate-600" />활성 직원 목록</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            <div className="rounded-md bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              직원 목록 · workload · 마지막 활동 시각 (endpoint 대기)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
