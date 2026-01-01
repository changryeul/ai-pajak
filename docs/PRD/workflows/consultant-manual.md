# Jakarta Tax Consulting - Consultant Manual
**상담원(SOP) 및 세무대행 업무 프로세스 매뉴얼**

**AI Pajak 플랫폼 사용 기준**

**Version**: 1.0
**Date**: 2025-12-23
**Status**: Production Ready
**Effective Date**: 2025-01-01

---

## 📋 목차 (Table of Contents)

1. [문서 목적 및 기본 원칙](#1-문서-목적-및-기본-원칙)
2. [상담원 조직 및 역할 정의](#2-상담원-조직-및-역할-정의)
3. [시스템 접근 권한](#3-시스템-접근-권한)
4. [표준 업무 프로세스](#4-표준-업무-프로세스-end-to-end)
5. [과금 및 고객 커뮤니케이션 원칙](#5-과금-및-고객-커뮤니케이션-원칙)
6. [Audit & Compliance](#6-audit--compliance)
7. [위반 시 조치](#7-위반-시-조치)
8. [FAQ](#8-faq)
9. [부칙](#9-부칙)

---

## 1. 문서 목적 및 기본 원칙

### 1.1 목적

본 문서는 **Jakarta Tax Consulting** 소속 상담원(Consultant / Tax Advisor)이 **AI Pajak 플랫폼**을 활용하여 세무대행 업무를 수행함에 있어 **역할, 권한, 책임, 업무 절차**를 명확히 정의하는 것을 목적으로 한다.

### 1.2 최상위 원칙 (절대 변경 불가)

```
┌─────────────────────────────────────────────────────┐
│ 5가지 불변의 원칙                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 1. 상담원은 AI Pajak 소속이 아니다                    │
│    → Jakarta Tax Consulting 소속 직원               │
│                                                     │
│ 2. 상담원은 반드시 Jakarta Tax Consulting 소속       │
│    → 타사 소속 불가, 프리랜서 불가                     │
│                                                     │
│ 3. AI Pajak는 세무신고를 대행하지 않는다              │
│    → 플랫폼 제공자일 뿐, 세무 서비스 제공자 아님        │
│                                                     │
│ 4. 세무신고의 법적 책임은 Jakarta Tax Consulting     │
│    → 신고 오류, 누락, 지연 책임 = JTC                 │
│                                                     │
│ 5. 모든 세무 행위는 Audit Trail로 기록된다            │
│    → 삭제 불가, 수정 불가, 영구 보존                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 1.3 법적 근거

- **인도네시아 세법**: Konsultan Pajak 규정
- **Jakarta Tax Consulting 사업자 등록증**
- **세무대리 자격증** (Brevet A/B/C)
- **AI Pajak 플랫폼 이용약관** (플랫폼 사용자)

---

## 2. 상담원 조직 및 역할 정의

### 2.1 상담원 소속

```
┌────────────────────────────────────────┐
│ 상담원의 법적 소속                       │
├────────────────────────────────────────┤
│                                        │
│ 소속 회사:  Jakarta Tax Consulting     │
│ 고용 계약:  Jakarta Tax Consulting     │
│ 이메일:     @jakartatax.co.id         │
│ 명함:       Jakarta Tax Consulting     │
│ 계약서:     Jakarta Tax Consulting 명의│
│                                        │
│ ⚠️ AI Pajak = 업무 도구일 뿐            │
│    고용주가 아님                        │
│                                        │
└────────────────────────────────────────┘
```

**이메일 예시**:
- ✅ `john.doe@jakartatax.co.id`
- ❌ `john.doe@ai-pajak.com`

**명함 예시**:
```
John Doe
Tax Consultant
Jakarta Tax Consulting

Email: john.doe@jakartatax.co.id
Phone: +62-xxx-xxxx-xxxx
```

### 2.2 상담원 역할 구분

#### **(1) Consultant (CONSULTANT_JTC)**

**데이터베이스 Role**: `CONSULTANT_JTC`

**주요 역할**:
- ✅ 고객 자료 수집 및 검토
- ✅ 세무 데이터 정리 및 입력
- ✅ 세액 계산 (AI Pajak 플랫폼 사용)
- ✅ SPT(세무신고서) 초안 작성
- ✅ ID Billing 생성 지원
- ✅ 고객 커뮤니케이션
- ✅ 자료 보완 요청

**금지 행위**:
- ❌ 세무신고 최종 제출
- ❌ DJP 시스템 직접 제출
- ❌ 세무 판단 최종 승인
- ❌ 고객 계약서 서명
- ❌ 세무 자문 (licensed advisor만 가능)

**시스템 권한**:
```typescript
{
  role: 'CONSULTANT_JTC',
  canRead: ['assigned_customers', 'tax_filings', 'documents'],
  canWrite: ['tax_filings (draft)', 'documents', 'messages'],
  canSubmit: false,  // ← 신고 제출 불가
}
```

#### **(2) Tax Advisor (TAX_ADVISOR_JTC)**

**데이터베이스 Role**: `TAX_ADVISOR_JTC`

**자격 요건**:
- ✅ Brevet A/B/C 보유
- ✅ CPA (Certified Public Accountant) 또는 동등 자격
- ✅ 세무대리 자격증 등록
- ✅ Jakarta Tax Consulting 정규직 직원

**주요 역할**:
- ✅ Consultant가 작성한 자료 검토
- ✅ 세무 판단 최종 승인
- ✅ **세무신고(SPT) 제출** ← 유일한 제출 권한
- ✅ 신고 결과에 대한 법적 책임
- ✅ 세무 자문 제공
- ✅ 복잡한 세무 이슈 해결

**시스템 권한**:
```typescript
{
  role: 'TAX_ADVISOR_JTC',
  canRead: ['all_jtc_customers', 'tax_filings', 'documents', 'poa'],
  canWrite: ['tax_filings', 'documents', 'messages', 'poa_sign'],
  canSubmit: true,  // ← 신고 제출 가능
}
```

**특이 사항**:
```
⚠️ CRITICAL: TAX_ADVISOR_JTC 역할만 신고 제출 권한 보유
              시스템이 자동으로 검증
              우회 시도 시 즉시 차단
```

---

## 3. 시스템 접근 권한

### 3.1 권한 매트릭스

| 기능 | Consultant | Tax Advisor | Platform Admin |
|------|-----------|-------------|----------------|
| **고객 데이터** |
| 담당 고객 조회 | ✅ | ✅ | ❌ **차단** |
| 전체 고객 조회 | ❌ | ✅ (JTC만) | ❌ **차단** |
| **세무 신고** |
| 자료 수집/입력 | ✅ | ✅ | ❌ |
| 세액 계산 | ✅ | ✅ | ❌ |
| SPT 초안 작성 | ✅ | ✅ | ❌ |
| **신고 제출** | ❌ | ✅ **ONLY** | ❌ |
| **위임장(POA)** |
| POA 조회 | ✅ | ✅ | ❌ (통계만) |
| POA 서명 (고객) | ❌ | ❌ | ❌ |
| POA 서명 (JTC) | ✅ | ✅ | ❌ |
| **커뮤니케이션** |
| 고객 메시지 | ✅ | ✅ | ❌ |
| **Audit Log** |
| 로그 조회 | ✅ (본인) | ✅ (JTC) | ✅ (익명화) |
| 로그 수정/삭제 | ❌ | ❌ | ❌ |

### 3.2 시스템 보안 계층

```
┌─────────────────────────────────────────┐
│ Layer 1: API Middleware                 │
│ ├─ requireAuth (로그인 필수)             │
│ ├─ blockPlatformAdmin (세무 데이터 차단) │
│ ├─ requireRole (역할 검증)               │
│ └─ requireValidPOA (위임장 검증)         │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Layer 2: Database RLS Policies          │
│ ├─ Row-level security                   │
│ ├─ Consultant = 담당 케이스만            │
│ ├─ Tax Advisor = 전체 JTC 케이스         │
│ └─ Auto audit logging                   │
└─────────────────────────────────────────┘
```

**보안 원칙**:
- ✅ 2단계 검증 (API + Database)
- ✅ 모든 접근 자동 로깅
- ✅ 위임장 없이 신고 불가
- ✅ 역할 우회 시도 시 즉시 차단

---

## 4. 표준 업무 프로세스 (End-to-End)

### 4.1 전체 프로세스 흐름도

```
[고객 가입] → [위임장 발급] → [자료 수집] → [세액 계산]
     ↓              ↓              ↓             ↓
[계약 체결]  [POA 서명(고객)] [Consultant]  [Consultant]
                   ↓
             [POA 서명(JTC)]
                   ↓
            [초안 검토] → [승인/반려] → [신고 제출] → [납부]
                ↓              ↓             ↓          ↓
          [Tax Advisor]  [Tax Advisor] [Tax Advisor] [고객]
```

### 4.2 Step-by-Step 프로세스

#### **Step 1: 고객 유입 및 계약**

**담당자**: Platform (자동) + Customer

**절차**:
1. 고객이 AI Pajak 플랫폼에서 회원가입
2. "세무대행 서비스 신청" 선택
3. Jakarta Tax Consulting과 세무대행 계약 체결
4. 고객이 **위임장(Surat Kuasa)** 업로드

**시스템 동작**:
```typescript
// 1. 고객 계정 생성
POST /api/auth/register
{
  "email": "customer@example.com",
  "customer_type": "INDIVIDUAL",
  "npwp": "1234567890123456"
}

// 2. 위임장(POA) 생성
POST /api/poa/create
{
  "customer_id": "...",
  "tax_partner_id": "JTC_ID",
  "scope": "ALL_TAX_TYPES",
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31"
}
```

**Consultant 액션**:
- [ ] 고객 계약 상태 확인
- [ ] 위임장 업로드 여부 확인
- [ ] 필요 시 고객에게 안내

---

#### **Step 2: 위임장(POA) 서명**

**담당자**: Customer → Consultant/Tax Advisor

**절차**:

1. **고객 서명**:
   - 고객이 POA 문서 업로드
   - 디지털 서명 (전자서명 or 스캔)
   - 시스템 자동 기록 (IP 주소, 타임스탬프)

2. **JTC 서명**:
   - Consultant 또는 Tax Advisor가 검토
   - JTC 대표 서명 (디지털)
   - POA 상태: `PENDING_SIGNATURE` → `ACTIVE`

**시스템 동작**:
```typescript
// 고객 서명
PUT /api/poa/{id}/sign/customer
{
  "document_url": "https://storage.../poa.pdf",
  "signature_url": "https://storage.../signature.png"
}

// JTC 서명
PUT /api/poa/{id}/sign/partner
{
  "signed_by_user_id": "tax_advisor_id",
  "signature_url": "https://storage.../jtc_signature.png"
}

// POA 활성화
// status: 'ACTIVE'
// 이제 세무신고 가능
```

**Consultant 액션**:
- [ ] POA 문서 완전성 검토
- [ ] 고객 서명 확인
- [ ] Tax Advisor에게 서명 요청
- [ ] POA 활성화 확인

---

#### **Step 3: 자료 수집 및 검토**

**담당자**: Consultant

**절차**:
1. 고객이 세무 자료 업로드 (급여명세서, 영수증 등)
2. Consultant는 자료 완전성 검토
3. 누락/오류 시 고객에게 보완 요청
4. 자료 검증 완료 후 다음 단계 진행

**필수 자료**:
- PPh 21: 급여명세서, 원천징수영수증
- PPh 23: 계약서, 송장, 입금증명서
- PPN: 세금계산서, 매출/매입 자료
- SPT Tahunan: 연간 소득증명, 공제증명서

**시스템 동작**:
```typescript
// 고객이 자료 업로드
POST /api/tax/documents/upload
{
  "tax_filing_id": "...",
  "document_type": "SALARY_SLIP",
  "file": <binary>
}

// Consultant가 자료 검토
GET /api/tax/filings/{id}/documents

// 자료 보완 요청
POST /api/messages/send
{
  "customer_id": "...",
  "message_type": "DOCUMENT_REQUEST",
  "message": "급여명세서 12월분이 누락되었습니다. 업로드 부탁드립니다."
}
```

**Consultant 체크리스트**:
- [ ] 모든 필수 자료 업로드 완료
- [ ] 자료 날짜 범위 확인 (해당 과세기간)
- [ ] 파일 품질 확인 (OCR 가능 여부)
- [ ] 특이 사항 내부 메모 기록
- [ ] 다음 단계 진행 가능 여부 판단

---

#### **Step 4: 세액 계산 및 SPT 초안 작성**

**담당자**: Consultant

**절차**:
1. AI Pajak 플랫폼에서 세액 계산
2. 계산 결과 검토 (세율, 공제, 감면 확인)
3. SPT(세무신고서) 초안 생성
4. 계산 근거 및 특이사항 내부 메모 기록
5. Tax Advisor에게 검토 요청

**시스템 동작**:
```typescript
// 세액 계산
POST /api/tax/calculate
{
  "customer_id": "...",
  "tax_type": "PPh21",
  "tax_period": "2025-01",
  "income_data": { ... },
  "deductions": { ... }
}

// SPT 초안 생성
POST /api/tax/filings/create
{
  "customer_id": "...",
  "tax_type": "PPh21",
  "tax_period": "2025-01",
  "calculated_tax": 5000000,
  "status": "DRAFT"
}

// Tax Advisor에게 검토 요청
PUT /api/tax/filings/{id}/request-review
{
  "assigned_to": "tax_advisor_id",
  "notes": "일반적인 급여소득자. 공제 사항 확인 필요."
}
```

**Consultant 체크리스트**:
- [ ] 소득 항목 정확히 입력
- [ ] 공제/감면 항목 누락 없음
- [ ] 세율 적용 정확성 확인
- [ ] 계산 결과 합리성 검토
- [ ] 특이 사항 메모 작성
- [ ] Tax Advisor 배정

---

#### **Step 5: 검토 및 승인**

**담당자**: Tax Advisor

**절차**:
1. SPT 초안 검토
2. 세법 적용 적정성 확인
3. 수정 필요 시 Consultant에게 반려
4. 승인 시 신고 단계로 이동

**시스템 동작**:
```typescript
// Tax Advisor 검토
GET /api/tax/filings/{id}/review

// 수정 필요 시 반려
PUT /api/tax/filings/{id}/reject
{
  "reason": "공제항목 중 의료비 증빙 부족. 재검토 필요.",
  "assigned_back_to": "consultant_id"
}

// 승인 시
PUT /api/tax/filings/{id}/approve
{
  "status": "UNDER_REVIEW",
  "approved_by": "tax_advisor_id",
  "notes": "검토 완료. 신고 진행 가능."
}
```

**Tax Advisor 체크리스트**:
- [ ] 세법 적용 정확성
- [ ] 증빙 자료 완전성
- [ ] 계산 논리 타당성
- [ ] 세무 리스크 평가
- [ ] 고객 이익 최적화
- [ ] 승인 또는 반려 결정

---

#### **Step 6: 세무신고 제출** ⚠️ **CRITICAL**

**담당자**: **Tax Advisor ONLY**

**절차**:
1. Tax Advisor가 최종 검토
2. POA 유효성 자동 검증 (시스템)
3. AI Pajak를 통해 DJP에 신고 제출
4. 제출 정보 자동 기록
   - 제출자 (Tax Advisor)
   - 소속 조직 (Jakarta Tax Consulting)
   - 제출 시각
   - IP 주소
5. Audit Log 자동 생성 (영구 보존)

**시스템 동작**:
```typescript
// 신고 제출 (TAX_ADVISOR_JTC만 가능)
POST /api/tax/file

// 미들웨어 스택:
composeMiddleware(
  requireAuth,                      // 1. 로그인 확인
  blockPlatformAdmin,               // 2. Platform Admin 차단
  requireRole(UserRole.TAX_ADVISOR_JTC), // 3. Tax Advisor만 허용
  requireValidPOA(),                // 4. POA 유효성 검증
  withAudit('TAX_FILING_SUBMIT')    // 5. Audit 로그 생성
)

// Request Body:
{
  "tax_filing_id": "...",
  "customer_id": "...",
  "tax_type": "PPh21",
  "power_of_attorney_id": "..."  // POA 필수
}

// Response:
{
  "status": "FILED",
  "bpe_number": "BPE1234567890",  // DJP 접수번호
  "filed_at": "2025-01-15T10:30:00Z",
  "filed_by": {
    "user_id": "tax_advisor_id",
    "name": "John Doe",
    "organization": "Jakarta Tax Consulting",
    "license_number": "CPA-12345"
  }
}
```

**시스템 자동 검증**:
```
1. requireAuth        ← 로그인 확인
2. blockPlatformAdmin ← Platform Admin 차단
3. requireRole        ← TAX_ADVISOR_JTC만 허용
4. requireValidPOA    ← POA 활성화 여부 검증
   - POA status = 'ACTIVE'
   - POA valid_from <= today
   - POA valid_to >= today
   - POA scope covers tax_type
5. withAudit          ← Audit 로그 자동 생성
6. Database Trigger   ← 최종 검증 (safety net)
```

**Consultant 시도 시**:
```json
// Consultant가 POST /api/tax/file 호출 시
{
  "error": "Forbidden",
  "message": "You do not have permission to access this resource",
  "requiredRoles": ["TAX_ADVISOR_JTC"],
  "currentRole": "CONSULTANT_JTC"
}
// HTTP 403 Forbidden
```

**Tax Advisor 체크리스트**:
- [ ] 최종 검토 완료
- [ ] POA 유효성 확인 (시스템 자동)
- [ ] 신고 제출 클릭
- [ ] BPE 번호 확인
- [ ] 고객에게 제출 완료 안내

---

#### **Step 7: 납부 및 사후 관리**

**담당자**: Consultant + Customer

**절차**:
1. 고객에게 ID Billing 안내
2. 고객이 은행/인터넷뱅킹에서 납부
3. 납부 확인 (영수증 업로드)
4. 신고 완료 통보
5. 관련 자료 보관 (5년)

**시스템 동작**:
```typescript
// ID Billing 생성
POST /api/tax/billing/create
{
  "tax_filing_id": "...",
  "amount": 5000000,
  "due_date": "2025-02-15"
}

// 고객에게 안내 메시지
POST /api/messages/send
{
  "customer_id": "...",
  "message_type": "BILLING_NOTIFICATION",
  "message": "세금 납부 안내: IDR 5,000,000\nID Billing: 1234567890\n납부 기한: 2025-02-15"
}

// 납부 확인
PUT /api/tax/filings/{id}/payment-confirmed
{
  "payment_receipt_url": "https://storage.../receipt.pdf"
}
```

**Consultant 체크리스트**:
- [ ] ID Billing 정확성 확인
- [ ] 납부 기한 안내
- [ ] 납부 방법 안내
- [ ] 영수증 업로드 요청
- [ ] 완료 메시지 발송
- [ ] 자료 아카이빙

---

## 5. 과금 및 고객 커뮤니케이션 원칙

### 5.1 과금 구조

```
┌─────────────────────────────────────────┐
│ 과금 흐름                                │
├─────────────────────────────────────────┤
│                                         │
│ 고객                                    │
│  │                                      │
│  ├─ 플랫폼 이용료 → AI Pajak (구독료)    │
│  │                                      │
│  └─ 세무대행 수수료 → Jakarta Tax Consulting
│                      (통과 과금)         │
│                                         │
│ 과금 대행: Mono Flip Global             │
│ 실제 서비스 제공: Jakarta Tax Consulting│
│                                         │
└─────────────────────────────────────────┘
```

**수수료 구조** (예시):
- **플랫폼 구독료**: Rp 99,000/월 (AI Pajak 수익)
- **세무대행 수수료**: Rp 500,000/건 (JTC 수익, AI Pajak는 통과)

**중요**:
- AI Pajak는 **세무대행 수수료를 받지 않음**
- AI Pajak는 **과금대행자**(Billing Collector)
- Jakarta Tax Consulting이 **실제 서비스 제공자**

### 5.2 상담 시 금지 표현

#### ❌ **금지 표현**

```
"AI Pajak에서 신고해드립니다"
"AI Pajak 세무대행 서비스"
"AI Pajak 소속 세무사"
"AI Pajak가 책임집니다"
"AI Pajak에 문의하세요"
```

#### ✅ **허용 표현**

```
"Jakarta Tax Consulting 소속 세무사가
 AI Pajak 플랫폼을 활용하여 신고를 진행합니다"

"저는 Jakarta Tax Consulting 소속 세무 상담원입니다"

"세무대행 서비스는 Jakarta Tax Consulting이 제공합니다"

"AI Pajak 플랫폼을 통해 편리하게 진행됩니다"

"문의사항은 Jakarta Tax Consulting으로 연락주세요"
```

### 5.3 고객 커뮤니케이션 가이드

#### **이메일 템플릿**

```
제목: [Jakarta Tax Consulting] 세무신고 진행 안내

안녕하세요, Jakarta Tax Consulting 세무 상담원 John Doe입니다.

AI Pajak 플랫폼을 통해 귀하의 세무신고 대행을 진행하고 있습니다.

현재 진행 상황:
- 자료 수집 완료
- 세액 계산 완료
- Tax Advisor 검토 중

다음 단계:
- Tax Advisor 승인 후 DJP 제출 예정 (2025-01-20)

문의사항이 있으시면 아래로 연락주세요:
- Email: john.doe@jakartatax.co.id
- Phone: +62-xxx-xxxx-xxxx

감사합니다.

Jakarta Tax Consulting
AI Pajak 플랫폼 이용
```

#### **플랫폼 메시지 템플릿**

```
[자료 보완 요청]
안녕하세요, Jakarta Tax Consulting 상담원입니다.

세무신고 진행을 위해 아래 자료가 추가로 필요합니다:
- 12월 급여명세서
- 연말정산 자료

AI Pajak 플랫폼 > 문서 업로드에서 등록해주세요.

감사합니다.
```

---

## 6. Audit & Compliance

### 6.1 Audit Log 자동 기록 항목

모든 세무 활동은 자동으로 `tax_activity_log` 테이블에 기록됩니다.

**기록 항목**:
```sql
CREATE TABLE tax_activity_log (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,           -- 누구의
    tax_filing_id UUID,                  -- 어떤 신고에 대해
    actor_user_id UUID NOT NULL,         -- 누가
    actor_organization_id UUID,          -- 어느 조직에서
    actor_role user_role_type NOT NULL,  -- 무슨 역할로
    activity_type activity_type NOT NULL,-- 무엇을 했는지
    tax_type tax_type,                   -- 어떤 세금
    tax_period VARCHAR(7),               -- 어느 기간
    activity_details JSONB,              -- 상세 내용
    ip_address INET,                     -- 어디서
    user_agent TEXT,                     -- 어떤 기기로
    created_at TIMESTAMP NOT NULL        -- 언제
);
```

**Activity Type 예시**:
- `TAX_FILING_CREATE` - 신고 생성
- `TAX_FILING_UPDATE` - 신고 수정
- `TAX_FILING_SUBMIT` - 신고 제출 ⭐
- `TAX_DOCUMENT_UPLOAD` - 문서 업로드
- `POA_SIGN_CUSTOMER` - 고객 POA 서명
- `POA_SIGN_TAX_PARTNER` - JTC POA 서명

### 6.2 로그 수정/삭제

```
❌ 불가

- 수동 수정 불가
- 수동 삭제 불가
- 시스템 자동 생성 및 보존
- 영구 저장 (법적 요구사항)
```

**시스템 강제**:
```sql
-- RLS Policy: 삭제 권한 없음
-- No DELETE policy on tax_activity_log

-- 시도 시:
DELETE FROM tax_activity_log WHERE id = '...';
-- ERROR: permission denied
```

### 6.3 Audit Log 조회

#### **Consultant 본인 로그 조회**

```typescript
GET /api/audit/my-logs

// Response:
[
  {
    "id": "log-001",
    "activity_type": "TAX_FILING_CREATE",
    "customer_id": "customer-123",
    "tax_type": "PPh21",
    "created_at": "2025-01-15T10:30:00Z"
  },
  ...
]
```

#### **Tax Advisor 전체 JTC 로그 조회**

```typescript
GET /api/audit/jtc-logs?limit=100

// Response:
[
  {
    "id": "log-001",
    "activity_type": "TAX_FILING_SUBMIT",
    "actor_user_id": "consultant-456",
    "actor_role": "CONSULTANT_JTC",
    "customer_id": "customer-123",
    "created_at": "2025-01-15T14:20:00Z"
  },
  ...
]
```

### 6.4 Compliance 체크리스트

**월간 체크리스트**:
- [ ] 모든 신고에 POA 존재 여부 확인
- [ ] Audit 로그 무결성 검증
- [ ] 권한 위반 시도 건수 확인 (목표: 0)
- [ ] 신고 제출자 역할 확인 (TAX_ADVISOR_JTC만)

**분기별 체크리스트**:
- [ ] 외부 감사 준비
- [ ] 세무대리 자격증 갱신
- [ ] 직원 교육 (세법 변경사항)
- [ ] 시스템 보안 점검

---

## 7. 위반 시 조치

### 7.1 위반 유형 및 조치

| 위반 사항 | 심각도 | 조치 | 법적 책임 |
|----------|-------|-----|----------|
| **무자격 신고 시도** | 🔴 Critical | 즉시 계정 정지 | 형사 처벌 가능 |
| **소속 위반** | 🔴 Critical | 계약 해지 | 민사 소송 |
| **권한 우회 시도** | 🔴 Critical | 법무팀 보고 | 형사 고발 |
| **POA 없이 신고** | 🟠 High | 경고 + 재교육 | 신고 무효 |
| **고객 정보 유출** | 🔴 Critical | 즉시 해고 | 손해배상 |
| **Audit 로그 조작 시도** | 🔴 Critical | 즉시 해고 | 형사 처벌 |
| **허위 신고** | 🔴 Critical | 즉시 해고 + 고발 | 형사 처벌 |
| **금지 표현 사용** | 🟡 Medium | 경고 + 재교육 | - |

### 7.2 시스템 자동 차단

**시스템이 자동으로 차단하는 경우**:

1. **Consultant가 신고 제출 시도**
   ```
   → HTTP 403 Forbidden
   → 보안팀 알림 발송
   → 계정 일시 정지
   ```

2. **POA 없이 신고 시도**
   ```
   → HTTP 400 Bad Request
   → 경고 메시지 표시
   → Tax Advisor에게 알림
   ```

3. **타 조직 고객 접근 시도**
   ```
   → HTTP 403 Forbidden
   → RLS 정책에 의해 차단
   → 보안 로그 기록
   ```

### 7.3 재교육 프로그램

**경미한 위반 시 재교육** (1회 경고):
- [ ] 본 매뉴얼 재숙독
- [ ] 세무대리 윤리 교육 이수
- [ ] 시스템 보안 교육 이수
- [ ] 테스트 통과 (80점 이상)
- [ ] 서약서 재작성

**2회 위반 시**:
- 1개월 업무 정지
- 급여 50% 삭감
- 최종 경고

**3회 위반 시**:
- 계약 해지
- 업계 블랙리스트 등록

---

## 8. FAQ

### Q1: Consultant도 신고를 제출할 수 없나요?

**A**: 아니요, **절대 불가능**합니다.

세무신고 제출은 **법적 책임**이 따르는 행위로, **세무대리 자격증**(Brevet, CPA)을 보유한 **Tax Advisor만** 가능합니다.

시스템이 자동으로 차단하며, 시도 시 계정이 정지될 수 있습니다.

### Q2: 긴급 상황에서 Tax Advisor가 부재 시 어떻게 하나요?

**A**: Jakarta Tax Consulting 내부 에스컬레이션 절차를 따릅니다.

1. 다른 Tax Advisor에게 케이스 재배정
2. 백업 Tax Advisor 지정 (사전 설정)
3. 관리자에게 긴급 지원 요청

**절대 Consultant가 대신 제출할 수 없습니다.**

### Q3: 고객이 "AI Pajak에서 신고한다"고 이해하고 있다면?

**A**: 즉시 정정해주세요.

```
"고객님, 정확히 말씀드리면
Jakarta Tax Consulting 소속 세무사가
AI Pajak 플랫폼을 활용하여 신고를 진행합니다.

AI Pajak는 편리한 플랫폼 도구일 뿐이며,
실제 세무대행 서비스는 Jakarta Tax Consulting이 제공합니다."
```

### Q4: POA가 만료된 고객의 신고는 어떻게 하나요?

**A**: 시스템이 자동으로 차단합니다.

1. 고객에게 POA 갱신 요청
2. 고객이 새 POA 업로드 및 서명
3. JTC 서명 후 활성화
4. 신고 진행

**POA 없이는 절대 신고 불가능**합니다. (시스템 강제)

### Q5: Audit Log를 수정해야 하는 경우가 있나요?

**A**: **절대 없습니다.**

Audit Log는 **법적 증거**로, 어떤 경우에도 수정/삭제할 수 없습니다.

잘못 기록된 경우 → 새로운 로그 추가로 보정

### Q6: 고객 데이터를 외부로 가져갈 수 있나요?

**A**: **절대 불가능**합니다.

- AI Pajak 플랫폼 외부로 데이터 반출 금지
- 개인 이메일로 전송 금지
- USB/외장하드 복사 금지
- 스크린샷도 최소화

**GDPR/Indonesian DPP 위반 시 형사 처벌**

### Q7: 플랫폼 관리자(PLATFORM_ADMIN)도 고객 데이터를 볼 수 있나요?

**A**: **아니요, 절대 불가능**합니다.

PLATFORM_ADMIN은 **통계만** 볼 수 있습니다:
- ✅ 전체 고객 수
- ✅ 월간 신고 건수
- ✅ 매출 범위 (1M-5M, 5M-10M 등)
- ❌ 고객 이름, NPWP, 세금 금액 등 **모두 차단**

이는 시스템이 **강제로** 차단합니다.

---

## 9. 부칙

### 9.1 문서 효력

본 SOP는 **Jakarta Tax Consulting 내부 규정**으로 적용되며, AI Pajak 플랫폼 정책 및 관련 법령 변경 시 개정될 수 있다.

### 9.2 개정 이력

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-23 | 최초 작성 | Jakarta Tax Consulting |

### 9.3 관련 문서

- [LEGAL_STRUCTURE.md](LEGAL_STRUCTURE.md) - 법적 구조 전체 문서
- [AUTH_RBAC_IMPLEMENTATION.md](AUTH_RBAC_IMPLEMENTATION.md) - 시스템 권한 설명
- [POWER_OF_ATTORNEY.md](POWER_OF_ATTORNEY.md) - 위임장 세부 가이드
- [OPERATIONS_MANUAL.md](OPERATIONS_MANUAL.md) - 운영 매뉴얼

### 9.4 교육 및 승인

**모든 상담원은**:
- [ ] 본 매뉴얼 숙독 (최소 2회)
- [ ] 온라인 교육 이수
- [ ] 테스트 통과 (90점 이상)
- [ ] 서약서 작성 및 서명
- [ ] 관리자 승인 후 계정 활성화

**서약서 템플릿**:
```
나는 Jakarta Tax Consulting 소속 상담원으로서
본 매뉴얼의 모든 규정을 숙지하였으며,
이를 철저히 준수할 것을 서약합니다.

특히 다음 사항을 엄수하겠습니다:
1. 무자격 신고 절대 금지
2. 고객 데이터 보안 철저
3. POA 없이 신고 금지
4. 허위 신고 절대 금지
5. 금지 표현 사용 금지

서약일: 2025-01-01
이름: ________________
서명: ________________
```

---

## 🎯 한 줄 요약 (교육용)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   상담원은 Jakarta Tax Consulting 소속이며,          │
│   AI Pajak는 도구이고,                              │
│   신고 책임은 사람에게 있다.                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

**문의사항**:
- Jakarta Tax Consulting HR: hr@jakartatax.co.id
- 기술 지원: tech-support@jakartatax.co.id
- 법무 문의: legal@jakartatax.co.id

---

**Effective Date**: 2025-01-01
**Jakarta Tax Consulting © 2025**
