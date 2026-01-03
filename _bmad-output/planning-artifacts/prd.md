---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
workflowType: 'prd'
lastStep: 11
inputDocuments:
  - _bmad-output/planning-artifacts/research/market-indonesia-tax-saas-2026-01-03.md
  - _bmad-output/planning-artifacts/research/domain-indonesia-tax-regulations-2026-01-03.md
  - _bmad-output/planning-artifacts/research/technical-paddleocr-integration-2026-01-03.md
  - docs/PRD/README.md
  - docs/PRD/core/01-executive-summary.md
  - docs/PRD/core/04-legal-structure.md
  - docs/PRD/features/mvp-scope.md
  - docs/project-documentation/project-overview.md
  - docs/project-documentation/architecture-api.md
  - docs/project-documentation/architecture-web.md
  - docs/project-documentation/integration-architecture.md
documentCounts:
  briefs: 0
  research: 3
  brainstorming: 0
  projectDocs: 35
projectType: brownfield
status: complete
---

# Product Requirements Document - AI Pajak Phase 2

**Author:** Chrishan
**Date:** 2026-01-03
**Version:** 1.0
**Project Type:** Brownfield (기존 코드베이스 확장)
**Phase:** Phase 2 - DJP API 자동화 & 고급 문서 처리

---

## Executive Summary

### 비전 정렬

AI Pajak Phase 2는 현재 수동 DJP 제출 워크플로우의 **제출 준비 과정을 완전 자동화**합니다. Phase 1에서 구축한 AI 분석 및 휴먼 리뷰 워크플로우를 기반으로, 고급 OCR 처리와 제출 준비 자동화를 통해 상담원 업무 효율을 극대화합니다.

> **⚠️ 중요:** DJP e-Filing 실제 제출은 법적으로 사람이 수동으로 수행해야 합니다. DJP API 승인 후 자동 제출 기능은 TODO-EPIC으로 별도 관리됩니다.

**현재 상태 (Phase 1 완료):**
- 세금 계산 자동화 (PPh 21/23, PPN)
- 5단계 워크플로우 상태 머신 (UPLOADED → AI_ANALYZED → HUMAN_REVIEW → APPROVED → FILED)
- 기본 OCR 처리 (OpenAI Vision 기반)
- 수동 DJP 제출 (Operator Helper 도구)

**목표 상태 (Phase 2):**
- PaddleOCR 기반 고급 문서 처리
- e-Faktur PPN 자동 생성 (업로드용 파일 생성)
- 35+ 고객 일괄 제출 준비 자동화
- BPE 수동 업로드 및 자동 알림
- 제출 체크리스트 및 Operator Helper 지원

**향후 계획 (DJP API 승인 후 - TODO-EPIC):**
- DJP e-Filing API 직접 통합
- BPE 자동 다운로드
- e-Faktur DJP 자동 업로드

### What Makes This Special

**1. 제출 준비 완전 자동화 파이프라인**
- 문서 업로드부터 제출 준비 완료까지 원클릭 프로세스
- 상담원 개입은 검토, 승인, 최종 수동 제출 단계에 집중
- 월별 마감일 전 일괄 제출 준비 및 체크리스트 생성

**2. 하이브리드 OCR 아키텍처**
- PaddleOCR (PP-OCRv5) 기반 로컬 처리로 비용 절감
- 복잡한 문서는 Gemini Flash Fallback
- 테이블/구조화 데이터 추출 (PP-StructureV3)

**3. 규제 준수 자동화**
- Jakarta Tax Consulting 귀속 자동 로깅
- POA (Power of Attorney) 검증 자동화
- Audit Trail 완전 추적

## Project Classification

| 항목 | 값 |
|------|-----|
| **Technical Type** | SaaS B2B Platform (saas_b2b) |
| **Domain** | Fintech / Tax Technology |
| **Complexity** | High |
| **Project Context** | Brownfield - Phase 1 확장 |
| **Regulatory Requirements** | DJP API 계약, PJAP 인증 (Jakarta Tax Consulting) |

