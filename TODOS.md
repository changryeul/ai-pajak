# TODOS

Deferred work and open items. Each entry includes context so it is actionable later.

---

## 개인신고 프로토타입 이식 — PR3 (자산/부채/경고 심화)

Deferred from 2026-04-18 `/plan-eng-review`. PR1 + PR2가 먼저 merge된 뒤 진행.
전체 맥락: `~/.gstack/projects/changryeul-ai-pajak/winwaysystems-main-eng-review-test-plan-20260418-123746.md`

### T-001. 개인 고객 자산/부채 5년 시계열 스냅샷

- **What:** 개인 고객 단위로 자산(현금/부동산/주식/차량/사업자산/기타)과 부채(은행대출/신용/개인차입/사업/기타)를 **연도별 스냅샷**으로 저장. 프로토타입의 `assetData` / `liabilityData` / `foreignAssetData` 대응.
- **Why:** 프로토타입 대시보드의 "최근 5년 자산/부채 변동" 차트 + 이상 징후 판정(T-002) 전제. 시계열 없이는 증가율 계산 불가.
- **Pros:** SPT 1770/1770S 섹션 자산/부채 제출 전 여러 해 누적치 검증 가능, Coretax 형식(Harta/Utang) 그대로 매핑.
- **Cons:** 신규 테이블 3~4개 (asset_snapshot, liability_snapshot, foreign_asset_snapshot, bank_account) + RLS 정책. 초기에는 수동 입력, 데이터 쌓이려면 1~2년 걸림.
- **Context:** 프로토타입의 localStorage 저장은 절대 이식 금지 (보안/멀티디바이스). Supabase 테이블 + RLS(`customer_id = current_customer_id()`) 필수. 자산 타입은 `asset_type TEXT CHECK IN (...)`, 연도는 `snapshot_year INT`, 단위는 IDR 고정 후 통화 컬럼으로 확장.
- **Depends on:** 없음 (PR3 첫 작업)

### T-002. 이상 징후 rule engine — 자산 증가율 vs 소득 증가율

- **What:** 자산 증가율이 소득 증가율의 1.5배를 초과하면 경고 배너 + 자금 출처 설문 표출.
- **Why:** 세무조사 대응 사전 점검. JTC 컨설팅 품질 디퍼런시에이터.
- **Pros:** 단순한 rule engine으로 시작, 이후 LLM 기반 더 정교한 risk score로 확장 가능. 고객은 스스로 준비 시점 파악.
- **Cons:** 1.5배 임계값이 자의적 — 인도네시아 세무조사 trigger 실제 기준 검증 필요. false positive 시 고객 불안.
- **Context:** `src/lib/risk/asset-growth-anomaly.ts` pure function. 입력: 지난 2년 자산 총액 + 소득 총액. 출력: `{ isWarning: boolean, assetGrowthRate: number, incomeGrowthRate: number, reason: string }`.
- **Depends on:** T-001 (5년 자산 시계열 필요)

### T-003. 자금 출처 설문 (이상 트리거 시)

- **What:** T-002 경고가 뜨면 대시보드에 자금출처 선택 UI (급여/사업/투자/차입/증여/기타 복수 선택) + 메모 입력.
- **Why:** 고객이 경고 순간에 설명을 기록 → 세무조사 대응 시 증빙 준비 기반 마련.
- **Pros:** 컨설턴트가 고객 검토 시 원클릭 참조, 고객 신뢰도 ↑.
- **Cons:** 답변 기록하는 테이블 필요 (`customer_funding_source`), 개인정보 민감도 높음 — RLS 엄격.
- **Context:** 설문 응답은 신고 연도 단위로 저장. 컨설턴트 뷰에만 노출.
- **Depends on:** T-002

### T-004. 해외자산 국경별 신고 경고 (KR 5억 KRW 등)

- **What:** 사용자 국적 기준으로 해외자산 신고 의무 발생 여부 자동 판정.
- **Why:** 인도네시아 거주 한국인은 한국 본국 해외금융계좌 신고 의무(5억 KRW 초과). 미국 시민권자는 FBAR(1만 달러). JTC의 cross-border 고객이 가장 필요로 하는 기능.
- **Pros:** 경쟁 플랫폼에 거의 없는 기능. cross-border 세그먼트 락인.
- **Cons:** 국가별 룰 + 환율 테이블(daily update) + 법적 disclaimer 필수. 오경보 시 법적 리스크.
- **Context:** `src/lib/cross-border/foreign-asset-rules.ts` — 국가별 rule 맵. 환율은 BI/Kemenkeu API 일일 cache. 프로토타입의 `isKRForeignReport` 상수 5억 KRW가 시작점.
- **Depends on:** T-001 (해외자산 시계열 필요)

### T-005. 국적 × 세법기준 2축 선택 UI

- **What:** 대시보드 상단에서 국적(KR/ID/US/JP)과 세법기준 국가(KR/ID/US/JP)를 별도 선택.
- **Why:** T-004의 입력값이 필요. 프로토타입은 state로만 존재, 저장 안 됨.
- **Pros:** 사용자 세그먼트 파악 도구로도 활용 (MRR 대비 cross-border 비중 측정).
- **Cons:** customer 테이블에 `nationality`, `tax_residence_country` 컬럼 추가. 국가 enum 관리 필요.
- **Context:** 가입 step 1에서 선택 받는 것도 검토. 기본값은 ID/ID.
- **Depends on:** T-004 (이 데이터를 소비)

