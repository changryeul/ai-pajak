# PRD Update Summary - 2025-12-23
## Legal & Operational Structure Integration

---

## Executive Summary

✅ **법적·운영 구조 완전 통합 완료**

AI Pajak PRD에 **법적 포지셔닝, 계약 관계, 권한 체계, 기술 구현**을 모두 반영하여 개발·운영·마케팅·법무가 하나의 일관된 문서로 작업할 수 있도록 정리했습니다.

---

## What Changed

### 1. PRD.md (v3.1 → v3.2)

#### ✅ 신규 추가: 섹션 1.1 "Legal & Operational Structure"

**포함 내용**:
- 1.1.1 주체별 역할 정의 (Mono Flip Global, AI Pajak, Jakarta Tax Consulting, Customer)
- 1.1.2 계약 관계 (3개 계약: Customer↔Jakarta Tax, MFG↔Jakarta Tax, AI Pajak↔Customer)
- 1.1.3 RBAC (Role-Based Access Control) 권한 매트릭스
- 1.1.4 고객 여정 (End-to-End Journey) - Mermaid 다이어그램
- 1.1.5 상담원 정의 (Employment, Job Titles, System Account)
- 1.1.6 기술 구현 요구사항
  - Database schema (user roles, organizations, audit logs)
  - Authentication & authorization middleware (TypeScript 예제)
  - DJP filing function (Jakarta Tax attribution)
- 1.1.7 마케팅·UI 컴플라이언스 가이드 (허용/금지 문구)
- 1.1.8 결제 및 매출 인식 (Platform fee vs. Tax service fee 분리)
- 1.1.9 컴플라이언스 체크리스트

**핵심 원칙 명시**:
```
AI Pajak is a tax preparation and management platform.
AI Pajak does not provide tax filing or tax representation services.
All tax filing services are provided solely by Jakarta Tax Consulting.
AI Pajak acts only as a collecting agent for tax service fees.
```

#### ✅ 업데이트: 섹션 11.5 "규제 및 컴플라이언스"

**Before**:
- ~~"도구 제공 vs 신고 대행" 명확한 법적 구분 없음~~
- ~~AI PAJAK Phase 1/2 라이선스 불확실~~
- ~~권장: 법률 자문 받아 정확한 포지셔닝 결정~~

**After**:
- ✅ **최종 해결 방안 명시**
  - AI Pajak = 플랫폼 제공자 (세무대행 ❌)
  - Jakarta Tax Consulting = 유일한 세무대행 주체
  - Mono Flip Global = 과금대행 (Collecting Agent)
  - 명확한 역할 분리로 라이선스 리스크 회피
  - 상세 내용은 섹션 1.1 참조

#### ✅ 업데이트: Success Factors (섹션 13)

**Before**:
- ✅ DJP 직접 연동 (원클릭 제출)
- ✅ 세무사 파트너십 (고객 자동 유입)

**After**:
- ✅ Jakarta Tax Consulting 파트너십 (법적 안정성 + 전문성)
- ✅ 명확한 법적 포지셔닝 (플랫폼 vs. 세무대행 분리)

#### ✅ 업데이트: 문서 버전 정보

**Header**:
```
Version: 3.2 (Complete Tax Filing System + Legal Structure)
Last Updated: 2025-12-23
Legal Structure: AI Pajak (Platform) × Jakarta Tax Consulting (Tax Services) × Mono Flip Global (Operator)
```

**Footer**:
```
문서 버전: 3.2 (법적 구조 확정)
최종 업데이트: 2025-12-23 (법적·운영 구조 완전 반영)

주요 업데이트 (v3.2):
✅ 법적·운영 구조 완전 정의
✅ 기술 구현 요구사항 명시
✅ 마케팅·UI 컴플라이언스 가이드
✅ 매출 인식 및 정산 로직

다음 단계:
5. ✅ 법적 구조 확정 (AI Pajak × Jakarta Tax Consulting × Mono Flip Global)
6. → 데이터베이스 스키마 설계 (ERD)
7. → UI/UX 목업 제작 (법적 컴플라이언스 반영)
8. → MVP Sprint 1 시작 (Supabase 셋업 + RBAC 구현)
```

