# AI PAJAK - Phase 1 상담원(Tax Operator) 워크플로우

## 문서 개요

**목적**: DJP API 연동 전 Phase 1에서 세무 상담원(Tax Operator)이 수행할 업무 프로세스 정의
**Phase 1 특징**: DJP API 계약 미체결 → 모든 DJP 제출 작업은 상담원이 수작업으로 진행
**Phase 2 전환**: DJP API 연동 완료 후 자동화로 전환

**관련 문서**: [메인 PRD](/docs/PRD.md)

---

## 1. Phase 1 운영 전략

### 1.1 왜 Phase 1이 필요한가?

**문제**: DJP(인도네시아 국세청) API 연동 계약 승인 대기 중
**해결**: 세무 상담원이 중간 계층 역할 수행

```
[고객] → [AI PAJAK 플랫폼] → [상담원] → [DJP 웹사이트(수작업)] → [BPE 발급]
                ↑                                                      ↓
                └──────────────────── BPE 업로드 ←────────────────────┘
```

### 1.2 Phase 1 vs Phase 2 비교

| 단계 | DJP 제출 방식 | 상담원 역할 | 처리 시간 | 자동화 수준 |
|------|--------------|------------|----------|------------|
| **Phase 1** | 수작업 (DJP 웹사이트 직접 입력) | 필수 (35명 고객 담당) | 4-6시간/월 | 20% |
| **Phase 2** | API 자동 제출 | 모니터링만 | 5분/월 | 95% |

### 1.3 Phase 1에서 자동화되는 것

✅ **완전 자동화**:
- 세금 계산 (PPh 21/23/PPN 등)
- e-Billing 코드 생성
- 고객 알림 발송 (이메일/WhatsApp)
- 마감일 추적 및 리마인더

❌ **수작업 필요**:
- DJP 웹사이트 로그인
- 세금 신고서 입력 (복사-붙여넣기)
- BPE(Bukti Penerimaan Elektronik) 다운로드
- BPE 시스템 업로드

---

## 2. Tax Operator(상담원) 정의

### 2.1 역할 및 권한

```typescript
interface TaxOperator {
  // 기본 정보
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;

  // 역할
  role: 'tax_operator' | 'tax_operator_lead' | 'tax_operator_supervisor';

  // 담당 고객
  assignedClients: string[]; // 최대 35개 법인
  maxClients: number; // 기본값: 35

  // 권한
  permissions: {
    canViewClientData: boolean; // ✅ 모든 고객 데이터 조회
    canEditClientData: boolean; // ❌ 수정 불가 (고객만 가능)
    canGenerateEBilling: boolean; // ✅ e-Billing 생성
    canSubmitToDJP: boolean; // ✅ DJP 제출 (수작업)
    canUploadBPE: boolean; // ✅ BPE 업로드
    canViewAllOperators: boolean; // Role에 따라 다름
  };

  // 실적
  performance: {
    totalSubmissionsThisMonth: number;
    averageProcessingTimeMinutes: number;
    errorRate: number; // BPE 거부율
    clientSatisfactionScore: number; // 1-5점
  };

  // 근무 정보
  workSchedule: {
    timezone: string; // 'Asia/Jakarta'
    workingHours: { start: string; end: string }; // '09:00' - '18:00'
  };

  status: 'active' | 'on_leave' | 'inactive';
  hireDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 역할별 권한

| 권한 | Operator | Lead | Supervisor |
|------|----------|------|------------|
| 고객 데이터 조회 | ✅ 담당 35개만 | ✅ 모든 고객 | ✅ 모든 고객 |
| e-Billing 생성 | ✅ | ✅ | ✅ |
| DJP 제출 | ✅ | ✅ | ✅ |
| 타 상담원 실적 조회 | ❌ | ✅ | ✅ |
| 고객 재배정 | ❌ | ✅ | ✅ |
| 상담원 계정 관리 | ❌ | ❌ | ✅ |

### 2.3 데이터베이스 스키마

```sql
-- 상담원 테이블
CREATE TABLE tax_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id), -- Auth 연동 (TBD: Firebase/Supabase/Clerk)

  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),

  role VARCHAR(30) NOT NULL DEFAULT 'tax_operator',
  max_clients INT NOT NULL DEFAULT 35,

  permissions JSONB NOT NULL DEFAULT '{
    "canViewClientData": true,
    "canEditClientData": false,
    "canGenerateEBilling": true,
    "canSubmitToDJP": true,
    "canUploadBPE": true,
    "canViewAllOperators": false
  }',

  work_schedule JSONB NOT NULL DEFAULT '{
    "timezone": "Asia/Jakarta",
    "workingHours": {"start": "09:00", "end": "18:00"}
  }',

  status VARCHAR(20) NOT NULL DEFAULT 'active',
  hire_date DATE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CHECK (role IN ('tax_operator', 'tax_operator_lead', 'tax_operator_supervisor')),
  CHECK (status IN ('active', 'on_leave', 'inactive'))
);

-- 상담원-고객 배정 테이블
CREATE TABLE operator_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES tax_operators(id) ON DELETE CASCADE,
  client_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,

  assignment_reason TEXT, -- '신규 고객', '재배정', '휴가 대체'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(operator_id, client_id, assigned_date)
);