---

## Success Criteria

### 비즈니스 KPI

| 지표 | 현재 (Phase 1) | 목표 (Phase 2) | 측정 방법 |
|------|---------------|----------------|----------|
| **제출 준비 완료율** | 0% (수동) | 95%+ | 자동 준비 완료 건수 / 총 건수 |
| **상담원 처리 시간** | 고객당 15분 | 고객당 5분 | 평균 처리 시간 (준비~수동제출) |
| **데이터 정확도** | 90% | 99%+ | 검증 통과 건수 / 총 건수 |
| **월간 처리 건수** | 1,000건 | 5,000건+ | 월간 총 제출 건수 |
| **고객 이탈률** | 5% | 3% 이하 | 월간 이탈 고객 / 총 고객 |

### 제품 KPI

| 지표 | 현재 | 목표 | 우선순위 |
|------|------|------|---------|
| **OCR 정확도** | 90% (OpenAI Vision) | 95%+ (PaddleOCR) | P0 |
| **API 응답 시간** | 500ms (p95) | 300ms (p95) | P1 |
| **BPE 업로드 후 알림** | 수동 확인 | 업로드 후 5분 이내 자동 알림 | P0 |
| **e-Faktur 생성 정확도** | N/A | 99%+ | P0 |

### 기술 KPI

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **시스템 가동률** | 99.9% | Uptime 모니터링 |
| **DJP API 장애 복구** | 15분 이내 | 장애 감지 ~ 복구 시간 |
| **데이터 정합성** | 100% | Audit Log 검증 |

---

## User Personas

### Primary Personas

#### 1. Tax Consultant (세무 컨설턴트) - Jakarta Tax Consulting

**프로필:**
- 35개 이상 고객사 관리
- 월별 마감일 (15일/20일/말일) 준수 필수
- DJP 시스템 직접 접근 권한 보유

**Pain Points (Phase 1):**
- 수동 DJP 제출에 시간 소요
- 복사-붙여넣기 과정에서 오류 발생
- BPE 확인을 위해 DJP 사이트 반복 방문

**Goals (Phase 2):**
- 일괄 자동 제출로 시간 절약
- BPE 자동 수신 및 고객 전달
- 실시간 제출 상태 모니터링

**Key Workflows:**
1. 월별 마감 전 일괄 승인 및 자동 제출
2. 제출 실패 건 즉시 알림 및 재시도
3. BPE 자동 다운로드 및 고객 알림

#### 2. Tax Advisor (세무사) - Jakarta Tax Consulting

**프로필:**
- POA 보유 고객의 세금 신고 권한
- 복잡한 세금 케이스 처리 담당
- 규제 준수 최종 책임

**Pain Points:**
- POA 유효성 수동 확인 필요
- 복잡한 문서의 OCR 오류
- 규제 변경 사항 추적 어려움

**Goals (Phase 2):**
- POA 자동 검증
- 고급 OCR로 복잡한 문서 처리
- 규제 준수 자동 알림

#### 3. UMKM Business Owner (중소기업 경영자)

**프로필:**
- 세금 지식 제한적
- 본업에 집중하고 싶음
- 비용 효율성 중시

**Pain Points:**
- 세금 신고 과정 복잡
- 마감일 놓칠 우려
- 신고 결과 확인 어려움

**Goals (Phase 2):**
- 완전 위임형 세금 신고
- 투명한 진행 상황 확인
- BPE 자동 수신

### Secondary Personas

#### 4. Platform Admin (AI Pajak)

**역할:** 플랫폼 운영 및 모니터링 (세금 데이터 접근 불가)

**Phase 2 요구사항:**
- DJP API 상태 모니터링 대시보드
- 제출 성공률/실패율 통계
- 시스템 성능 알림

#### 5. System (자동화 프로세스)

**역할:** 빌링 생성, 스케줄링 (세금 데이터 접근 불가)

