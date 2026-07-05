# AI Pajak — 처음부터 끝까지 수동 테스트 시나리오

> **목표**: 신규 사용자가 회원가입 (또는 테스트 계정 로그인) 후 한 달 분 세무 처리를
> 끝까지 진행하는 흐름을 검증한다. 모든 단계가 매끄럽게 동작하는지 직접 확인.
>
> **예상 소요**: 15~20 분
>
> **준비물**: 미리 채워둔 양식 3종 (이 문서 끝의 다운로드 링크)

---

## 사전 준비

### 1. 데이터 초기화 (clean slate)
```bash
SEED_TARGET=prod npx tsx scripts/seed-test-customer-demo.ts --cleanup
```
두 테스트 customer 의 누적 데이터가 모두 지워집니다.

### 2. 양식 3종 다운로드
- [📥 pph21-filled.xlsx](../../public/test-data/pph21-filled.xlsx) — 직원 5명
- [📥 wht-onesheet-filled.xlsx](../../public/test-data/wht-onesheet-filled.xlsx) — WHT one-sheet 8행 (PPh23/PPh4(2)/PPh26/PPN MASUKAN)
- [📥 ppn-filled.xlsx](../../public/test-data/ppn-filled.xlsx) — VAT OUT 3 + IN 3 (PMK 131 케이스 포함)

또는 생성:
```bash
npx tsx scripts/build-test-fixtures.ts
```

### 3. 테스트 계정
| Role | Email | Password |
|---|---|---|
| CUSTOMER (COMPANY) | `company.test@example.com` | `TestPassword123!` |
| TAX_OPERATOR | `operator.test@aipajak.com` | `TestPassword123!` |
| CONSULTANT | `consultant.test@jakartatax.co.id` | `TestPassword123!` |

---

## Phase 1 — 고객(Customer) 시점 — 한 달 분 데이터 입력 + 제출 요청

### Step 1 · 로그인
1. `https://ai-pajak.vercel.app/ko` 접속
2. `company.test@example.com` / `TestPassword123!` 로 로그인
3. **기대**: 대시보드 진입, 빈 상태 (전 단계에서 cleanup 했으므로)

### Step 2 · PPh21 직원 등록
1. 사이드바에서 **PPh 21 (월급)** 클릭
2. **표준 템플릿 다운로드** 버튼 (참고용, 실제 업로드는 미리 준비한 파일 사용)
3. **xlsx 파일 업로드** 클릭 → `pph21-filled.xlsx` 선택
4. **기대**:
   - "5 imported" 토스트
   - 직원 목록에 Andi/Sari/Budi/Citra/Dimas 표시
   - 각 직원 클릭 → 자동 계산된 PPh21 (PTKP / biaya jabatan / 누진세) 확인
5. **체크포인트**: ✅ Andi (K/2) 의 연간 PPh21 ≈ Rp 13,395,000 / 월 약 Rp 1,116,250

### Step 3 · 원천세 일괄 업로드 (WHT one-sheet)
1. 사이드바 **원천세 (PPh 23)** 클릭
2. 페이지 상단에 **WHT 표준 템플릿 다운로드** 버튼 (참고)
3. **WHT one-sheet 업로드** 클릭 → `wht-onesheet-filled.xlsx` 선택
4. **기대 (emerald 결과 panel 표시)**:
   - PPh 23: **3** (Konsultan + Catering + Cleaning)
   - PPh 4(2): **2** (Office Park + Logistik Warehouse)
   - PPh 26: **1** (Global Tech Pte Ltd)
   - PPN MASUKAN: **1** (PT Vendor Material)
5. **체크포인트**: ✅ 4-카드 패널에서 각 숫자 클릭 → 해당 페이지로 이동

### Step 4 · PPh 4(2) 페이지 (별도 뷰)
1. WHT 패널의 **PPh 4(2)** 카드 클릭 → `/tax/pph42`
2. **기대**:
   - 거래 2건: PT Gedung Office Park (Rp 30M, 10%) + PT Logistik Warehouse (Rp 15M, 10%)
   - 세율 컬럼 모두 **10.0%** (purple 강조)
3. **상세 in-place 편집**:
   - 첫 행의 "상세" 버튼 클릭 → 행 아래 펼쳐짐
   - DPP 를 다른 값으로 수정 → onBlur 자동 저장 토스트
   - 동시에 운영팀 chat 으로 변경 메시지 자동 전달 (Phase 2 에서 확인)

### Step 5 · PPN 페이지
1. 사이드바 **PPN** 클릭 → `/tax/ppn`
2. **기대**:
   - KELUARAN 1건 + MASUKAN 3건 (위 WHT 업로드 외에 추가 PPN 양식 업로드 시도해보고 싶으면 `ppn-filled.xlsx` 도 업로드 가능 — 중복 분 자동 무시 또는 추가)