-- 상담원 실적 추적 테이블
CREATE TABLE operator_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES tax_operators(id) ON DELETE CASCADE,

  period_month INT NOT NULL, -- 1-12
  period_year INT NOT NULL,

  total_submissions INT DEFAULT 0,
  successful_submissions INT DEFAULT 0,
  failed_submissions INT DEFAULT 0,

  total_processing_time_minutes INT DEFAULT 0,
  average_processing_time_minutes DECIMAL(10,2),

  client_satisfaction_score DECIMAL(3,2), -- 1.00 - 5.00

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(operator_id, period_month, period_year)
);

-- 인덱스
CREATE INDEX idx_operator_client_assignments_operator
  ON operator_client_assignments(operator_id) WHERE unassigned_date IS NULL;
CREATE INDEX idx_operator_client_assignments_client
  ON operator_client_assignments(client_id) WHERE unassigned_date IS NULL;
CREATE INDEX idx_operator_performance_period
  ON operator_performance_logs(period_year, period_month);
```

---

## 3. 월간 워크플로우 사이클

### 3.1 전체 타임라인 (매월)

```
Day 1-10:  [고객 데이터 수집 기간]
           ↓
Day 11:    [상담원 검토 시작]
           ↓
Day 12-14: [e-Billing 일괄 생성]
           ↓
Day 15:    [고객 납부 확인]
           ↓
Day 16-20: [DJP 수작업 제출]
           ↓
Day 21:    [BPE 업로드 및 고객 알림]
```

### 3.2 Step-by-Step 워크플로우

#### Step 1: 데이터 수집 기간 (Day 1-10)

**고객 액션**:
1. AI PAJAK 플랫폼에 로그인
2. 급여 데이터 입력 (PPh 21)
3. 거래 송장 업로드 (OCR → PPh 23)
4. 매출/매입 데이터 입력 (PPN)

**상담원 액션**:
- 대시보드에서 진행률 모니터링
- 미입력 고객에게 리마인더 발송 (자동)

**시스템 자동화**:
```typescript
// 매일 오전 9시 실행 (Vercel Cron)
async function sendDataCollectionReminders() {
  const currentDay = new Date().getDate();

  if (currentDay >= 1 && currentDay <= 10) {
    // 데이터 미입력 고객 조회
    const incompleteClients = await db.companies.findMany({
      where: {
        taxDocuments: {
          none: {
            period_month: getCurrentMonth(),
            status: 'draft'
          }
        }
      }
    });

    // 리마인더 발송
    for (const client of incompleteClients) {
      await sendNotification({
        to: client.email,
        type: 'data_collection_reminder',
        daysLeft: 10 - currentDay
      });
    }
  }
}
```

#### Step 2: 상담원 검토 시작 (Day 11)

**상담원 대시보드** 표시 항목:

```typescript
interface OperatorDashboard {
  // 담당 고객 35개 요약
  clientsSummary: {
    total: number; // 35
    dataComplete: number; // 30
    dataIncomplete: number; // 5
    readyForEBilling: number; // 30
  };

  // 고객별 상태
  clients: Array<{
    clientId: string;
    companyName: string;
    npwp: string;

    // 세금 유형별 상태
    pph21Status: 'complete' | 'incomplete' | 'not_applicable';
    pph23Status: 'complete' | 'incomplete' | 'not_applicable';
    ppnStatus: 'complete' | 'incomplete' | 'not_applicable';

    // 데이터 품질
    dataQualityScore: number; // 0-100
    missingFields: string[]; // ['employee_npwp', 'invoice_date']

    // 예상 세금
    estimatedTaxAmount: number;
  }>;

  // 이번 달 실적
  thisMonthPerformance: {
    submissionsCompleted: number;
    averageProcessingTime: number;
  };
}
```

**상담원 검토 작업**:
1. 데이터 완성도 확인
2. 누락 필드 고객에게 요청 (시스템 내 메시지)
3. 세금 계산 결과 검증 (자동 계산 확인)

**UI 구현**:
```typescript
// /src/app/[locale]/(operator)/dashboard/page.tsx
'use client';

import { useOperatorDashboard } from '@/hooks/use-operator-dashboard';

export default function OperatorDashboardPage() {
  const { clients, summary, isLoading } = useOperatorDashboard();

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardTitle>전체 고객</CardTitle>
          <CardContent className="text-3xl">{summary.total}</CardContent>
        </Card>
        <Card>
          <CardTitle>데이터 완료</CardTitle>
          <CardContent className="text-3xl text-green-600">
            {summary.dataComplete}
          </CardContent>
        </Card>
        <Card>
          <CardTitle>데이터 미완료</CardTitle>
          <CardContent className="text-3xl text-red-600">
            {summary.dataIncomplete}
          </CardContent>
        </Card>
        <Card>
          <CardTitle>e-Billing 생성 대기</CardTitle>
          <CardContent className="text-3xl text-blue-600">
            {summary.readyForEBilling}
          </CardContent>
        </Card>
      </div>

      {/* 고객 리스트 */}
      <DataTable
        columns={[
          { header: '회사명', accessorKey: 'companyName' },
          { header: 'NPWP', accessorKey: 'npwp' },
          {
            header: 'PPh 21',
            accessorKey: 'pph21Status',
            cell: (row) => <StatusBadge status={row.pph21Status} />
          },
          {
            header: 'PPh 23',
            accessorKey: 'pph23Status',
            cell: (row) => <StatusBadge status={row.pph23Status} />
          },
          {
            header: 'PPN',
            accessorKey: 'ppnStatus',
            cell: (row) => <StatusBadge status={row.ppnStatus} />
          },
          {
            header: '예상 세금',
            accessorKey: 'estimatedTaxAmount',
            cell: (row) => formatCurrency(row.estimatedTaxAmount, 'IDR')
          },
          {
            header: '액션',
            cell: (row) => (
              <Button onClick={() => reviewClient(row.clientId)}>
                검토
              </Button>
            )
          }
        ]}
        data={clients}
      />
    </div>
  );
}
```

#### Step 3: e-Billing 일괄 생성 (Day 12-14)

**핵심 기능**: 35개 고객사의 e-Billing 코드 한 번에 생성

**e-Billing 이란?**
- DJP 세금 납부용 고유 코드
- 유효기간: 7일
- 형식: `301234567890123` (15자리)

**일괄 생성 로직**:
```typescript
// /src/lib/operators/bulk-ebilling-generator.ts