**Phase 2 요구사항:**
- 월별 자동 일괄 처리 스케줄러
- DJP API 재시도 로직
- 알림 발송 자동화

---

## Core Requirements

### Functional Requirements

#### FR-1: 제출 준비 자동화 (P0)

> **참고:** DJP API 직접 통합은 DJP 승인 후 TODO-EPIC에서 구현 예정

**FR-1.1: SPT 제출 데이터 준비**
- SPT 제출에 필요한 모든 데이터 자동 생성 및 검증
- 지원 세금 유형: PPh 21, PPh 23, PPh Final, PPN
- Operator Helper 호환 포맷으로 데이터 내보내기
- 제출 전 데이터 유효성 검증

**FR-1.2: e-Billing 데이터 준비**
- ID Billing 생성에 필요한 데이터 준비
- 납부 금액 자동 계산 및 검증
- NTPN 수동 입력 및 저장 지원

**FR-1.3: BPE 수동 업로드 및 관리**
- 수동 제출 후 BPE PDF 업로드 인터페이스
- 업로드된 BPE 저장 및 고객 계정 연동
- 업로드 완료 시 이메일/WhatsApp 자동 발송

**FR-1.4: 일괄 제출 준비**
- 35+ 고객 제출 데이터 일괄 준비
- 제출 체크리스트 자동 생성 (마감일별)
- 준비 완료 건 엑셀/CSV 내보내기
- 수동 제출 완료 확인 기능

#### FR-2: PaddleOCR 통합 (P0)

**FR-2.1: 문서 인식**
- 1721-A1 양식 OCR
- e-Faktur PDF 파싱
- 영수증/송장 텍스트 추출

**FR-2.2: 테이블 추출**
- PP-StructureV3 기반 테이블 인식
- 급여 명세서 테이블 파싱
- 세금 계산서 항목 추출

**FR-2.3: 하이브리드 Fallback**
- 신뢰도 < 85%: Gemini Flash API 호출
- 처리 불가 문서: 수동 검토 큐 이동
- 처리 통계 로깅

#### FR-3: e-Faktur PPN 생성 (P0)

**FR-3.1: e-Faktur 파일 생성**
- PPN 거래 데이터 기반 e-Faktur 자동 생성
- NPWP 로컬 검증 (형식 및 체크섬)
- QR 코드 생성
- DJP e-Faktur 업로드용 파일 포맷 생성

**FR-3.2: e-Faktur 관리** *(DJP 업로드는 TODO-EPIC)*
- 생성된 e-Faktur 목록 관리
- 수동 업로드 후 상태 입력 (승인/거부)
- 거부 사유 기록 및 수정 지원

#### FR-4: 워크플로우 자동화 (P1)

**FR-4.1: 자동 상태 전이**
- AI_ANALYZED → HUMAN_REVIEW: 자동 알림
- APPROVED → READY_TO_FILE: 제출 준비 완료 알림
- 수동 제출 확인 → FILED: 상태 업데이트

**FR-4.2: 스케줄 기반 처리**
- 마감일 D-3: 미승인 건 알림
- 마감일 D-1: 긴급 처리 큐 및 제출 준비 완료 알림
- 마감일 당일: 제출 체크리스트 최종 알림

**FR-4.3: 알림 자동화**
- 제출 준비 완료: 컨설턴트 알림
- BPE 업로드 완료: 고객 이메일/WhatsApp 자동 발송
- 마감일 임박: 긴급 알림

#### FR-5: Audit & Compliance (P0)

**FR-5.1: 제출 귀속 로깅**
- 모든 DJP 제출: Jakarta Tax Consulting 귀속
- 컨설턴트 ID, POA ID 기록
- 불변 Audit Log

**FR-5.2: POA 자동 검증**
- 제출 전 POA 유효성 확인
- 만료 예정 POA 사전 알림 (30일 전)
- 만료된 POA 제출 차단

### Non-Functional Requirements