### T-006. 은행 계좌 복수 입력 UI (자산 상세)

- **What:** 개인 고객이 여러 은행 계좌(은행명/계좌번호/통화/연말잔액) 입력. 프로토타입의 `bankAccounts` 배열 대응.
- **Why:** SPT 1770/1770S의 자산(Harta) 섹션에 은행 계좌 목록 필수. Coretax 업로드 시 필드 요구.
- **Pros:** 자동저장 + 재사용 (매년 전년도 데이터 copy). 1770 폼 자동 prefill 가능.
- **Cons:** 계좌번호는 민감정보 → RLS + 암호화 저장 검토.
- **Context:** `customer_bank_account` 테이블. (bank_name, account_last4 VARCHAR(4), currency, balance_idr, snapshot_year). 전체 계좌번호는 저장 금지 또는 encrypted column.
- **Depends on:** T-001 (자산 시계열 인프라 일부)

### T-007. 개인 고객 전용 ID billing 재디자인 (선택)

- **What:** 프로덕션 `/tax/billing`은 법인 중심. 개인 신고 후 ID billing 발행 흐름의 개인용 간소화 버전 검토.
- **Why:** 프로토타입의 ID billing UX가 법인보다 단순 — 한 번에 한 신고만 처리. 유지보수 관점에서 두 개 유지할 가치가 있는지 판단 필요.
- **Pros:** 개인 고객 UX 더 단순.
- **Cons:** 두 flow 유지 비용. 기존 `/tax/billing`에 `customer_type` 분기 추가로 커버 가능할 수도.
- **Context:** PR3 후반에 재평가. 처음엔 기존 화면 재사용, UX 불만 쌓이면 분리.
- **Depends on:** 개인 고객 실제 사용 데이터 (피드백)

### T-009. Privy/VIDA PSrE 전자서명 연동 (법적 완전성)

- **What:** 현재 canvas + audit metadata(hash/timestamp/IP/UA) 조합은 MVP 수준. Kominfo 인증 PSrE(Privy, VIDA, BSrE) API 연동으로 법적으로 완전한 전자서명 대체.
- **Why:** UU ITE 11/2008 + PP 71/2019 기준으로 canvas PNG는 "전자서명"이 아님. 위임장 분쟁 시 JTC 방어력 약함. Privy 연동으로 법적 리스크 완전 제거.
- **Pros:** 법원 인정 수준의 서명 유효성, enterprise 고객 신뢰도.
- **Cons:** Privy API 구독료 + 서명 건당 요금. 연동 개발 +1~2주. 유저 UX 추가 단계 (Privy 리다이렉트 또는 embed).
- **Context:** 현재 signature_audit 테이블 구조는 PSrE 교체를 염두에 두고 설계. `signature_url` → Privy transaction_id로 치환, `purpose` 필드로 flow 구분. 고객 서명 볼륨이 월 100건 넘어가면 도입 검토.
- **Depends on:** PR1 완료 (signature_audit 테이블 먼저 존재)

### T-010. INDIVIDUAL 고객 전용 OCR 프롬프트 검증

- **What:** 현재 `DocumentOCRUploader` + `/api/documents/ocr-extract`는 COMPANY 월신고 bukti potong 컨텍스트에 tune됨. INDIVIDUAL 프로필 자동채움(KK, A1 1721-A1)에 맞는 프롬프트/응답 스키마 별도 검증 필요.
- **Why:** PR2 스코프에서 "기존 OCR 재사용" 가정했지만 outside voice가 지적 — 실제로는 프롬프트/필드 매핑이 COMPANY 지향. KK는 가족관계증명, A1은 개인 원천징수영수증으로 문서 종류가 다름.
- **Pros:** 정확도 확인 후 필요시 별도 프롬프트 가지면 정확도 ↑.
- **Cons:** PR2 스코프에 예상보다 1~2일 추가. 프롬프트 관리 부담.
- **Context:** 먼저 현행 OCR에 KK/A1 샘플 5~10장 넣어 정확도 측정. 80% 이상이면 그대로 사용, 미만이면 INDIVIDUAL-specific prompt template 추가.
- **Depends on:** PR1 완료 (PR2 시작 시점)

### T-008. 개인 고객 세금 보고서 페이지 (선택)

- **What:** 프로덕션 `/reports`가 개인 고객 5년 신고 이력을 보여주는지 확인, 미흡하면 개인용 전용 뷰 추가.
- **Why:** 프로토타입의 "세금 보고서" 메뉴 대응. 고객이 과거 신고 내역 자가 조회.
- **Pros:** 컨설턴트 문의 감소.
- **Cons:** 기존 `/reports`와 중복 가능성.
- **Context:** 먼저 `/reports`를 개인 고객 계정으로 테스트. 충분하면 T-008 불필요.
- **Depends on:** 없음 (단, 개인 고객 `/reports` 검증 선행)