interface BulkEBillingResult {
  total: number;
  successful: number;
  failed: number;
  details: Array<{
    clientId: string;
    companyName: string;
    taxType: string;
    eBillingCode: string | null;
    amount: number;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

export class BulkEBillingGenerator {
  static async generateForAllClients(
    operatorId: string,
    period: { month: number; year: number }
  ): Promise<BulkEBillingResult> {
    // 1. 상담원의 담당 고객 조회
    const clients = await db.companies.findMany({
      where: {
        operatorAssignments: {
          some: {
            operatorId,
            unassignedDate: null
          }
        }
      }
    });

    const result: BulkEBillingResult = {
      total: clients.length,
      successful: 0,
      failed: 0,
      details: []
    };

    // 2. 각 고객의 세금 문서 조회
    for (const client of clients) {
      const taxDocs = await db.taxDocuments.findMany({
        where: {
          companyId: client.id,
          periodMonth: period.month,
          periodYear: period.year,
          status: 'ready_for_payment'
        }
      });

      // 3. 세금 유형별 e-Billing 생성
      for (const doc of taxDocs) {
        try {
          const eBilling = await this.generateSingleEBilling({
            taxType: doc.taxType,
            npwp: client.npwp,
            amount: doc.totalTax,
            period
          });

          // 4. DB 저장
          await db.eBillings.create({
            data: {
              code: eBilling.code,
              taxDocumentId: doc.id,
              companyId: client.id,
              amount: doc.totalTax,
              validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일
              status: 'pending_payment'
            }
          });

          // 5. 고객에게 알림 발송
          await this.sendEBillingNotification(client, eBilling, doc);

          result.successful++;
          result.details.push({
            clientId: client.id,
            companyName: client.name,
            taxType: doc.taxType,
            eBillingCode: eBilling.code,
            amount: doc.totalTax,
            status: 'success'
          });

        } catch (error) {
          result.failed++;
          result.details.push({
            clientId: client.id,
            companyName: client.name,
            taxType: doc.taxType,
            eBillingCode: null,
            amount: doc.totalTax,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    // 6. 실적 기록
    await this.logOperatorActivity(operatorId, 'bulk_ebilling_generation', result);

    return result;
  }

  private static async generateSingleEBilling(params: {
    taxType: string;
    npwp: string;
    amount: number;
    period: { month: number; year: number };
  }): Promise<{ code: string; validUntil: Date }> {
    // DJP API 호출 (또는 Phase 1에서는 수동 생성)
    // 실제로는 DJP e-Billing API를 호출해야 함

    // Phase 1 임시: 랜덤 코드 생성 (실제로는 DJP API 사용)
    const code = `30${Math.random().toString().slice(2, 15)}`.slice(0, 15);
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return { code, validUntil };
  }

  private static async sendEBillingNotification(
    client: any,
    eBilling: any,
    taxDoc: any
  ): Promise<void> {
    // 이메일 발송
    await sendEmail({
      to: client.email,
      subject: `[AI PAJAK] e-Billing 코드 발급 - ${taxDoc.taxType}`,
      template: 'ebilling-notification',
      data: {
        companyName: client.name,
        taxType: taxDoc.taxType,
        amount: taxDoc.totalTax,
        eBillingCode: eBilling.code,
        validUntil: eBilling.validUntil,
        paymentInstructions: '인터넷 뱅킹 또는 은행 창구에서 납부 후 증빙을 업로드해주세요.'
      }
    });

    // WhatsApp 발송 (선택)
    if (client.phone) {
      await sendWhatsApp({
        to: client.phone,
        message: `e-Billing 발급: ${eBilling.code}\n금액: ${formatCurrency(taxDoc.totalTax, 'IDR')}\n유효기간: ${formatDate(eBilling.validUntil)}`
      });
    }
  }
}
```

**e-Billing DB 스키마**:
```sql
CREATE TABLE e_billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(15) UNIQUE NOT NULL, -- '301234567890123'

  tax_document_id UUID REFERENCES tax_documents(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  amount BIGINT NOT NULL, -- 세금 금액 (루피아)

  issued_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL, -- 7일 후

  status VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  -- 'pending_payment', 'paid', 'expired', 'cancelled'

  payment_date TIMESTAMP WITH TIME ZONE,
  payment_proof_url VARCHAR(500), -- 고객이 업로드한 납부 증빙

  created_by UUID REFERENCES tax_operators(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CHECK (status IN ('pending_payment', 'paid', 'expired', 'cancelled'))
);

CREATE INDEX idx_ebillings_status ON e_billings(status);
CREATE INDEX idx_ebillings_valid_until ON e_billings(valid_until);
CREATE INDEX idx_ebillings_company ON e_billings(company_id);
```

**상담원 UI - 일괄 생성 버튼**:
```typescript
// /src/components/operator/bulk-ebilling-button.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function BulkEBillingButton({ operatorId }: { operatorId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleBulkGeneration = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch('/api/operators/bulk-ebilling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId,
          period: {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
          }
        })
      });

      const result = await response.json();

      toast({
        title: 'e-Billing 일괄 생성 완료',
        description: `성공: ${result.successful}건, 실패: ${result.failed}건`
      });

      // 결과 상세 모달 표시
      showResultModal(result.details);

    } catch (error) {
      toast({
        title: '오류 발생',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleBulkGeneration}
      disabled={isGenerating}
      size="lg"
    >
      {isGenerating ? '생성 중...' : '📧 35개 고객사 e-Billing 일괄 생성'}
    </Button>
  );
}
```

#### Step 4: 고객 납부 확인 (Day 15)

**고객 액션**:
1. 은행 앱/창구에서 e-Billing 코드로 세금 납부
2. 납부 증빙(BPN: Bukti Penerimaan Negara) 받음
3. AI PAJAK 플랫폼에 BPN 스캔 이미지 업로드

**상담원 액션**:
1. 대시보드에서 납부 완료 고객 확인
2. 미납 고객에게 리마인더 발송
3. 납부 증빙 이미지 검증 (OCR 자동 검증 + 육안 확인)

**납부 증빙 업로드 API**:
```typescript
// /src/app/api/payments/upload-proof/route.ts

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const eBillingId = formData.get('eBillingId') as string;

  // 1. 파일 업로드 (S3)
  const filePath = `payment-proofs/${eBillingId}/${file.name}`;
  const { data: uploadData, error: uploadError } = await storage.bucket('tax-documents')
    .file(filePath)
    .save(file);

  if (uploadError) throw uploadError;

  // 2. OCR로 납부 정보 추출
  const ocrResult = await extractPaymentInfo(filePath);

  // 3. e-Billing 정보와 대조
  const eBilling = await db.eBillings.findUnique({
    where: { id: eBillingId }
  });

  const isValid =
    ocrResult.amount === eBilling.amount &&
    ocrResult.code === eBilling.code;

  // 4. DB 업데이트
  await db.eBillings.update({
    where: { id: eBillingId },
    data: {
      status: isValid ? 'paid' : 'pending_verification',
      paymentDate: ocrResult.paymentDate,
      paymentProofUrl: uploadData.path
    }
  });

  // 5. 상담원에게 알림 (검증 필요한 경우)
  if (!isValid) {
    await notifyOperator({
      type: 'payment_verification_needed',
      eBillingId
    });
  }

  return Response.json({
    success: true,
    isValid,
    requiresManualVerification: !isValid
  });
}
```

#### Step 5: DJP 수작업 제출 (Day 16-20) ⭐ Phase 1 핵심

**상담원 작업**:
1. DJP 웹사이트 로그인 (https://djponline.pajak.go.id)
2. 세금 신고서 수동 입력 (복사-붙여넣기 지원)
3. BPE(Bukti Penerimaan Elektronik) 다운로드
4. AI PAJAK 플랫폼에 BPE 업로드

**DJP 제출 도우미 도구** (복사-붙여넣기 가이드):

```typescript
// /src/components/operator/djp-submission-helper.tsx
'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface DJPSubmissionHelperProps {
  taxDocument: TaxDocument;
  companyInfo: Company;
}

export function DJPSubmissionHelper({
  taxDocument,
  companyInfo
}: DJPSubmissionHelperProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // PPh 21 제출 필드 매핑
  const pph21Fields = [
    {
      label: 'NPWP Pemotong',
      value: companyInfo.npwp,
      djpField: 'Input Box 1'
    },
    {
      label: 'Masa Pajak',
      value: `${taxDocument.periodMonth}/${taxDocument.periodYear}`,
      djpField: 'Dropdown: Masa Pajak'
    },
    {
      label: 'Jumlah Pegawai',
      value: taxDocument.data.totalEmployees,
      djpField: 'Input Box 3'
    },
    {
      label: 'Total Bruto',
      value: formatNumber(taxDocument.data.totalGrossIncome),
      djpField: 'Input Box 4'
    },
    {
      label: 'PPh 21 Terutang',
      value: formatNumber(taxDocument.totalTax),
      djpField: 'Input Box 7'
    },
    // ... 더 많은 필드
  ];

  const copyToClipboard = (value: string, fieldName: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold text-lg mb-2">
          📋 DJP 웹사이트 제출 가이드
        </h3>
        <p className="text-sm text-gray-600">
          아래 정보를 복사하여 DJP 웹사이트의 해당 필드에 붙여넣으세요.
        </p>
      </div>

      {/* Step-by-Step 가이드 */}
      <div className="space-y-4">
        <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <h4 className="font-semibold">DJP 웹사이트 로그인</h4>
          </div>
          <a
            href="https://djponline.pajak.go.id"
            target="_blank"
            className="text-blue-600 underline"
          >
            https://djponline.pajak.go.id 새 창으로 열기 →
          </a>
        </div>

        <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <h4 className="font-semibold">메뉴 선택: e-Filing SPT Masa PPh 21</h4>
          </div>
        </div>

        <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <h4 className="font-semibold">아래 정보 복사-붙여넣기</h4>
          </div>

          <div className="space-y-3">
            {pph21Fields.map((field, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
              >
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">
                    DJP 필드: {field.djpField}
                  </div>
                  <div className="font-mono text-sm">{field.label}</div>
                  <div className="font-bold text-lg">{field.value}</div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(field.value.toString(), field.label)}
                >
                  {copiedField === field.label ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      복사됨!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      복사
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <h4 className="font-semibold">SPT 제출 및 BPE 다운로드</h4>
          </div>
          <p className="text-sm text-gray-600">
            DJP 웹사이트에서 "Kirim SPT" 버튼 클릭 후 BPE PDF 다운로드
          </p>
        </div>

        <div className="bg-white border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
              5
            </div>
            <h4 className="font-semibold">BPE 업로드</h4>
          </div>

          <BPEUploadZone
            taxDocumentId={taxDocument.id}
            onUploadComplete={() => {
              toast({ title: 'BPE 업로드 완료!' });
            }}
          />
        </div>
      </div>

      {/* 제출 시간 트래킹 */}
      <SubmissionTimeTracker
        operatorId={operatorId}
        taxDocumentId={taxDocument.id}
      />
    </div>
  );
}
```

**BPE 업로드 컴포넌트**:
```typescript
// /src/components/operator/bpe-upload-zone.tsx
'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface BPEUploadZoneProps {
  taxDocumentId: string;
  onUploadComplete: () => void;
}

export function BPEUploadZone({
  taxDocumentId,
  onUploadComplete
}: BPEUploadZoneProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    const formData = new FormData();
    formData.append('file', file);
    formData.append('taxDocumentId', taxDocumentId);

    const response = await fetch('/api/operators/upload-bpe', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      onUploadComplete();
    }
  }, [taxDocumentId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        ${isDragActive ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      {isDragActive ? (
        <p>BPE PDF 파일을 여기에 놓으세요</p>
      ) : (
        <div>
          <p className="font-semibold mb-2">BPE PDF 업로드</p>
          <p className="text-sm text-gray-500">
            클릭하거나 파일을 드래그하세요
          </p>
        </div>
      )}
    </div>
  );
}
```

**제출 시간 트래킹**:
```typescript
// /src/components/operator/submission-time-tracker.tsx
'use client';

import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

export function SubmissionTimeTracker({
  operatorId,
  taxDocumentId
}: {
  operatorId: string;
  taxDocumentId: string;
}) {
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const handleComplete = async () => {
    const processingTimeMinutes = Math.floor(elapsedTime / 60);

    // 실적 기록
    await fetch('/api/operators/log-submission-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorId,
        taxDocumentId,
        processingTimeMinutes
      })
    });
  };

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  return (
    <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5" />
        <span className="font-semibold">제출 소요 시간:</span>
        <span className="text-2xl font-mono">
          {minutes.toString().padStart(2, '0')}:
          {seconds.toString().padStart(2, '0')}
        </span>
      </div>

      <Button onClick={handleComplete} variant="outline" size="sm">
        완료 기록
      </Button>
    </div>
  );
}
```

**Submission Tasks DB 스키마**:
```sql
CREATE TABLE submission_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES tax_operators(id) ON DELETE SET NULL,
  tax_document_id UUID REFERENCES tax_documents(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  task_type VARCHAR(50) NOT NULL, -- 'pph21_monthly', 'pph23_monthly', 'ppn_monthly'
  period_month INT NOT NULL,
  period_year INT NOT NULL,

  -- 단계별 상태
  data_collection_status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'in_progress', 'complete'

  ebilling_generation_status VARCHAR(20) DEFAULT 'pending',
  ebilling_id UUID REFERENCES e_billings(id),

  payment_confirmation_status VARCHAR(20) DEFAULT 'pending',

  djp_submission_status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'in_progress', 'submitted', 'failed'

  -- DJP 제출 정보 (Phase 1: 수작업)
  djp_submission_method VARCHAR(20) DEFAULT 'manual', -- 'manual' or 'api'
  djp_submission_started_at TIMESTAMP WITH TIME ZONE,
  djp_submission_completed_at TIMESTAMP WITH TIME ZONE,

  bpe_number VARCHAR(100), -- BPE 번호
  bpe_url VARCHAR(500), -- S3 URL
  bpe_uploaded_at TIMESTAMP WITH TIME ZONE,

  -- 실적 추적
  processing_time_minutes INT, -- 총 소요 시간

  -- 오류 추적
  error_count INT DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CHECK (task_type IN ('pph21_monthly', 'pph23_monthly', 'ppn_monthly', 'spt_annual')),
  CHECK (djp_submission_method IN ('manual', 'api'))
);

