# Feature Specification: AI Pajak MVP Initial Setup

**Branch**: `001-initial-setup` | **Date**: 2025-12-28
**Status**: Draft | **Version**: 1.0

---

## 1. Overview

### 1.1 Problem Statement
인도네시아 세무 신고는 복잡하고 부담스럽습니다:
- 복잡한 신고 체계 (SPT Masa 월별 + SPT Tahunan 연간)
- 납세자 유형별 차이 (개인/UMKM/법인)
- 잦은 마감일 (매월 15일/20일/말일, 연간 3월31일/4월30일)
- 높은 오류율 (수작업 입력 → 계산 실수 → 벌금)
- 세무사 의존 (비용 부담 월 Rp 1.5M~3M)

### 1.2 Solution
AI Pajak은 **SPT Masa + SPT Tahunan 통합 자동화** 플랫폼입니다:
- 월별 자동화: 매출/급여 입력 → AI 계산 → e-Billing 생성 → DJP 제출 (5분)
- 연간 자동화: 12개월 데이터 자동 취합 → 양식 선택 → 최종 정산 → e-Filing (15분)
- 세무사 도구: 35개 고객사 통합 관리 → 일괄 신고 → 진행률 추적 (월 10시간)

### 1.3 Legal Structure (3자 분리 구조)
> **절대 원칙**: AI Pajak은 세무 서비스 제공자가 아닙니다.

| Entity | Role | Tax Services |
|--------|------|--------------|
| **Mono Flip Global** | Platform Operator | ❌ None |
| **AI Pajak** | Software Platform | ❌ None |
| **Jakarta Tax Consulting** | Tax Consultant | ⭕ Full Authority |

---

## 2. Target Users & Personas

### 2.1 Primary Users

| Persona | Description | Pain Points |
|---------|-------------|-------------|
| **Individual Taxpayer** | 근로소득자 (4천만 명) | SPT 1770 SS 작성 복잡 |
| **UMKM Owner** | 개인사업자 (6,400만 개) | PPh Final 0.5% 계산, 매월 신고 |
| **Tax Consultant** | 세무사 (1만 명) | 35+ 고객 일괄 관리 |
| **Accountant** | 회계사 | 원천세 데이터 입력 |
| **Executive (CEO/CFO)** | 경영진 | 세금 현황 승인 |

### 2.2 System Roles (RBAC)

| Role | Tax Calculation | Tax Filing | Customer Data |
|------|----------------|------------|---------------|
| **CUSTOMER** | Own only | via JTC only | Own only |
| **CONSULTANT_JTC** | Assigned clients | ❌ | Assigned clients |
| **TAX_ADVISOR_JTC** | All JTC clients | ⭕ (with POA) | All JTC clients |
| **PLATFORM_ADMIN** | ❌ | ❌ | ❌ (anonymized only) |
| **SYSTEM** | ❌ | ❌ | Billing only |

---

## 3. MVP Scope (Phase 1)

### 3.1 P0 Features (Must-Have)

#### Individual Taxpayers
- [ ] Form 1721-A1 OCR (photo/PDF upload)
- [ ] SPT 1770 SS auto-generation
- [ ] PTKP auto-calculation
- [ ] March deadline reminders (D-30, D-14, D-7)
- [ ] One-click DJP e-Filing submission
- [ ] BPE storage and retrieval

#### UMKM Business Owners
- [ ] Bank account integration (revenue tracking)
- [ ] PPh Final 0.5% auto-calculation
- [ ] Monthly reminders (D-5, D-1 before 15th)
- [ ] e-Billing generation
- [ ] SPT Masa PPh Final submission
- [ ] Year 3→4 transition alert system

#### Tax Consultants
- [ ] Multi-client dashboard (up to 50 clients)
- [ ] Auto-reminder broadcast system
- [ ] Client submission portal (standardized templates)
- [ ] Auto-validation engine
- [ ] Bulk DJP submission (35+ clients at once)
- [ ] Real-time progress tracking

#### Core Infrastructure
- [ ] Supabase Auth + RBAC (5 roles)
- [ ] PostgreSQL database (67 tables)
- [ ] DJP e-Filing integration
- [ ] DJP e-Billing integration
- [ ] OCR engine (OpenAI Vision)
- [ ] Email notifications
- [ ] Payment gateway (Midtrans)

### 3.2 Out of Scope (Phase 2+)
- Receipt OCR for expense tracking
- Accurate accounting integration
- e-Faktur PPN integration
- SPT Badan (corporate annual) automation
- White-label branding for consultants
- Mobile app

---

## 4. Technical Requirements