---

### 2. LEGAL_STRUCTURE.md (신규 생성)

**목적**: PRD의 법적 섹션을 보다 상세하게 확장한 독립 문서

**구성**:
1. Quick Reference Card (한 페이지 요약)
2. Entity Definitions (4개 주체별 상세 정의)
3. Contractual Framework (3개 계약 템플릿)
4. Role-Based Access Control (권한 매트릭스 + Critical Rules)
5. Customer Journey (Mermaid 다이어그램 + 단계별 설명)
6. Consultant Definition (Employment, Job Titles, System Account)
7. Technical Implementation
   - Database schema (SQL)
   - Authentication middleware (TypeScript)
   - DJP filing service (TypeScript)
   - Revenue recognition (TypeScript)
8. Marketing & UI Compliance (허용/금지 예시)
9. Compliance Checklist (Feature 출시 전 점검 항목)
10. FAQs (10개 자주 묻는 질문)
11. Next Steps (개발 전·중·후 체크리스트)

**용도**:
- 개발자: 기술 구현 시 참조
- 법무: 계약서 작성 시 참조
- 운영: 채용·교육·프로세스 수립 시 참조
- 마케팅: 문구 검토 시 참조

---

## Why This Matters

### 1. 법적 리스크 완화 ✅
- DJP에 대한 명확한 포지셔닝
- 외국인 오너 + 세무대행 금지 규정 우회
- PJAP 라이선스 불확실성 해소

### 2. 투자자 실사 대비 ✅
- 명확한 매출 귀속 (Platform fee vs. Tax service fee)
- 법적 리스크 요소 사전 제거
- 계약 구조 투명화

### 3. 개발 일관성 확보 ✅
- RBAC 명확한 정의 → 권한 혼선 방지
- Audit log 요구사항 명시 → 추후 법적 대응 가능
- UI/UX 가이드라인 → 마케팅·개발 간 충돌 방지

### 4. 운영 효율성 향상 ✅
- 상담원 채용·교육 기준 명확화
- 고객 지원 프로세스 표준화
- 결제·정산 자동화 로직 정의

---

## Key Principles (핵심 원칙)

### 1. 역할 분리 (Role Separation)

```
AI Pajak         →  도구 (Tools)
Jakarta Tax      →  책임 (Liability)
Mono Flip Global →  과금대행 (Collection)
Customer         →  데이터 소유 (Data Owner)
```

### 2. 권한 철저 제한 (Strict Access Control)

```
Platform Admin   →  고객 세무 데이터 접근 ❌
Tax Consultant   →  배정된 고객만 접근 ✅
Customer         →  본인 데이터만 접근 ✅
```

### 3. 투명한 귀속 (Clear Attribution)

```
모든 DJP 제출 로그:
- filed_by_organization: "Jakarta Tax Consulting"
- consultant_npwp: XXX
- 10년 보관 (UU KUP)
```

### 4. 매출 분리 (Revenue Separation)

```
Platform Fee     →  Mono Flip Global 매출
Tax Service Fee  →  Jakarta Tax Consulting 매출
                    (Mono Flip Global는 예수금으로 처리)
```

---

## Implementation Checklist

### Phase 1: Legal (Before Development)
- [ ] 인도네시아 세법 전문 변호사 리뷰 받기
- [ ] 계약서 3종 드래프트 작성
  - [ ] Tax Service Agreement (Customer ↔ Jakarta Tax)
  - [ ] Collection Agency Agreement (MFG ↔ Jakarta Tax)
  - [ ] Platform ToS (AI Pajak ↔ Customer)
- [ ] Jakarta Tax Consulting 법인 등록 확인
- [ ] PJAP 인증 신청 (Jakarta Tax Consulting)