CREATE INDEX idx_submission_tasks_operator ON submission_tasks(operator_id);
CREATE INDEX idx_submission_tasks_company ON submission_tasks(company_id);
CREATE INDEX idx_submission_tasks_period ON submission_tasks(period_year, period_month);
CREATE INDEX idx_submission_tasks_status ON submission_tasks(djp_submission_status);
```

#### Step 6: BPE 업로드 및 고객 알림 (Day 21)

**상담원 액션**:
1. DJP에서 다운로드한 BPE PDF를 시스템에 업로드
2. 시스템이 자동으로 고객에게 완료 알림 발송

**자동 알림 트리거**:
```typescript
// /src/app/api/operators/upload-bpe/route.ts

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const taxDocumentId = formData.get('taxDocumentId') as string;

  // 1. BPE PDF 업로드 (S3)
  const filePath = `bpe/${taxDocumentId}/${file.name}`;
  const { data: uploadData } = await storage.bucket('tax-documents')
    .file(filePath)
    .save(file);

  // 2. DB 업데이트
  await db.submissionTasks.update({
    where: { taxDocumentId },
    data: {
      djpSubmissionStatus: 'submitted',
      bpeUrl: uploadData.path,
      bpeUploadedAt: new Date(),
      djpSubmissionCompletedAt: new Date()
    }
  });

  await db.taxDocuments.update({
    where: { id: taxDocumentId },
    data: {
      status: 'submitted',
      submittedAt: new Date()
    }
  });

  // 3. 고객에게 알림 발송 (자동)
  const company = await db.companies.findFirst({
    where: { taxDocuments: { some: { id: taxDocumentId } } }
  });

  await sendNotification({
    to: company.email,
    type: 'tax_submission_complete',
    data: {
      taxType: taxDocument.taxType,
      period: `${taxDocument.periodMonth}/${taxDocument.periodYear}`,
      bpeUrl: uploadData.path
    }
  });

  // 4. 상담원 실적 기록
  await updateOperatorPerformance(operatorId, {
    successfulSubmissions: { increment: 1 }
  });

  return Response.json({ success: true });
}
```

---

## 4. 상담원 대시보드 설계

### 4.1 메인 대시보드 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│  AI PAJAK - Tax Operator Dashboard                          │
├─────────────────────────────────────────────────────────────┤
│  👤 상담원: Kim Suryanto  |  담당 고객: 35개  |  이번 달: 12월 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 이번 달 진행 상황                                          │
│  ┌───────────┬───────────┬───────────┬───────────┐          │
│  │ 전체 고객  │ 데이터완료 │ 납부완료  │ 제출완료  │          │
│  │   35      │    30     │    28     │    25     │          │
│  └───────────┴───────────┴───────────┴───────────┘          │
│                                                               │
│  🔥 긴급 처리 필요 (3)                                         │
│  • PT ABC - 납부 기한 내일 (Day 14)                           │
│  • CV XYZ - 데이터 미완성 (Day 10)                            │
│  • PT DEF - BPE 업로드 대기 중                                │
│                                                               │
│  📋 고객 리스트 (정렬: 마감일 순)                              │
│  ┌────────────────────────────────────────────────┐          │
│  │ 회사명    │ PPh21 │ PPh23 │ PPN │ 예상세금 │ 상태 │        │
│  ├────────────────────────────────────────────────┤          │
│  │ PT ABC    │  ✅   │  ✅   │ ✅  │ 15.5M   │ 납부대기│       │
│  │ CV XYZ    │  ⚠️   │  ✅   │ ❌  │  8.2M   │ 데이터미완│     │
│  │ PT DEF    │  ✅   │  ✅   │ ✅  │ 22.1M   │ 제출완료│       │
│  └────────────────────────────────────────────────┘          │
│                                                               │
│  [📧 e-Billing 일괄 생성 (30개)]  [📊 월간 실적 보고서]       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 고객 상세 페이지

```typescript
// /src/app/[locale]/(operator)/clients/[clientId]/page.tsx