### 4.1 Tech Stack (from Constitution)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 + React 19 + Tailwind CSS 4 |
| Backend | Next.js API Routes |
| Database | Supabase PostgreSQL (RLS) |
| Auth | Supabase Auth |
| Language | TypeScript (strict mode) |
| OCR | OpenAI Vision API |
| Payment | Midtrans |

### 4.2 Security Requirements

1. **API Middleware Stack** (세무 데이터 엔드포인트):
   ```
   requireAuth → blockPlatformAdmin → requireRole → withAudit
   ```

2. **Tax Filing Middleware** (추가):
   ```
   requireValidPOA
   ```

3. **Database Security**:
   - Row Level Security (RLS) 필수
   - 외래 키 제약 조건
   - NPWP 형식 검증

### 4.3 Database Schema (67 Tables)

**5 Major Domains**:
1. **Core Entities** (12 tables): users, companies, tax_operators, rbac_*
2. **Tax Filing** (18 tables): tax_documents, tax_calculations, djp_submissions
3. **Billing** (8 tables): subscriptions, payments, e_billings
4. **Communication** (6 tables): notifications, activity_logs
5. **Withholding Tax** (8 tables): withholding_tax_transactions, counterparties

### 4.4 API Design

- RESTful with snake_case
- Version: `/v1/`
- Response format:
  ```json
  {
    "success": true,
    "data": {...},
    "meta": {"timestamp": "...", "request_id": "..."}
  }
  ```

---

## 5. User Flows

### 5.1 Customer Onboarding
```
1. Sign up (NPWP, email)
2. Accept Platform ToS (AI Pajak)
3. Connect with Tax Consultant (optional)
4. Sign Tax Service Agreement (Jakarta Tax Consulting)
5. Submit Surat Kuasa (POA)
6. Upload tax documents
```

### 5.2 Tax Filing Flow
```
1. Customer uploads documents
2. OCR extracts data
3. AI calculates tax
4. Consultant reviews (JTC)
5. Customer approves
6. Payment (Platform fee + Tax service fee)
7. JTC files to DJP
8. BPE delivered to customer
```

### 5.3 Consultant Workflow
```
1. View assigned clients dashboard
2. Review pending submissions
3. Validate/correct data
4. Bulk submit to DJP
5. Track progress
6. Download BPE reports
```

---

## 6. Success Criteria

### 6.1 User Acquisition (Month 3)
- 200 tax consultants signed up
- 2,000 UMKM businesses active
- 1,000 individual taxpayers
- 200 corporate clients

### 6.2 Usage Metrics
- 80% first SPT filing completion rate
- Average time to file: <5 minutes (vs 2 hours manual)
- NPS score: ≥50

### 6.3 Technical Performance
- OCR accuracy: ≥95%
- DJP submission success rate: ≥98%
- System uptime: ≥99.5%
- API response time: <500ms (p95)

### 6.4 Revenue (Year 1 Q1)
- ARR: Rp 5B+
- Churn rate: <5%
- Consultant ARPU: Rp 2.5M/month
- UMKM ARPU: Rp 200K/month

---

## 7. Compliance Checklist

### 7.1 Legal
- [ ] Platform ToS disclaims AI Pajak from tax services
- [ ] Tax service agreement states Jakarta Tax Consulting as provider
- [ ] Surat Kuasa template prepared

### 7.2 UI/UX
- [ ] All messaging avoids "AI Pajak provides tax filing"
- [ ] Jakarta Tax Consulting credit visible on filing confirmations
- [ ] Required disclaimer on all customer-facing interfaces

### 7.3 Technical
- [ ] PLATFORM_ADMIN blocked from tax data
- [ ] All DJP filings attributed to Jakarta Tax Consulting
- [ ] Audit logs immutable (10 years retention)
- [ ] POA validation before any tax filing

### 7.4 Financial
- [ ] Platform fee vs tax service fee separated in invoices
- [ ] Tax service fees recorded as pass-through/deposit
- [ ] Settlement process to Jakarta Tax established

---

## 8. Document References

| Document | Path |
|----------|------|
| Constitution | `.specify/memory/constitution.md` |
| PRD - Executive Summary | `docs/PRD/executive-summary.md` |
| PRD - MVP Scope | `docs/PRD/mvp-scope.md` |
| PRD - Legal Structure | `docs/PRD/legal-structure.md` |
| ERD Overview | `docs/ERD/README.md` |
| REST API Spec | `docs/API/rest-api-spec.md` |
| Authentication | `docs/API/authentication.md` |

---

**Last Updated**: 2025-12-28
**Author**: AI Pajak Development Team
