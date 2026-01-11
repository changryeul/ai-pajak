# Story 3.2: Operator Helper 데이터 포맷팅

Status: ready-for-dev

## Story

As a **Developer**,
I want Operator Helper 호환 포맷으로 데이터를 내보내도록,
So that 기존 수동 제출 도구와 호환됩니다.

## Acceptance Criteria

1. **Given** SPT 제출 데이터가 생성되었을 때
   **When** OperatorHelperService.format()을 호출하면
   **Then** Operator Helper에서 복사-붙여넣기 가능한 형식으로 변환됩니다

2. **Given** Operator Helper 데이터가 포맷팅될 때
   **When** 데이터가 처리되면
   **Then** 필드별로 구분된 텍스트 데이터가 생성됩니다

3. **Given** Operator Helper 데이터가 UI에 표시될 때
   **When** 복사 버튼을 클릭하면
   **Then** 클립보드에 해당 필드 데이터가 복사됩니다

## Tasks / Subtasks

- [ ] Task 1: Operator Helper 데이터 타입 정의 (AC: #1, #2)
  - [ ] 1.1: `apps/api/src/submission-prep/types/operator-helper.types.ts` 생성
  - [ ] 1.2: `OperatorHelperField` 인터페이스 정의 (fieldName, value, section)
  - [ ] 1.3: `OperatorHelperData` 인터페이스 정의 (fields[], taxType, period)
  - [ ] 1.4: `OperatorHelperPph21Format` 세부 필드 정의
  - [ ] 1.5: `OperatorHelperPph23Format` 세부 필드 정의
  - [ ] 1.6: `OperatorHelperVatFormat` 세부 필드 정의

- [ ] Task 2: OperatorHelperService 구현 (AC: #1, #2)
  - [ ] 2.1: `apps/api/src/submission-prep/operator-helper.service.ts` 생성
  - [ ] 2.2: SptData → OperatorHelperData 변환 메인 로직 (`format(sptData)`)
  - [ ] 2.3: `formatPph21(sptData)` - PPh 21 전용 포맷터
  - [ ] 2.4: `formatPph23(sptData)` - PPh 23 전용 포맷터
  - [ ] 2.5: `formatVat(sptData)` - PPN 전용 포맷터
  - [ ] 2.6: 숫자 포맷팅 유틸 (인도네시아 형식: 1.000.000)
  - [ ] 2.7: 날짜 포맷팅 유틸 (DD-MM-YYYY)
  - [ ] 2.8: NPWP 포맷팅 유틸 (XX.XXX.XXX.X-XXX.XXX)

- [ ] Task 3: SubmissionPrepRepository 확장 (AC: #1)
  - [ ] 3.1: `updateOperatorHelperData(taxCaseId, data)` 메서드 추가
  - [ ] 3.2: `findWithOperatorHelper(taxCaseId)` 메서드 추가

- [ ] Task 4: Controller 엔드포인트 확장 (AC: #1, #2)
  - [ ] 4.1: `GET /api/submission-prep/:taxCaseId/operator-helper` 엔드포인트 추가
  - [ ] 4.2: DTO 정의: `operator-helper-result.dto.ts`
  - [ ] 4.3: Swagger 문서화
  - [ ] 4.4: OperatorHelperService provider 등록

- [ ] Task 5: 프론트엔드 API 클라이언트 (AC: #3)
  - [ ] 5.1: `apps/web/src/api/submission-prep.api.ts` 생성/확장
  - [ ] 5.2: `getOperatorHelperData(taxCaseId)` 함수 구현
  - [ ] 5.3: 타입 정의: `apps/web/src/types/operator-helper.types.ts`

- [ ] Task 6: Operator Helper UI 컴포넌트 (AC: #3)
  - [ ] 6.1: `apps/web/src/components/filing/OperatorHelperPanel.tsx` 생성
  - [ ] 6.2: 필드별 데이터 테이블 UI
  - [ ] 6.3: 개별 필드 복사 버튼 (CopyButton 컴포넌트)
  - [ ] 6.4: 전체 복사 버튼 (모든 필드를 탭 구분 텍스트로)
  - [ ] 6.5: 복사 성공 Toast 알림
  - [ ] 6.6: 섹션별 그룹핑 UI (헤더, 상세, 합계)

- [ ] Task 7: 단위 테스트 작성 (AC: 전체)
  - [ ] 7.1: `operator-helper.service.spec.ts` - 포맷팅 로직 테스트
  - [ ] 7.2: PPh21 → Operator Helper 변환 테스트
  - [ ] 7.3: PPh23 → Operator Helper 변환 테스트
  - [ ] 7.4: VAT → Operator Helper 변환 테스트
  - [ ] 7.5: 숫자/날짜/NPWP 포맷팅 유틸 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/api/src/
├── repository/
│   └── repositories/
│       └── submission-prep.repository.ts   # 수정 (메서드 추가)
├── submission-prep/
│   ├── operator-helper.service.ts          # 신규
│   ├── dto/
│   │   ├── operator-helper-result.dto.ts   # 신규
│   │   └── index.ts                        # 수정
│   └── types/
│       ├── spt-data.types.ts               # 기존 (Story 3-1)
│       └── operator-helper.types.ts        # 신규

apps/web/src/
├── api/
│   └── submission-prep.api.ts              # 신규
├── components/
│   └── filing/
│       └── OperatorHelperPanel.tsx         # 신규
└── types/
    └── operator-helper.types.ts            # 신규
```

**아키텍처 문서 참조:**
- [Source: architecture.md#API & Communication Patterns]
- [Source: architecture.md#Implementation Patterns & Consistency Rules]
- [Source: architecture.md#Frontend Architecture]

### Technical Requirements

**Operator Helper 필드 구조:**
```typescript
// apps/api/src/submission-prep/types/operator-helper.types.ts

export interface OperatorHelperField {
  /** DJP 필드 ID (예: "A1", "B2") */
  fieldId: string;
  /** 한글/인니어 필드명 */
  fieldName: string;
  /** 포맷팅된 값 (문자열) */
  value: string;
  /** UI 섹션 그룹 */
  section: 'header' | 'detail' | 'calculation' | 'summary';
  /** DJP 입력 순서 */
  order: number;
}

export interface OperatorHelperData {
  taxCaseId: string;
  taxType: TaxType;
  period: string;              // YYYY-MM
  generatedAt: string;         // ISO 8601
  fields: OperatorHelperField[];
  /** 탭 구분 전체 텍스트 (한 번에 복사용) */
  fullText: string;
}
```

**PPh 21 Operator Helper 필드 예시:**
```typescript
// DJP e-SPT Masa PPh 21 입력 필드 매핑
const PPH21_FIELDS: OperatorHelperField[] = [
  // Header Section
  { fieldId: 'A1', fieldName: 'Masa Pajak', section: 'header', order: 1 },
  { fieldId: 'A2', fieldName: 'Tahun Pajak', section: 'header', order: 2 },
  { fieldId: 'A3', fieldName: 'Pembetulan Ke', section: 'header', order: 3 },

  // Detail Section
  { fieldId: 'B1', fieldName: 'Jumlah Pegawai', section: 'detail', order: 10 },
  { fieldId: 'B2', fieldName: 'Jumlah Penghasilan Bruto', section: 'detail', order: 11 },
  { fieldId: 'B3', fieldName: 'Jumlah Penghasilan Kena Pajak', section: 'detail', order: 12 },

  // Calculation Section
  { fieldId: 'C1', fieldName: 'PPh Pasal 21 Terutang', section: 'calculation', order: 20 },
  { fieldId: 'C2', fieldName: 'PPh Pasal 21 Telah Dipotong', section: 'calculation', order: 21 },

  // Summary Section
  { fieldId: 'D1', fieldName: 'PPh Pasal 21 yang Harus Disetor', section: 'summary', order: 30 },
];
```

**PPh 23 Operator Helper 필드:**
```typescript
const PPH23_FIELDS: OperatorHelperField[] = [
  // Header
  { fieldId: 'A1', fieldName: 'Masa Pajak', section: 'header', order: 1 },
  { fieldId: 'A2', fieldName: 'Tahun Pajak', section: 'header', order: 2 },

  // Detail (per transaction)
  { fieldId: 'B1', fieldName: 'NPWP Pemotong', section: 'detail', order: 10 },
  { fieldId: 'B2', fieldName: 'Nama Pemotong', section: 'detail', order: 11 },
  { fieldId: 'B3', fieldName: 'Jenis Penghasilan', section: 'detail', order: 12 },
  { fieldId: 'B4', fieldName: 'Jumlah Penghasilan Bruto', section: 'detail', order: 13 },
  { fieldId: 'B5', fieldName: 'Tarif', section: 'detail', order: 14 },
  { fieldId: 'B6', fieldName: 'PPh Dipotong', section: 'detail', order: 15 },

  // Summary
  { fieldId: 'D1', fieldName: 'Total Penghasilan Bruto', section: 'summary', order: 30 },
  { fieldId: 'D2', fieldName: 'Total PPh Pasal 23', section: 'summary', order: 31 },
];
```

**VAT (PPN) Operator Helper 필드:**
```typescript
const VAT_FIELDS: OperatorHelperField[] = [
  // Header
  { fieldId: 'A1', fieldName: 'Masa Pajak', section: 'header', order: 1 },
  { fieldId: 'A2', fieldName: 'Tahun Pajak', section: 'header', order: 2 },

  // Output Tax (Pajak Keluaran)
  { fieldId: 'B1', fieldName: 'Jumlah Faktur Keluaran', section: 'detail', order: 10 },
  { fieldId: 'B2', fieldName: 'DPP Pajak Keluaran', section: 'detail', order: 11 },
  { fieldId: 'B3', fieldName: 'PPN Keluaran', section: 'detail', order: 12 },

  // Input Tax (Pajak Masukan)
  { fieldId: 'C1', fieldName: 'Jumlah Faktur Masukan', section: 'detail', order: 20 },
  { fieldId: 'C2', fieldName: 'DPP Pajak Masukan', section: 'detail', order: 21 },
  { fieldId: 'C3', fieldName: 'PPN Masukan', section: 'detail', order: 22 },

  // Summary
  { fieldId: 'D1', fieldName: 'PPN Kurang/Lebih Bayar', section: 'summary', order: 30 },
];
```

### Code Patterns (기존 코드 참조)

**OperatorHelperService 구현:**
```typescript
// apps/api/src/submission-prep/operator-helper.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { TaxType } from '@prisma/client';
import { SubmissionPrepRepository } from '../repository/repositories/submission-prep.repository';
import { SptData, SptPph21Data, SptPph23Data, SptVatData } from './types/spt-data.types';
import { OperatorHelperData, OperatorHelperField } from './types/operator-helper.types';

@Injectable()
export class OperatorHelperService {
  constructor(
    private readonly submissionPrepRepo: SubmissionPrepRepository,
  ) {}

  /**
   * SPT 데이터를 Operator Helper 포맷으로 변환
   */
  async format(taxCaseId: bigint): Promise<OperatorHelperData> {
    const prep = await this.submissionPrepRepo.findByTaxCaseId(taxCaseId);
    if (!prep) {
      throw new NotFoundException('Submission prep not found');
    }

    const sptData = prep.sptData as unknown as SptData;
    const taxCase = await this.submissionPrepRepo.getTaxCase(taxCaseId);

    let fields: OperatorHelperField[];
    switch (taxCase.taxType) {
      case TaxType.PPh21:
        fields = this.formatPph21(sptData as SptPph21Data);
        break;
      case TaxType.PPh23:
        fields = this.formatPph23(sptData as SptPph23Data);
        break;
      case TaxType.VAT:
        fields = this.formatVat(sptData as SptVatData);
        break;
      default:
        throw new Error(`Unsupported tax type: ${taxCase.taxType}`);
    }

    // 전체 텍스트 생성 (탭 구분)
    const fullText = fields
      .sort((a, b) => a.order - b.order)
      .map(f => `${f.fieldName}\t${f.value}`)
      .join('\n');

    const result: OperatorHelperData = {
      taxCaseId: taxCaseId.toString(),
      taxType: taxCase.taxType,
      period: sptData.period,
      generatedAt: new Date().toISOString(),
      fields,
      fullText,
    };

    // DB에 캐시 저장
    await this.submissionPrepRepo.updateOperatorHelperData(taxCaseId, result);

    return result;
  }

  private formatPph21(data: SptPph21Data): OperatorHelperField[] {
    return [
      { fieldId: 'A1', fieldName: 'Masa Pajak', value: this.formatPeriodMonth(data.period), section: 'header', order: 1 },
      { fieldId: 'A2', fieldName: 'Tahun Pajak', value: this.formatPeriodYear(data.period), section: 'header', order: 2 },
      { fieldId: 'A3', fieldName: 'Pembetulan Ke', value: '0', section: 'header', order: 3 },
      { fieldId: 'B1', fieldName: 'Jumlah Pegawai', value: data.employeeCount.toString(), section: 'detail', order: 10 },
      { fieldId: 'B2', fieldName: 'Jumlah Penghasilan Bruto', value: this.formatCurrency(data.grossSalary), section: 'detail', order: 11 },
      { fieldId: 'B3', fieldName: 'Jumlah Penghasilan Kena Pajak', value: this.formatCurrency(data.taxableIncome), section: 'detail', order: 12 },
      { fieldId: 'C1', fieldName: 'PPh Pasal 21 Terutang', value: this.formatCurrency(data.taxWithheld), section: 'calculation', order: 20 },
      { fieldId: 'D1', fieldName: 'PPh Pasal 21 yang Harus Disetor', value: this.formatCurrency(data.taxWithheld), section: 'summary', order: 30 },
    ];
  }

  private formatPph23(data: SptPph23Data): OperatorHelperField[] {
    const fields: OperatorHelperField[] = [
      { fieldId: 'A1', fieldName: 'Masa Pajak', value: this.formatPeriodMonth(data.period), section: 'header', order: 1 },
      { fieldId: 'A2', fieldName: 'Tahun Pajak', value: this.formatPeriodYear(data.period), section: 'header', order: 2 },
    ];

    // 거래별 상세
    data.transactions.forEach((tx, idx) => {
      const baseOrder = 10 + idx * 10;
      fields.push(
        { fieldId: `B${idx + 1}-1`, fieldName: `NPWP Pemotong ${idx + 1}`, value: this.formatNpwp(tx.vendorNpwp), section: 'detail', order: baseOrder },
        { fieldId: `B${idx + 1}-2`, fieldName: `Nama Pemotong ${idx + 1}`, value: tx.vendorName, section: 'detail', order: baseOrder + 1 },
        { fieldId: `B${idx + 1}-3`, fieldName: `Jenis Penghasilan ${idx + 1}`, value: tx.serviceType, section: 'detail', order: baseOrder + 2 },
        { fieldId: `B${idx + 1}-4`, fieldName: `Penghasilan Bruto ${idx + 1}`, value: this.formatCurrency(tx.grossAmount), section: 'detail', order: baseOrder + 3 },
        { fieldId: `B${idx + 1}-5`, fieldName: `Tarif ${idx + 1}`, value: `${tx.taxRate}%`, section: 'detail', order: baseOrder + 4 },
        { fieldId: `B${idx + 1}-6`, fieldName: `PPh Dipotong ${idx + 1}`, value: this.formatCurrency(tx.taxAmount), section: 'detail', order: baseOrder + 5 },
      );
    });

    fields.push(
      { fieldId: 'D1', fieldName: 'Total Penghasilan Bruto', value: this.formatCurrency(data.totalGross), section: 'summary', order: 900 },
      { fieldId: 'D2', fieldName: 'Total PPh Pasal 23', value: this.formatCurrency(data.totalTax), section: 'summary', order: 901 },
    );

    return fields;
  }

  private formatVat(data: SptVatData): OperatorHelperField[] {
    return [
      { fieldId: 'A1', fieldName: 'Masa Pajak', value: this.formatPeriodMonth(data.period), section: 'header', order: 1 },
      { fieldId: 'A2', fieldName: 'Tahun Pajak', value: this.formatPeriodYear(data.period), section: 'header', order: 2 },
      { fieldId: 'B1', fieldName: 'Jumlah Faktur Keluaran', value: data.outputTax.invoices.length.toString(), section: 'detail', order: 10 },
      { fieldId: 'B2', fieldName: 'DPP Pajak Keluaran', value: this.formatCurrency(data.outputTax.totalDpp), section: 'detail', order: 11 },
      { fieldId: 'B3', fieldName: 'PPN Keluaran', value: this.formatCurrency(data.outputTax.totalPpn), section: 'detail', order: 12 },
      { fieldId: 'C1', fieldName: 'Jumlah Faktur Masukan', value: data.inputTax.invoices.length.toString(), section: 'detail', order: 20 },
      { fieldId: 'C2', fieldName: 'DPP Pajak Masukan', value: this.formatCurrency(data.inputTax.totalDpp), section: 'detail', order: 21 },
      { fieldId: 'C3', fieldName: 'PPN Masukan', value: this.formatCurrency(data.inputTax.totalPpn), section: 'detail', order: 22 },
      { fieldId: 'D1', fieldName: 'PPN Kurang/Lebih Bayar', value: this.formatCurrency(data.netTax), section: 'summary', order: 30 },
    ];
  }

  // ===== Formatting Utilities =====

  /** 인도네시아 통화 포맷 (1.000.000) */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /** NPWP 포맷 (XX.XXX.XXX.X-XXX.XXX) */
  private formatNpwp(npwp: string): string {
    const clean = npwp.replace(/\D/g, '');
    if (clean.length !== 15) return npwp;
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}.${clean.slice(8, 9)}-${clean.slice(9, 12)}.${clean.slice(12, 15)}`;
  }

  /** 기간에서 월 추출 (01-12) */
  private formatPeriodMonth(period: string): string {
    const [, month] = period.split('-');
    return month;
  }

  /** 기간에서 연도 추출 */
  private formatPeriodYear(period: string): string {
    const [year] = period.split('-');
    return year;
  }
}
```

**Controller 확장:**
```typescript
// apps/api/src/submission-prep/submission-prep.controller.ts (추가)

@Get(':taxCaseId/operator-helper')
@ApiOperation({ summary: 'Operator Helper 형식 데이터 조회' })
@ApiResponse({ status: 200, type: OperatorHelperResultDto })
async getOperatorHelper(
  @Param('taxCaseId') taxCaseId: string,
): Promise<OperatorHelperResultDto> {
  return this.operatorHelperService.format(BigInt(taxCaseId));
}
```

**프론트엔드 컴포넌트:**
```tsx
// apps/web/src/components/filing/OperatorHelperPanel.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { OperatorHelperData, OperatorHelperField } from '@/types/operator-helper.types';

interface OperatorHelperPanelProps {
  data: OperatorHelperData;
}

export function OperatorHelperPanel({ data }: OperatorHelperPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      toast.success('클립보드에 복사되었습니다');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error('복사에 실패했습니다');
    }
  };

  const copyAll = async () => {
    await copyToClipboard(data.fullText, 'all');
  };

  // 섹션별 그룹핑
  const sections = ['header', 'detail', 'calculation', 'summary'] as const;
  const sectionLabels = {
    header: '기본 정보',
    detail: '상세 내역',
    calculation: '세액 계산',
    summary: '납부 요약',
  };

  const groupedFields = sections.reduce((acc, section) => {
    acc[section] = data.fields.filter(f => f.section === section).sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<typeof sections[number], OperatorHelperField[]>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Operator Helper 데이터
        </CardTitle>
        <Button variant="outline" size="sm" onClick={copyAll}>
          {copiedField === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-2">전체 복사</span>
        </Button>
      </CardHeader>
      <CardContent>
        {sections.map(section => {
          const fields = groupedFields[section];
          if (fields.length === 0) return null;

          return (
            <div key={section} className="mb-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                {sectionLabels[section]}
              </h4>
              <div className="space-y-2">
                {fields.map(field => (
                  <div
                    key={field.fieldId}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted"
                  >
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground mr-2">
                        [{field.fieldId}]
                      </span>
                      <span className="text-sm">{field.fieldName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {field.value}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(field.value, field.fieldId)}
                      >
                        {copiedField === field.fieldId ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          생성 시간: {new Date(data.generatedAt).toLocaleString('ko-KR')}
        </div>
      </CardContent>
    </Card>
  );
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submission-prep/:taxCaseId/operator-helper` | Operator Helper 형식 데이터 조회 |

### Dependencies

**Story 3-1 의존성:**
- `SubmissionPrepRepository` - 데이터 접근 (확장 필요)
- `SptData` 타입 - SPT 데이터 구조
- `SubmissionPrepModule` - 모듈 등록

**신규 의존성:**
- 없음 (기존 의존성 활용)

**Prisma Schema 업데이트 불필요:**
- `operatorHelperData` 필드가 이미 `SubmissionPrep` 모델에 `Json?`으로 정의됨

### Out of Scope

- 제출 준비 완료 기능 (Story 3.3)
- 수동 제출 완료 확인 (Story 3.4)
- 제출 상태 조회 UI (Story 3.5)
- Operator Helper 데이터 수정 기능
- e-Faktur Operator Helper 포맷 (Epic 6)

### Testing Considerations

**단위 테스트 케이스:**
1. PPh21 데이터 → Operator Helper 변환 - 정상 케이스
2. PPh23 데이터 (다중 거래) → Operator Helper 변환
3. VAT 데이터 → Operator Helper 변환
4. 숫자 포맷팅 - 인도네시아 형식 (1000000 → "1.000.000")
5. NPWP 포맷팅 - 15자리 형식
6. 기간 파싱 - "2026-01" → month: "01", year: "2026"
7. 전체 텍스트 생성 - 탭 구분 형식
8. SubmissionPrep 없는 경우 - NotFoundException

**프론트엔드 테스트:**
1. 필드별 복사 기능 테스트
2. 전체 복사 기능 테스트
3. 섹션 그룹핑 렌더링 테스트

### Previous Story Intelligence

**Story 3-1 학습 적용:**
- Repository 패턴 준수 (PrismaService 주입)
- DTO 기반 요청/응답 구조화
- Swagger 문서화 필수
- BigInt ID는 문자열로 직렬화

**코드 패턴:**
```typescript
// BigInt 직렬화 (main.ts에 이미 적용)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
```

### Git Intelligence

**최근 커밋 분석:**
- `d4a842e`: Epic 2 버그 수정 진행 중
- `481c1d3`: Epic 2-4 완료
- `0409c74`: Epic 1 완료

**파일 패턴:**
- Service 파일: `*.service.ts`
- Controller 파일: `*.controller.ts`
- DTO 파일: `dto/*.dto.ts`
- 타입 파일: `types/*.types.ts`
- 컴포넌트 파일: `components/**/*.tsx`

### References

- Epic 3: 단일 케이스 제출 준비 [Source: epics.md#Epic 3]
- PRD FR-1.1: SPT 제출 데이터 준비 [Source: prd.md#FR-1]
- Architecture: Backend Architecture [Source: architecture.md#API & Communication Patterns]
- Story 3-1: SPT 제출 데이터 생성 서비스 [Source: 3-1-spt-submission-data-generation.md]
- Prisma Schema: SubmissionPrep.operatorHelperData [Source: schema.prisma]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