### Step 6 · SPT Masa 제출 요청
1. `/tax/pph23` 페이지 하단 **"운영팀에 SPT Masa 제출 요청"** 버튼 클릭
2. **기대**:
   - 토스트: "운영팀에 SPT Masa 제출 요청을 전달했습니다 — N 건"
   - 페이지 상단에 🟡 **amber 배너** 출현: "운영팀 검토 중 — 2026-06, 요청 시간: ..."
3. **체크포인트**: ✅ 페이지 새로고침 해도 🟡 배너 그대로 (옵션 B 서버 추적 동작)

---

## Phase 2 — 운영팀(Operator) 시점 — 요청 처리

### Step 7 · 로그아웃 + 운영팀 로그인
1. 우측 상단 메뉴 → **로그아웃**
2. `operator.test@aipajak.com` / `TestPassword123!` 로 재로그인

### Step 8 · 검토 대기 패널 확인
1. 사이드바 **고객 인박스** (혹은 `/operator/customer-inbox`) 진입
2. **기대 (페이지 상단)**:
   - amber 패널 "SPT Masa 검토 대기 1 건" + 가장 오래된 요청 시각
   - 카드 1개: `PT Example Indonesia` / `PPh23/2026-06` / `N분 대기 중`
3. **체크포인트**: ✅ 카드 클릭 시 좌측 thread 목록에서 해당 thread 자동 선택

### Step 9 · SPT Masa 생성
1. thread 진입 후 메시지 확인 (Step 6 에서 customer 가 보낸 📨 요청)
2. **우측 pane** 아래쪽 보라색 **"PPh23 → SPT Masa 생성"** 버튼 클릭
3. **기대**:
   - 결과 라벨 "PPh23 생성 완료 — Filing xxxxxxxx (actor: ...)"
   - thread 에 ✅ 자동 영수 메시지 추가
   - 상단 amber 패널 즉시 갱신 (이 요청 사라짐)

### Step 10 · 인라인 편집 chat 흐름 확인 (선택)
1. customer 가 Phase 1 Step 4 에서 PPh4(2) 거래를 인라인 편집했다면 이 thread 의 메시지에 ✏️ 변경 사항 표시됨

---

## Phase 3 — 고객 재진입 — 처리 완료 확인

### Step 11 · 고객 재로그인
1. 로그아웃 → `company.test@example.com` 재로그인
2. `/tax/pph23` 진입
3. **기대**:
   - 🟡 amber 배너 → 🟢 **emerald 배너** 자동 전환
   - "SPT Masa 제출 완료 — 2026-06"
4. **체크포인트**: ✅ filing 이 만들어졌으므로 localStorage 마커도 자동 정리

---

## 추가 검증 (선택)

### PPh4(2) 별도 SPT Masa
1. `/tax/pph42` 페이지에서도 동일하게 **"운영팀에 SPT Masa 제출 요청"** 클릭 가능
2. 운영팀 inbox 에 별도 검토 대기 row 표시 (taxType=PPh42)
3. 운영팀이 같은 thread 에서 **"PPh42 → SPT Masa 생성"** 버튼으로 처리 가능

### 다기기 동기화 (옵션 B)
1. Phase 1 의 🟡 배너 상태에서 다른 브라우저/시크릿 창으로 같은 계정 로그인
2. 같은 🟡 배너 동일하게 표시 (서버 추적이 source of truth)

---

## 시나리오 청산
```bash
SEED_TARGET=prod npx tsx scripts/seed-test-customer-demo.ts --cleanup
```
두 테스트 customer 의 모든 누적 데이터 제거.

---

## 결과 요약 양식 (테스트 후 작성)

| # | 단계 | 결과 (PASS/FAIL) | 메모 |
|---|---|---|---|
| 1 | 로그인 | | |
| 2 | PPh21 직원 5명 업로드 | | |
| 3 | WHT one-sheet 8행 업로드 + 4-카드 패널 | | |
| 4 | PPh4(2) 별도 페이지 + 인라인 편집 | | |
| 5 | PPN 페이지 확인 | | |
| 6 | SPT Masa 제출 요청 + 🟡 배너 | | |
| 7 | 운영팀 로그인 | | |
| 8 | 검토 대기 패널 확인 | | |
| 9 | SPT Masa 생성 (CTA) | | |
| 10 | chat 자동 메시지 | | |
| 11 | 고객 재진입 + 🟢 배너 | | |

발견된 버그 / 개선점은 GitHub issue 로 등록.