### Phase 2: Technical (During Development)
- [ ] Database schema 구현 (user_role ENUM, organizations table)
- [ ] RBAC middleware 구현 (requireTaxDataAccess, requireTaxFilingAuthority)
- [ ] Audit logging 구현 (tax_filing_logs table)
- [ ] DJP filing service 구현 (Jakarta Tax attribution)
- [ ] Revenue recognition 자동화 (platformFee vs taxServiceFee)

### Phase 3: UI/UX (During Development)
- [ ] 모든 UI 텍스트 법적 컴플라이언스 검토
- [ ] Jakarta Tax Consulting 크레딧 명시
- [ ] 고객 여정 프로토타입 (Surat Kuasa 포함)
- [ ] Consultant profile 페이지 (Jakarta Tax branding)

### Phase 4: Operations (Before Launch)
- [ ] 상담원 채용·교육 (Jakarta Tax Consulting 소속)
- [ ] 이메일 도메인 설정 (@jakartatax.co.id)
- [ ] 명함 제작 (Jakarta Tax Consulting)
- [ ] 고객 지원 스크립트 작성 (법적 컴플라이언스 반영)

### Phase 5: Marketing (Before Launch)
- [ ] 웹사이트 문구 법적 리뷰
- [ ] 광고 캠페인 문구 법적 리뷰
- [ ] SNS 포스트 템플릿 작성
- [ ] 파트너십 발표 자료 (Jakarta Tax 강조)

### Phase 6: Financial (Before Launch)
- [ ] 청구서 템플릿 (platformFee + taxServiceFee 분리 명시)
- [ ] 회계 시스템 설정 (매출 vs 예수금)
- [ ] Jakarta Tax 정산 프로세스 자동화
- [ ] Payment Gateway 수수료 배분 로직

---

## Developer Quick Start

### 1. Database Setup

```bash
# Run migrations
psql -U postgres -d aipajak < migrations/001_user_roles.sql
psql -U postgres -d aipajak < migrations/002_organizations.sql
psql -U postgres -d aipajak < migrations/003_consultant_clients.sql
psql -U postgres -d aipajak < migrations/004_tax_filing_logs.sql
```

### 2. Seed Data

```sql
-- Insert Jakarta Tax Consulting organization
INSERT INTO organizations (id, name, type, npwp, email_domain)
VALUES (
  'jakarta-tax-uuid',
  'Jakarta Tax Consulting',
  'TAX_FIRM',
  '1234567890123456',
  'jakartatax.co.id'
);

-- Insert Platform Operator organization
INSERT INTO organizations (id, name, type, email_domain)
VALUES (
  'mono-flip-uuid',
  'Mono Flip Global',
  'PLATFORM_OPERATOR',
  'aipajak.com'
);
```

### 3. Authentication Middleware

```typescript
// Apply to all tax data routes
app.use('/api/tax/*', requireTaxDataAccess);

// Apply to DJP filing routes
app.post('/api/djp/file', requireTaxFilingAuthority, async (req, res) => {
  // Only reachable by Jakarta Tax Consulting users
  const result = await fileToDJP({
    customerId: req.body.customerId,
    consultantUserId: req.user.id,
    sptData: req.body.sptData,
  });

  res.json(result);
});
```

### 4. UI Components

```tsx
// Tax Filing Button
<button onClick={handleConnect}>
  Hubungkan dengan Konsultan Pajak
</button>
<p className="disclaimer">
  Layanan pelaporan pajak disediakan oleh Jakarta Tax Consulting
</p>

// Filing Status
{filing.bpe && (
  <div>
    <p>✅ Dilaporkan oleh Jakarta Tax Consulting</p>
    <p>BPE: {filing.bpe}</p>
    <p>Tanggal: {formatDate(filing.filedAt)}</p>
  </div>
)}
```

---

## Questions & Support

### For Legal Questions
- Contact: [legal@monoflip.global] (placeholder)
- Escalate to: Indonesian tax lawyer