export default function ClientDetailPage({
  params
}: {
  params: { clientId: string }
}) {
  const { client, taxDocuments, isLoading } = useClientDetails(params.clientId);

  return (
    <div className="space-y-6">
      {/* 회사 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>{client.name}</CardTitle>
          <CardDescription>NPWP: {client.npwp}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>업종 (KBLI)</Label>
              <div>{client.kbliCode} - {client.kbliDescription}</div>
            </div>
            <div>
              <Label>직원 수</Label>
              <div>{client.totalEmployees}명</div>
            </div>
            <div>
              <Label>PKP 여부</Label>
              <div>{client.isPKP ? '✅ PKP' : '❌ Non-PKP'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 이번 달 세금 현황 */}
      <Card>
        <CardHeader>
          <CardTitle>12월 2024 세금 신고 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pph21">
            <TabsList>
              <TabsTrigger value="pph21">PPh 21</TabsTrigger>
              <TabsTrigger value="pph23">PPh 23</TabsTrigger>
              <TabsTrigger value="ppn">PPN</TabsTrigger>
            </TabsList>

            <TabsContent value="pph21">
              <TaxDocumentDetail
                document={taxDocuments.find(d => d.taxType === 'PPH21')}
                clientInfo={client}
              />

              {/* DJP 제출 도우미 */}
              <DJPSubmissionHelper
                taxDocument={taxDocuments.find(d => d.taxType === 'PPH21')}
                companyInfo={client}
              />
            </TabsContent>

            {/* 다른 세금 유형도 동일 */}
          </Tabs>
        </CardContent>
      </Card>

      {/* 제출 이력 */}
      <Card>
        <CardHeader>
          <CardTitle>제출 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <SubmissionHistoryTable clientId={client.id} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4.3 실적 대시보드

```typescript
// /src/app/[locale]/(operator)/performance/page.tsx

export default function PerformanceDashboardPage() {
  const { performance, isLoading } = useOperatorPerformance();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">내 실적</h1>

      {/* 이번 달 요약 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardTitle>총 제출 건수</CardTitle>
          <CardContent className="text-4xl font-bold">
            {performance.totalSubmissions}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>성공률</CardTitle>
          <CardContent className="text-4xl font-bold text-green-600">
            {performance.successRate}%
          </CardContent>
        </Card>

        <Card>
          <CardTitle>평균 처리 시간</CardTitle>
          <CardContent className="text-4xl font-bold">
            {performance.avgProcessingTime}분
          </CardContent>
        </Card>

        <Card>
          <CardTitle>고객 만족도</CardTitle>
          <CardContent className="text-4xl font-bold text-yellow-600">
            ⭐ {performance.clientSatisfaction}/5.0
          </CardContent>
        </Card>
      </div>

      {/* 월별 추이 그래프 */}
      <Card>
        <CardHeader>
          <CardTitle>월별 제출 추이 (최근 6개월)</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceChart data={performance.monthlyTrend} />
        </CardContent>
      </Card>

      {/* 세금 유형별 분포 */}
      <Card>
        <CardHeader>
          <CardTitle>세금 유형별 처리 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <TaxTypePieChart data={performance.byTaxType} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 5. API 엔드포인트

### 5.1 상담원 관리 API

```typescript
// GET /api/operators/me
// 현재 로그인한 상담원 정보 조회
{
  "id": "uuid",
  "name": "Kim Suryanto",
  "assignedClients": ["client-1", "client-2", ...],
  "performance": { ... }
}

// GET /api/operators/clients
// 담당 고객 리스트 조회
{
  "clients": [
    {
      "id": "uuid",
      "name": "PT ABC",
      "npwp": "01.234.567.8-901.000",
      "taxStatus": {
        "pph21": "complete",
        "pph23": "incomplete",
        "ppn": "complete"
      }
    }
  ]
}

// POST /api/operators/bulk-ebilling
// e-Billing 일괄 생성
{
  "operatorId": "uuid",
  "period": { "month": 12, "year": 2024 }
}

// Response:
{
  "total": 35,
  "successful": 33,
  "failed": 2,
  "details": [ ... ]
}

// POST /api/operators/upload-bpe
// BPE 업로드
FormData {
  file: File,
  taxDocumentId: "uuid"
}

// POST /api/operators/log-submission-time
// 제출 소요 시간 기록
{
  "operatorId": "uuid",
  "taxDocumentId": "uuid",
  "processingTimeMinutes": 12
}
```

### 5.2 고객 데이터 조회 API (Read-Only)

```typescript
// GET /api/operators/clients/:clientId
// 고객 상세 정보
{
  "client": { ... },
  "taxDocuments": [ ... ],
  "eBillings": [ ... ]
}

// GET /api/operators/clients/:clientId/tax-documents/:docId
// 세금 문서 상세
{
  "id": "uuid",
  "taxType": "PPH21",
  "data": {
    "employees": [ ... ],
    "totalGrossIncome": 500000000,
    "totalTax": 25000000
  },
  "djpFields": {
    // DJP 웹사이트 제출용 필드 매핑
    "npwpPemotong": "01.234.567.8-901.000",
    "masaPajak": "12/2024",
    "jumlahPegawai": 50,
    // ...
  }
}
```

---

## 6. 상담원 온보딩 & 교육

### 6.1 신규 상담원 온보딩 프로세스

**Day 1: 계정 생성 및 시스템 소개**
- AI PAJAK 계정 생성
- 상담원 대시보드 투어
- 세금 기본 개념 교육 (PPh 21/23/PPN)

**Day 2-3: DJP 웹사이트 실습**
- DJP 계정 생성
- 테스트 데이터로 제출 연습
- 복사-붙여넣기 워크플로우 숙달

**Day 4-5: 모의 고객 처리**
- 5개 모의 고객사 데이터 처리
- e-Billing 생성 → DJP 제출 → BPE 업로드 전체 플로우
- Lead와 1:1 피드백

**Week 2: 실전 배치**
- 5개 실제 고객사 담당
- Lead의 감독 하에 작업
- 점진적으로 10개 → 20개 → 35개로 증가

### 6.2 교육 자료

**문서**:
- `📘 상담원 매뉴얼.pdf` (100페이지)
- `📗 DJP 제출 가이드.pdf` (50페이지)
- `📙 자주 묻는 질문 (FAQ).pdf`

**비디오**:
- `🎥 AI PAJAK 대시보드 사용법 (10분)`
- `🎥 DJP 웹사이트 제출 실습 (20분)`
- `🎥 문제 해결 시나리오 (15분)`

---

## 7. KPI 및 성과 지표

### 7.1 상담원 개인 KPI

| 지표 | 목표 | 측정 주기 |
|------|------|----------|
| **제출 성공률** | 98% 이상 | 월간 |
| **평균 처리 시간** | 고객당 15분 이하 | 월간 |
| **고객 만족도** | 4.5/5.0 이상 | 분기 |
| **오류율** | 2% 이하 | 월간 |
| **응답 시간** | 고객 문의 4시간 이내 | 주간 |

### 7.2 팀 전체 KPI

| 지표 | 목표 | 측정 주기 |
|------|------|----------|
| **월간 총 제출 건수** | 1,000+ 건 | 월간 |
| **DJP 제출 마감일 준수율** | 100% | 월간 |
| **고객 이탈률** | 5% 이하 | 분기 |
| **상담원 1인당 고객 수** | 35개 | 고정 |

### 7.3 성과 측정 쿼리

```sql
-- 월간 상담원 실적 조회
SELECT
  o.name AS operator_name,
  COUNT(st.id) AS total_submissions,
  COUNT(CASE WHEN st.djp_submission_status = 'submitted' THEN 1 END) AS successful,
  COUNT(CASE WHEN st.djp_submission_status = 'failed' THEN 1 END) AS failed,
  AVG(st.processing_time_minutes) AS avg_processing_time,
  ROUND(
    COUNT(CASE WHEN st.djp_submission_status = 'submitted' THEN 1 END)::DECIMAL /
    COUNT(st.id) * 100,
    2
  ) AS success_rate
FROM tax_operators o
LEFT JOIN submission_tasks st ON st.operator_id = o.id
WHERE
  st.period_month = 12 AND
  st.period_year = 2024
GROUP BY o.id, o.name
ORDER BY success_rate DESC;
```

---

## 8. Phase 2 전환 계획

### 8.1 DJP API 연동 후 변경 사항

**자동화되는 작업**:
✅ DJP 로그인 (OAuth)
✅ 세금 신고서 자동 제출
✅ BPE 자동 다운로드 및 저장
✅ 오류 자동 재시도

**상담원 역할 변화**:
```
Phase 1: 35개 고객 × 15분 = 525분/월 (8.75시간)
         ↓
Phase 2: 35개 고객 × 2분 = 70분/월 (1.2시간)
         (모니터링 및 예외 처리만)
```

**상담원 재배치 전략**:
- 기존 상담원 1명 → 100개 고객 담당 가능
- 잉여 인력 → 고객 온보딩, 세무 컨설팅 전환

### 8.2 Phase 2 API 설계 (참고)

```typescript
// DJP API 자동 제출 (Phase 2)
async function submitToDJPAuto(taxDocumentId: string) {
  // 1. DJP OAuth 토큰 획득
  const token = await getDJPAccessToken(companyNPWP);

  // 2. 세금 문서 데이터 변환
  const djpPayload = transformToDJPFormat(taxDocument);

  // 3. DJP API 호출
  const response = await fetch('https://api.pajak.go.id/v1/efiling/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(djpPayload)
  });

  // 4. BPE 자동 다운로드
  const bpe = await downloadBPE(response.data.bpeUrl);

  // 5. DB 업데이트
  await db.taxDocuments.update({
    where: { id: taxDocumentId },
    data: {
      status: 'submitted',
      bpeNumber: response.data.bpeNumber,
      bpeUrl: bpe.url,
      submittedAt: new Date()
    }
  });

  return { success: true, bpeNumber: response.data.bpeNumber };
}
```

---

## 9. 문제 해결 가이드

### 9.1 자주 발생하는 문제

**문제 1: DJP 웹사이트 타임아웃**
- **원인**: DJP 서버 과부하 (마감일 직전)
- **해결**: 오전 시간대 제출 권장, 재시도

**문제 2: BPE 번호 불일치**
- **원인**: 고객이 잘못된 금액 납부
- **해결**: 고객에게 정정 납부 요청, 차액 납부

**문제 3: e-Billing 만료**
- **원인**: 7일 내 납부 미완료
- **해결**: 새 e-Billing 재발급

**문제 4: 고객 데이터 미완성**
- **원인**: 고객이 일부 정보 누락
- **해결**: 자동 리마인더 + 상담원 전화 독촉

### 9.2 에스컬레이션 프로세스

```
[상담원] 문제 발생
    ↓
[Lead] 1차 검토 (2시간 이내)
    ↓ (해결 불가 시)
[Supervisor] 2차 검토 (4시간 이내)
    ↓ (해결 불가 시)
[기술팀] 시스템 수정 또는 DJP 고객센터 연락
```

---

## 10. 부록

### 10.1 용어 사전

| 인도네시아어 | 한국어 | 설명 |
|-------------|--------|------|
| **e-Billing** | 전자 청구서 | DJP 세금 납부용 15자리 코드 |
| **BPE** | 전자 수령증 | Bukti Penerimaan Elektronik (DJP 제출 증명) |
| **BPN** | 국가 수령증 | Bukti Penerimaan Negara (세금 납부 증명) |
| **SPT** | 세금 신고서 | Surat Pemberitahuan Tahunan |
| **NPWP** | 납세자 번호 | Nomor Pokok Wajib Pajak |
| **PKP** | 부가세 사업자 | Pengusaha Kena Pajak |

### 10.2 DJP 웹사이트 URL 모음

- **메인**: https://djponline.pajak.go.id
- **e-Filing**: https://djponline.pajak.go.id/account/login
- **e-Billing**: https://sse3.pajak.go.id
- **NPWP 검증**: https://ereg.pajak.go.id/ceknpwp

### 10.3 긴급 연락처

- **DJP Kring Pajak**: 1500200
- **AI PAJAK 기술 지원**: support@aipajak.com
- **상담원 Lead**: lead@aipajak.com

---

## 요약

Phase 1에서는 **상담원이 핵심 역할**을 수행합니다:

1. ✅ **자동화된 부분**: 세금 계산, e-Billing 생성, 알림 발송
2. ❌ **수작업 필요**: DJP 웹사이트 로그인 및 제출
3. 📊 **상담원 1명 = 35개 고객** 담당
4. ⏱️ **월간 8-9시간** 소요 (고객당 15분)
5. 🎯 **Phase 2 전환 시**: 자동화로 **90% 시간 절감**

이 문서는 Phase 1 운영을 위한 **완전한 가이드**입니다.

**다음 단계**:
- 상담원 대시보드 UI 구현
- DJP 제출 도우미 도구 개발
- 실적 추적 시스템 구축
