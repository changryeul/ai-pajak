'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, UserCheck, ClipboardList } from 'lucide-react';

export default function FirmAdminClientsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 p-6 md:p-8 text-white mb-6">
        <p className="text-indigo-100 text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4" />세무 컨설팅 법인 관리
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">클라이언트 관리</h1>
        <p className="text-indigo-100 text-sm mt-1">
          자기 회사의 클라이언트를 소속 직원에게 배정·재배정 (P6.2 스캐폴딩)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-indigo-600" />배정 관리</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            클라이언트별 담당 직원 지정·변경. 이전 이력 audit_log 기록.
            <div className="mt-3 rounded-md bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400">
              UI 구현 대기
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-emerald-600" />워크로드 분포</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            직원별 담당 클라이언트 수 · 미배정 클라이언트 카운트.
            <div className="mt-3 rounded-md bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400">
              endpoint 대기
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-slate-600" />전체 클라이언트 목록</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            <div className="rounded-md bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              INDIVIDUAL / COMPANY · 활성 여부 · 담당 직원 · 최근 신고
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