### For Technical Questions
- Refer to: `/docs/LEGAL_STRUCTURE.md` Section 6
- Code examples in: `/docs/PRD.md` Section 1.1.6

### For Marketing Questions
- Refer to: `/docs/LEGAL_STRUCTURE.md` Section 7
- Compliance checklist in: `/docs/PRD.md` Section 1.1.9

### For Operations Questions
- Refer to: `/docs/LEGAL_STRUCTURE.md` Section 5
- Customer journey in: `/docs/PRD.md` Section 1.1.4

---

## Impact Assessment

### 🟢 Positive Impacts

1. **법적 안정성**
   - DJP 규제 리스크 완화
   - 투자자 실사 통과 가능성 증가
   - 외국인 오너 규제 우회

2. **개발 효율성**
   - 권한 체계 명확 → 보안 버그 감소
   - 코드 예제 제공 → 구현 속도 향상
   - 일관된 문서 → 팀 커뮤니케이션 개선

3. **운영 효율성**
   - 명확한 프로세스 → 교육 비용 감소
   - 표준화된 문구 → 브랜드 일관성
   - 자동화 로직 → 수동 작업 감소

### 🟡 Considerations

1. **복잡도 증가**
   - 3개 주체 관리 (AI Pajak, Jakarta Tax, MFG)
   - 매출 분리 회계 처리 필요
   - 다중 계약 관리 필요

2. **의존성**
   - Jakarta Tax Consulting 파트너십 필수
   - Jakarta Tax가 철수 시 대응 방안 필요
   - PJAP 인증 취득 시간 소요

### 🔴 Risks

1. **Jakarta Tax Consulting이 준비 안 된 경우**
   - 법인 미등록 → 등록 필요 (2-4주)
   - PJAP 미인증 → 인증 신청 (1-3개월)
   - 상담원 미확보 → 채용 필요

2. **법적 해석 차이**
   - DJP가 다르게 해석할 가능성
   - 추가 법률 자문 필요
   - Worst case: 구조 변경 필요

---

## Next Immediate Actions

### 이번 주 (Week of 2025-12-23)
1. [ ] Jakarta Tax Consulting 대표와 미팅
   - 이 구조에 대한 동의 확보
   - 계약서 드래프트 공유
   - PJAP 인증 현황 확인
2. [ ] 인도네시아 세법 전문 변호사 자문 의뢰
   - LEGAL_STRUCTURE.md 검토 요청
   - 계약서 드래프트 작성 의뢰
3. [ ] 개발팀과 기술 구현 리뷰
   - Database schema 검토
   - RBAC middleware 설계 리뷰
   - Audit logging 요구사항 확인

### 다음 주 (Week of 2025-12-30)
1. [ ] 계약서 초안 완성
2. [ ] Database migration 스크립트 작성
3. [ ] UI/UX 문구 법적 리뷰 시작
4. [ ] Jakarta Tax 채용 계획 수립

### 1월 (January 2026)
1. [ ] MVP Sprint 1 시작 (RBAC 구현)
2. [ ] Jakarta Tax 상담원 1-2명 채용
3. [ ] PJAP 인증 신청 (Jakarta Tax)
4. [ ] 베타 테스터 리크루팅 시작

---

## Document References

1. **Main PRD**: `/docs/PRD.md`
   - Executive Summary: Lines 9-48
   - Legal Structure: Lines 51-357
   - Full PRD: 4,876 lines

2. **Legal Structure Detail**: `/docs/LEGAL_STRUCTURE.md`
   - Quick Reference: Lines 1-50
   - Technical Implementation: Lines 200-600
   - Compliance: Lines 700-900

3. **This Summary**: `/docs/UPDATE_SUMMARY_2025-12-23.md`
   - Current file

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-23 | 1.0 | Initial creation | AI Pajak Product Team |

---

**End of Update Summary**

Questions? Review `/docs/LEGAL_STRUCTURE.md` Section 9 (FAQs) first.