#### NFR-1: 성능

| 요구사항 | 목표 |
|---------|------|
| DJP API 응답 시간 | 5초 이내 (p95) |
| OCR 처리 시간 | 3초/페이지 이내 |
| 일괄 제출 처리량 | 100건/분 |
| 시스템 가동률 | 99.9% |

#### NFR-2: 보안

| 요구사항 | 구현 |
|---------|------|
| DJP 자격증명 저장 | AES-256 암호화, HSM 권장 |
| API 통신 | TLS 1.3 필수 |
| 접근 제어 | 기존 5-role RBAC 유지 |
| Audit Log | 불변성 보장 (Append-only) |

#### NFR-3: 확장성

| 요구사항 | 목표 |
|---------|------|
| 동시 사용자 | 500+ |
| 월간 제출 건수 | 10,000+ |
| 저장 용량 | BPE/e-Faktur 무제한 |

#### NFR-4: 가용성

| 요구사항 | 목표 |
|---------|------|
| DJP API 장애 시 | 큐잉 후 자동 재시도 |
| 데이터 백업 | 일일 증분, 주간 전체 |
| 복구 시간 목표 (RTO) | 4시간 |
| 복구 지점 목표 (RPO) | 1시간 |

---

## User Experience

### User Flows

#### UF-1: 자동 세금 신고 플로우 (Tax Consultant)

```
1. [대시보드] 마감일 임박 케이스 목록 확인
   ↓
2. [일괄 승인] 검토 완료 건 선택 → "일괄 승인" 클릭
   ↓
3. [확인 모달] "35건을 DJP에 자동 제출합니다. 진행하시겠습니까?"
   ↓
4. [진행 표시] 실시간 제출 진행률 표시
   - 성공: 녹색 체크
   - 실패: 빨간색 X + 오류 메시지
   ↓
5. [완료 요약] "32건 성공, 3건 실패 (재시도 가능)"
   ↓
6. [BPE 알림] 5분 내 BPE 자동 다운로드 완료 알림
```

#### UF-2: 문서 OCR 처리 플로우 (Accountant)

```
1. [업로드] 1721-A1 양식 사진/PDF 업로드
   ↓
2. [OCR 처리] PaddleOCR 자동 처리 (3초)
   - 신뢰도 표시: "95% 정확도"
   ↓
3. [검토 화면] 추출 데이터 미리보기
   - 원본 이미지 + 추출 결과 나란히 표시
   - 수정 가능 필드 하이라이트
   ↓
4. [확인/수정] 필요시 수동 수정 → "확인" 클릭
   ↓
5. [AI 분석] 세금 자동 계산 시작
```

#### UF-3: BPE 확인 플로우 (Customer)

```
1. [알림 수신] "세금 신고가 완료되었습니다" (WhatsApp/Email)
   ↓
2. [대시보드] 로그인 → "신고 내역" 확인
   ↓
3. [BPE 보기] "BPE 다운로드" 클릭 → PDF 다운로드
   ↓
4. [상세 정보] 제출 일시, 담당 컨설턴트, 납부 정보 확인
```

### UI Components (신규/수정)

#### 1. Bulk Submit Panel (신규)

```typescript
interface BulkSubmitPanelProps {
  selectedCases: TaxCase[];
  onSubmit: () => void;
  onCancel: () => void;
}

// 기능:
// - 선택된 케이스 목록 표시
// - POA 유효성 사전 검증
// - 예상 처리 시간 표시
// - 일괄 제출 버튼
```

#### 2. Submission Progress Modal (신규)

```typescript
interface SubmissionProgressProps {
  totalCount: number;
  successCount: number;
  failedCount: number;
  currentCase: TaxCase | null;
  status: 'pending' | 'processing' | 'completed';
}

// 기능:
// - 실시간 진행률 바
// - 개별 케이스 상태 표시
// - 실패 건 오류 메시지
// - 완료 후 요약 통계
```

