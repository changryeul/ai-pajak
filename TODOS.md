# TODOS

Deferred work and open items. Each entry includes context so it is actionable later.

---

## 개인신고 프로토타입 이식 — PR3 (자산/부채/경고 심화)

Originally deferred from 2026-04-18 `/plan-eng-review`. **2026-05-09 점검 결과: T-001~T-006이 PR1+PR2 작업으로 이미 코드에 반영됨.** 회귀 검증(snapshots POST/GET/DELETE + funding-source GET) 통과.
전체 맥락: `~/.gstack/projects/changryeul-ai-pajak/winwaysystems-main-eng-review-test-plan-20260418-123746.md`

### ~~T-001. 개인 고객 자산/부채 5년 시계열 스냅샷~~ ✅ DONE

- 마이그레이션 `20260418000002_customer_asset_liability_snapshots.sql` — `asset_snapshot` / `liability_snapshot` 테이블 + RLS (customer 자기 데이터, JTC 컨설턴트 read)
- API `/api/customer/snapshots` GET/POST/DELETE — Zod schema 분기 (asset/liability/income), `withAudit('SNAPSHOT_*')`
- UI `AssetsLiabilitiesCard` (대시보드 최신 연도 카테고리 합계), `PersonalDashboardV3` 의 4종 LineChart (도메스틱/해외 자산·부채), `/assets` inline CRUD 페이지
- 회귀 검증 완료 (2026-05-09)

### ~~T-002. 이상 징후 rule engine — 자산 증가율 vs 소득 증가율~~ ✅ DONE

- `src/lib/audit/risk-detector.ts` — `detectAuditRisks()` pure function
- UI `GrowthAnomalyCard` (290 LOC) — 임계값 초과 시 amber/rose 경고 + 자금 출처 설문 표출
- `PersonalDashboardV3` 섹션 9 통합

### ~~T-003. 자금 출처 설문 (이상 트리거 시)~~ ✅ DONE

- 마이그레이션 `20260418000003_income_snapshot_and_funding_source.sql` — `customer_funding_source` 테이블
- API `/api/customer/funding-source` GET/POST
- `GrowthAnomalyCard` 안에서 chip 형태로 입력 + 메모

### ~~T-004. 해외자산 국경별 신고 경고 (KR 5억 KRW 등)~~ ✅ DONE

- 마이그레이션 `20260418000004_customer_cross_border.sql` — `customer.nationality`, `tax_residence_country` 컬럼
- `src/lib/cross-border/foreign-asset-rules.ts` — 국가별 임계값 룰
- UI `ForeignAssetReportingCard` (203 LOC)

### ~~T-005. 국적 × 세법기준 2축 선택 UI~~ ✅ DONE

- 마이그레이션 `20260418000004_customer_cross_border.sql` 으로 두 컬럼 추가됨
- `NationalityResidenceCard` + `PersonalDashboardV3` 섹션 1 헤더에 노출
- `nationality_list` 확장 마이그레이션 `20260425000001` 까지 적용됨

### ~~T-006. 은행 계좌 복수 입력 UI (자산 상세)~~ ✅ DONE

- 마이그레이션 `20260418000005_customer_bank_account.sql`
- API `/api/customer/bank-accounts` (있음)
- UI `BankAccountsCard`

---

## 남은 deferred 항목

### T-007. 개인 고객 전용 ID billing 재디자인 (선택)

- **What:** 프로덕션 `/tax/billing`은 법인 중심. 개인 신고 후 ID billing 발행 흐름의 개인용 간소화 버전 검토.
- **Why:** 프로토타입의 ID billing UX가 법인보다 단순 — 한 번에 한 신고만 처리. 유지보수 관점에서 두 개 유지할 가치가 있는지 판단 필요.
- **Status:** 개인 고객 실제 사용 데이터 확보 후 재평가. 처음엔 기존 `/tax/billing`에 `customer_type` 분기 추가로 커버 가능할 수도.
- **Depends on:** 개인 고객 실제 사용 데이터 (피드백)

### T-008. 개인 고객 세금 보고서 페이지 — 재평가 필요 ⚠️

- **What:** 프로덕션 `/reports`는 INDIVIDUAL 고객에게 `IndividualFilingHistory` 컴포넌트(5년 신고 이력 + BPE 슬롯)를 표시 중.
- **Status:** `/reports` 가 이미 충분한지 판단 필요. 추가 페이지가 필요한 신호가 사용자에게서 들어오기 전까지 close 후보.
- **Depends on:** `/reports` 를 INDIVIDUAL 계정으로 dogfooding

### T-009. Privy/VIDA PSrE 전자서명 연동 (법적 완전성)

- **What:** 현재 canvas + audit metadata(hash/timestamp/IP/UA) 조합은 MVP 수준. Kominfo 인증 PSrE(Privy, VIDA, BSrE) API 연동으로 법적으로 완전한 전자서명 대체.
- **Why:** UU ITE 11/2008 + PP 71/2019 기준으로 canvas PNG는 "전자서명"이 아님. 위임장 분쟁 시 JTC 방어력 약함. Privy 연동으로 법적 리스크 완전 제거.
- **Pros:** 법원 인정 수준의 서명 유효성, enterprise 고객 신뢰도.
- **Cons:** Privy API 구독료 + 서명 건당 요금. 연동 개발 +1~2주. 유저 UX 추가 단계 (Privy 리다이렉트 또는 embed).
- **Trigger threshold:** 고객 서명 볼륨이 월 100건 넘어가면 도입 검토.

### T-010. INDIVIDUAL 고객 전용 OCR 프롬프트 검증

- **What:** 현재 `DocumentOCRUploader` + `/api/documents/ocr-extract`는 COMPANY 월신고 bukti potong 컨텍스트에 tune됨. INDIVIDUAL 프로필 자동채움(KK, A1 1721-A1)에 맞는 프롬프트/응답 스키마 별도 검증 필요.
- **Why:** 실제로는 프롬프트/필드 매핑이 COMPANY 지향. KK는 가족관계증명, A1은 개인 원천징수영수증으로 문서 종류가 다름.
- **Process:** 현행 OCR에 KK/A1 샘플 5~10장 넣어 정확도 측정. 80% 이상이면 그대로 사용, 미만이면 INDIVIDUAL-specific prompt template 추가.
- **Depends on:** 실 ANTHROPIC_API_KEY + 샘플 문서 확보
