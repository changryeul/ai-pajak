'use client';
import { MonthlyPayslipTab } from '@/components/pph21/MonthlyPayslipTab';

export function CustomerMirrorToggle({ customerId }: { customerId: string }) {
  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        고객이 자기 화면에서 보는 급여명세입니다 (읽기 전용 미러).
      </p>
      <MonthlyPayslipTab customerId={customerId} />
    </div>
  );
}