#### 3. OCR Confidence Indicator (수정)

```typescript
interface OCRConfidenceProps {
  confidence: number; // 0-100
  source: 'paddleocr' | 'gemini' | 'manual';
  fields: OCRField[];
}

// 기능:
// - 전체 신뢰도 표시
// - 필드별 신뢰도 색상 코딩
// - 저신뢰도 필드 하이라이트
```

#### 4. BPE Download Card (신규)

```typescript
interface BPECardProps {
  taxCase: TaxCase;
  bpeNumber: string;
  filedAt: Date;
  downloadUrl: string;
}

// 기능:
// - BPE 번호 표시
// - PDF 미리보기
// - 다운로드 버튼
// - 공유 옵션 (WhatsApp, Email)
```

### Accessibility Requirements

| 요구사항 | 구현 |
|---------|------|
| 키보드 네비게이션 | 모든 액션 키보드 접근 가능 |
| 스크린 리더 | ARIA 라벨 적용 |
| 색상 대비 | WCAG 2.1 AA 준수 |
| 폼 오류 | 명확한 오류 메시지 |

---

## Technical Considerations

### Architecture Changes

#### 신규 모듈 구조

```
apps/api/src/
├── djp/                          # DJP API 통합 모듈 (신규)
│   ├── djp.module.ts
│   ├── djp.service.ts            # DJP API 클라이언트
│   ├── efiling.service.ts        # e-Filing 제출
│   ├── ebilling.service.ts       # e-Billing 생성
│   ├── efaktur.service.ts        # e-Faktur 처리
│   ├── bpe.service.ts            # BPE 다운로드
│   ├── dto/
│   │   ├── submit-spt.dto.ts
│   │   ├── create-billing.dto.ts
│   │   └── efaktur.dto.ts
│   └── types/
│       └── djp-response.types.ts
│
├── ocr/                          # OCR 모듈 (리팩토링)
│   ├── ocr.module.ts
│   ├── ocr.service.ts            # OCR 오케스트레이터
│   ├── paddleocr.service.ts      # PaddleOCR 클라이언트 (신규)
│   ├── gemini.service.ts         # Gemini Fallback (기존)
│   └── dto/
│
├── scheduler/                     # 스케줄러 모듈 (신규)
│   ├── scheduler.module.ts
│   ├── deadline-reminder.service.ts
│   ├── bulk-submit.service.ts
│   └── bpe-polling.service.ts
│
└── notification/                  # 알림 모듈 (확장)
    ├── notification.module.ts
    ├── email.service.ts
    ├── whatsapp.service.ts        # 신규
    └── templates/
```

