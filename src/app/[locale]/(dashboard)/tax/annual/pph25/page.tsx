'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Building2, AlertTriangle } from 'lucide-react';

export default function PPh25AnnualPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          연 결산 — PPh 25 (일반 법인세)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          PPh Badan 22% 일반 법인세 연간 정산 및 SPT Tahunan Badan 1771 작성
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-amber-900">준비 중</p>
          <p className="text-sm text-amber-700 mt-2">
            PPh 25 일반 법인세 연 결산 기능은 현재 개발 중입니다.
          </p>
          <p className="text-xs text-amber-600 mt-3">
            일반 법인 결산에는 재무제표 분석, 세무 조정(Koreksi Fiskal), 이월결손금 공제,
            세액공제 정산 등 복잡한 프로세스가 포함됩니다.
            JTC 세무사에게 직접 문의하시기 바랍니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