#### PaddleOCR 서비스 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     apps/api (NestJS)                        │
├─────────────────────────────────────────────────────────────┤
│  OCR Service (Orchestrator)                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ PaddleOCR   │  │   Gemini    │  │   Manual    │          │
│  │  Service    │  │  Fallback   │  │   Review    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│ PaddleOCR       │ │ Gemini API  │ │ Human Review Queue      │
│ Python Service  │ │ (Cloud)     │ │ (Web UI)                │
│ (Docker)        │ │             │ │                         │
│ Port: 8080      │ │             │ │                         │
└─────────────────┘ └─────────────┘ └─────────────────────────┘
```

### Database Schema Changes

```sql
-- DJP Submission Log (신규)
CREATE TABLE djp_submission (
  id BIGSERIAL PRIMARY KEY,
  tax_case_id BIGINT REFERENCES tax_cases(id),
  submission_type VARCHAR(20) NOT NULL, -- 'EFILING', 'EBILLING', 'EFAKTUR'
  djp_reference_id VARCHAR(100),
  status VARCHAR(20) NOT NULL, -- 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED'
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by_consultant_id BIGINT REFERENCES consultants(id),
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BPE Storage (신규)
CREATE TABLE bpe_documents (
  id BIGSERIAL PRIMARY KEY,
  tax_case_id BIGINT REFERENCES tax_cases(id),
  bpe_number VARCHAR(50) UNIQUE NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  received_at TIMESTAMPTZ NOT NULL,
  sent_to_customer_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OCR Processing Log (확장)
ALTER TABLE ocr_results ADD COLUMN ocr_engine VARCHAR(20); -- 'PADDLEOCR', 'GEMINI', 'MANUAL'
ALTER TABLE ocr_results ADD COLUMN confidence_score DECIMAL(5,2);
ALTER TABLE ocr_results ADD COLUMN processing_time_ms INT;
ALTER TABLE ocr_results ADD COLUMN fallback_used BOOLEAN DEFAULT FALSE;

-- POA Validation Cache (신규)
CREATE TABLE poa_validation_cache (
  id BIGSERIAL PRIMARY KEY,
  poa_id BIGINT REFERENCES power_of_attorney(id),
  validated_at TIMESTAMPTZ NOT NULL,
  is_valid BOOLEAN NOT NULL,
  expiry_warning_sent BOOLEAN DEFAULT FALSE,
  next_validation_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_djp_submission_tax_case ON djp_submission(tax_case_id);
CREATE INDEX idx_djp_submission_status ON djp_submission(status);
CREATE INDEX idx_bpe_documents_tax_case ON bpe_documents(tax_case_id);
CREATE INDEX idx_ocr_results_engine ON ocr_results(ocr_engine);
```

### API Endpoints (신규)

#### DJP Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/djp/efiling/submit` | SPT 제출 |
| POST | `/api/djp/efiling/bulk-submit` | SPT 일괄 제출 |
| GET | `/api/djp/efiling/status/:submissionId` | 제출 상태 조회 |
| POST | `/api/djp/ebilling/create` | ID Billing 생성 |
| GET | `/api/djp/bpe/:taxCaseId` | BPE 조회 |
| POST | `/api/djp/efaktur/create` | e-Faktur 생성 |

#### OCR Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ocr/process` | 문서 OCR 처리 |
| GET | `/api/ocr/status/:jobId` | OCR 상태 조회 |
| POST | `/api/ocr/manual-review/:jobId` | 수동 검토 완료 |

### Integration Requirements

#### DJP API 연동

| 항목 | 요구사항 |
|------|---------|
| **인증** | OAuth 2.0 (Jakarta Tax Consulting 자격증명) |
| **Rate Limit** | 100 requests/minute |
| **Timeout** | 30초 |
| **Retry** | 지수 백오프, 최대 3회 |
| **환경** | Sandbox → Production 별도 자격증명 |

#### PaddleOCR 서비스

| 항목 | 요구사항 |
|------|---------|
| **배포** | Docker 컨테이너 |
| **모델** | PP-OCRv5 (한국어/인도네시아어 지원) |
| **GPU** | 권장 (CUDA 11.8+) |
| **API** | REST (FastAPI) |
| **포트** | 8080 |

---

## MVP Definition

### Phase 2 MVP Scope

#### In Scope (P0 - Must Have)

| 기능 | 설명 | 의존성 |
|------|------|--------|
| PaddleOCR 통합 | 1721-A1 양식 OCR 처리 | PaddleOCR 서비스 |
| SPT 제출 준비 자동화 | PPh 21, PPh 23, PPh Final 제출 데이터 생성 | - |
| 일괄 제출 준비 | 35+ 고객 동시 제출 준비 및 체크리스트 | - |
| BPE 수동 업로드 | 수동 제출 후 BPE 업로드 및 저장 | - |
| 제출 준비 완료 알림 | 준비 완료 시 컨설턴트 알림 | 알림 시스템 |

#### In Scope (P1 - Should Have)

| 기능 | 설명 | 의존성 |
|------|------|--------|
| e-Faktur 파일 생성 | PPN 거래 기반 e-Faktur 파일 자동 생성 | - |
| e-Billing 데이터 준비 | ID Billing 생성용 데이터 준비 | - |
| WhatsApp 알림 | BPE 업로드 시 고객 WhatsApp 알림 | WhatsApp Business API |
| POA 로컬 검증 | 제출 전 POA 유효성 확인 (만료 체크) | POA 테이블 |

#### Out of Scope - TODO EPIC (DJP API 승인 후)

| 기능 | 이유 |
|------|------|
| **DJP e-Filing 자동 제출** | DJP API 승인 필요 (법적 제약) |
| **BPE 자동 다운로드** | DJP API 승인 필요 |
| **e-Faktur DJP 자동 업로드** | DJP API 승인 필요 |
| **NTPN 실시간 검증** | DJP API 승인 필요 |

#### Out of Scope (Phase 3+)

| 기능 | 이유 |
|------|------|
| SPT Tahunan (연간 신고) | 별도 워크플로우 필요 |
| 모바일 앱 | 웹 우선 전략 |
| Accurate 회계 연동 | 외부 API 의존성 |
| AI 세금 최적화 권장 | 규제 검토 필요 |

### MVP Success Criteria

| 기준 | 목표 | 측정 시점 |
|------|------|----------|
| 제출 준비 자동화 완료 | 3개 세금 유형 준비 데이터 생성 | Phase 2 Week 4 |
| OCR 정확도 | 95%+ | Phase 2 Week 6 |
| 일괄 제출 준비 완료율 | 99%+ | Phase 2 Week 8 |
| BPE 업로드 후 알림 | 5분 이내 | Phase 2 Week 8 |

### MVP Timeline

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1-2 | 기반 인프라 | shadcn/ui, Bull Queue, Redis |
| 3-4 | PaddleOCR 통합 | OCR 서비스 배포, Gemini Fallback |
| 5-6 | 제출 준비 자동화 | SPT 데이터 생성, 검증 |
| 7-8 | 일괄 준비 & BPE 관리 | 체크리스트, BPE 업로드 |
| 9-10 | e-Faktur 생성 & 안정화 | e-Faktur 파일 생성, 버그 수정 |
| 11-12 | 출시 준비 | 테스트, 문서화, 배포 |

---

## Risks & Mitigations

### Technical Risks

| 리스크 | 영향 | 확률 | 완화 전략 |
|--------|------|------|----------|
| **PaddleOCR 정확도 부족** | OCR 오류 | 중 | Gemini fallback, 수동 검토 큐 |
| **제출 데이터 검증 실패** | 수동 제출 시 오류 | 중 | 사전 검증 강화, 체크리스트 |
| **BPE 업로드 누락** | 고객 알림 지연 | 저 | 업로드 리마인더, 대시보드 알림 |

### Business Risks

| 리스크 | 영향 | 확률 | 완화 전략 |
|--------|------|------|----------|
| **DJP API 승인 지연** | 자동 제출 기능 지연 | 중 | 수동 제출 워크플로우로 MVP 진행 |
| **PJAP 인증 문제** | 서비스 제공 불가 | 저 | Jakarta Tax Consulting 주도 |
| **규제 변경** | 기능 수정 필요 | 중 | 분기별 규제 검토, 유연한 설계 |

### Operational Risks

| 리스크 | 영향 | 확률 | 완화 전략 |
|--------|------|------|----------|
| **마감일 집중 부하** | 시스템 지연 | 고 | 오토스케일링, 사전 준비 권장 |
| **수동 제출 지연** | 마감일 위험 | 중 | 마감일 알림 강화, 긴급 처리 큐 |
| **OCR 서비스 장애** | 문서 처리 중단 | 저 | 다중 인스턴스, Gemini fallback |

### Contingency Plans

| 시나리오 | 대응 계획 |
|---------|----------|
| 마감일 임박 미처리 건 | 긴급 알림, 우선순위 처리 큐 |
| PaddleOCR 장애 | 100% Gemini fallback 전환 |
| 제출 준비 데이터 오류 | 수동 수정 인터페이스, 재검증 |

---

## Future Considerations

### TODO-EPIC: DJP API 자동화 (DJP 승인 후)

> **우선순위:** DJP API 승인 획득 즉시 구현

| 기능 | 설명 | 예상 복잡도 |
|------|------|------------|
| **DJP e-Filing 자동 제출** | OAuth 2.0 인증, SPT 직접 제출 | 높음 |
| **BPE 자동 다운로드** | 제출 후 BPE 자동 수신 | 중 |
| **e-Faktur DJP 업로드** | e-Faktur 시스템 직접 연동 | 중 |
| **NTPN 실시간 검증** | 납부 상태 실시간 확인 | 중 |

### Phase 3 Features (2026 Q3-Q4)

| 기능 | 설명 | 예상 복잡도 |
|------|------|------------|
| **SPT Tahunan 자동화** | 연간 세금 신고 자동화 | 높음 |
| **모바일 앱** | React Native 기반 모바일 앱 | 중 |
| **Accurate 연동** | 회계 프로그램 데이터 동기화 | 중 |
| **AI 세금 최적화** | 절세 방안 자동 추천 | 높음 |

### Technical Debt Considerations

| 항목 | 현재 상태 | 권장 개선 |
|------|----------|----------|
| **API/Services 중복** | 중복 함수 존재 | 통합 및 정리 |
| **타입 공유** | 개별 정의 | 공유 패키지 생성 |
| **UI 컴포넌트** | TailwindCSS only | shadcn/ui 도입 |
| **테스트 커버리지** | 부분적 | E2E 테스트 확대 |

### Scalability Roadmap

| 시점 | 규모 | 필요 조치 |
|------|------|----------|
| 현재 | 500 고객 | 단일 서버 |
| 6개월 | 2,000 고객 | 수평 확장, 로드 밸런서 |
| 12개월 | 10,000 고객 | 마이크로서비스 분리 고려 |

### Integration Opportunities

| 통합 대상 | 가치 | 복잡도 |
|----------|------|--------|
| **은행 API** | 자동 수입 추적 | 높음 |
| **HRIS 시스템** | 급여 데이터 동기화 | 중 |
| **e-Commerce 플랫폼** | 자동 매출 추적 | 중 |
| **세무사 협회** | 자격 검증 | 저 |

---

## Appendix

### Glossary

| 용어 | 정의 |
|------|------|
| **DJP** | Direktorat Jenderal Pajak (인도네시아 국세청) |
| **SPT** | Surat Pemberitahuan (세금 신고서) |
| **BPE** | Bukti Penerimaan Elektronik (전자 접수증) |
| **e-Faktur** | 전자 세금계산서 |
| **NTPN** | Nomor Transaksi Penerimaan Negara (납부 거래 번호) |
| **POA** | Power of Attorney (위임장) |
| **PJAP** | Penyedia Jasa Aplikasi Perpajakan (세무 애플리케이션 서비스 제공자) |
| **PPh 21** | 근로소득세 |
| **PPh 23** | 원천징수세 |
| **PPN** | 부가가치세 (VAT) |

### Reference Documents

| 문서 | 위치 |
|------|------|
| 시장 리서치 | `_bmad-output/planning-artifacts/research/market-indonesia-tax-saas-2026-01-03.md` |
| 도메인 리서치 | `_bmad-output/planning-artifacts/research/domain-indonesia-tax-regulations-2026-01-03.md` |
| PaddleOCR 기술 리서치 | `_bmad-output/planning-artifacts/research/technical-paddleocr-integration-2026-01-03.md` |
| 기존 PRD | `docs/PRD/` |
| API 아키텍처 | `docs/project-documentation/architecture-api.md` |
| Web 아키텍처 | `docs/project-documentation/architecture-web.md` |

### Change Log

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2026-01-03 | 초기 버전 작성 |

---

**Document Status:** Complete
**Next Steps:** Architecture Review → Epic/Story 생성 → Sprint Planning
