# 3 페이지 upload UX 통일 (Template 만)

- **Date**: 2026-06-01
- **Status**: Approved (Q1+Q2+Q3 = a+a+a)
- **Pages**: PPh21 / PPh23 / PPN
- **Builds on**: PPh23 + PPN wholesale importer 자산 그대로

## 1. Context

현재 3 페이지가 4-5종의 업로드 모드를 노출 (camera OCR / 단건 file upload / 템플릿 다운로드 / xlsx 업로드 / manual form). 사용자는 "어떤 모드가 어떻게 다른지" 혼란. 특히:
- PPh21: 고객이 직접 작성한 파일 vs 템플릿 파일 구분 안 됨 → 필드 매핑 UI 가 매번 뜸
- PPh23: 인보이스 OCR 이 자동 추출하지만 검증 어려움
- PPN: faktur OCR + wholesale + manual 3종 동시 존재

방향성: 각 페이지가 **"템플릿 다운로드 + 템플릿 작성 xlsx 업로드"** 로 단순화. PPh23 의 manual 입력은 유지하되 **인보이스 사진 첨부 필수**.

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | PPh21 manual form (직원 master) | **(a)** 유지 — HR 등록은 별개 기능. upload modes 만 정리 |
| Q2 | PPh23 manual 의 인보이스 촬영 | **(a)** form 안에 mandatory image upload field — submit 막힘 if no image |
| Q3 | PPN single-entry form | **(a)** 제거 — wholesale 전용 |

## 3. Per-page changes

### 3.1 PPh21 (`src/app/[locale]/(dashboard)/tax/pph21/page.tsx`)

**제거**:
- 카메라 캡처 버튼 (line 1114-1118) + `handleUpload(..., 'CAMERA', 'SALARY_SLIP', ...)` 분기
- 단건 file upload 버튼 (line 1110-1112) + `handleUpload(..., 'WEB', 'SALARY_SLIP')` 분기
- `/api/documents/{id}/ocr` 호출 (line 808) + OCR 결과 polling
- "Uploaded docs list" 표시 (line 1256-1278) — OCR 상태 cards
- 관련 state: `uploadedDocs`, `pollingDocIds` 등 OCR 추적 state
- 관련 import: 사용 안되는 lucide-react 아이콘 (Camera 등)

**유지**:
- 템플릿 다운로드 버튼 (line 1120-1121) + `downloadTemplate()` (line 831-871)
- xlsx 업로드 버튼 (line 1123-1126) + `handleExcelUpload(files)` (line 901) + `handleConfirmMapping()` (line 1008)
- 직원 master form (line 430-624) — 직원 등록용 별개 기능
- `/api/tax/employees/import` endpoint

**i18n 정리**: camera/photo-upload 관련 unused 키 (`uploadFromCamera`, `uploadDocument` 등) — 미사용으로 두거나 제거 (locale parity 위해 그대로 둬도 OK).

### 3.2 PPh23 (`src/app/[locale]/(dashboard)/tax/pph23/page.tsx`)

**제거**:
- 카메라 캡처 버튼 (line 626-635) + `handleDocUpload(..., 'CAMERA', 'INVOICE', ...)`
- 단건 file upload 버튼 (line 620-624) + `handleDocUpload(..., 'WEB', 'INVOICE')`
- OCR auto-extract → transaction cards (line 815-860) — wholesale + manual 만 사용
- `/api/documents/{id}/ocr` 호출 (line 504)

**유지**:
- 템플릿 다운로드 (line 641-674, inline)
- xlsx 업로드 (line 682-691, `handleCsvImport(file)` → `/api/tax/pph23-transactions/import`)
- Manual transaction form (line 899+, `handleAddTransaction()`)
- `/api/tax/pph23-transactions` POST endpoint

**추가 (Q2 핵심)**: Manual form 에 인보이스 사진 mandatory field
- form 위쪽에 새 section: 인보이스 사진 (필수)
- `<input type="file" accept="image/*">` + 미리보기 thumbnail
- state: `invoiceImageFile: File | null`
- validation: `handleAddTransaction` 시 `if (!invoiceImageFile) → showMsg('error', t('invoiceImageRequired')) + return`
- 업로드 흐름:
  1. transaction insert 먼저 (`/api/tax/pph23-transactions` POST → returns `transactionId`)
  2. 성공 시 image 를 `/api/documents/upload` 로 POST (form-data: `file=invoiceImageFile`, `taxId=transactionId`, `taxType='PPH23'`)
  3. document table 에 row 생성 + `entity_id=transactionId`, `entity_type='pph23_transaction'`
  4. UI 에는 transaction 카드 옆에 image link/thumbnail 표시
- **방어**: image 업로드 실패해도 transaction 은 삭제 안 함 (사용자가 나중에 재첨부 가능). 단 UI 에 warning 표시.

### 3.3 PPN (`src/app/[locale]/(dashboard)/tax/ppn/page.tsx`)

**제거**:
- 카메라 캡처 버튼 (line 513-520) + `handleFakturUpload(..., 'CAMERA', ...)`
- 단건 file upload 버튼 (line 507-511) + `handleFakturUpload(..., 'WEB')`
- OCR 호출 (line 206)
- Manual faktur form (line 604-650+) + `handleFakturSave()` 호출 (UI 만)
- Manual form 관련 state (`showForm`, `formData`, etc.) — UI 만 정리
- "Add Faktur" 버튼이 manual form 여는 흐름 → wholesale 업로드로 redirect

**유지**:
- 템플릿 다운로드 (line 532-533, `downloadPpnTemplate()`)
- Wholesale xlsx 업로드 (line 522-530, `handleWholesaleUpload(file)` → `/api/tax/ppn-bulk-import`)
- `/api/tax/ppn-faktur-monthly` POST endpoint **자체는 유지** (다른 곳에서 호출 가능성 — 안전한 default). UI 호출만 제거.
- 기존 dashboard / faktur list table (Phase 3.1 의 `dpp_nilai_lain` column 포함)

## 4. New asset: invoice image upload for PPh23

### 4.1 Storage 결정

기존 `document` 테이블 + `/api/documents/upload` endpoint 재사용. 신규 마이그레이션 0.

PPh23 transaction 과 link:
- document table 의 컬럼 `entity_id (uuid) + entity_type (text)` 존재 가정 (확인 필요)
- 또는 `pph23_transaction.invoice_document_id (uuid) NULL` 컬럼 추가 (마이그레이션 1)

**implementer 가 STEP 1 에서 확인 후 결정**. 기존 컬럼 있으면 그대로, 없으면 추가.

### 4.2 UI 흐름

```
[Manual transaction form 열림]
  ↓
[새 섹션: 인보이스 사진 (필수)]
  - <input type="file" accept="image/*"> 또는 camera capture
  - 선택 시 미리보기 thumbnail + 파일명
  - 미선택 시 회색 placeholder + "인보이스 사진을 첨부하세요" 안내
  ↓
[기존 form fields: counterparty/service_type/amount/...]
  ↓
[Submit 버튼]
  - invoiceImageFile === null → 에러 toast "인보이스 사진을 첨부하세요"
  - 있으면: 1) transaction POST → 2) image POST → 3) 완료 toast
```

### 4.3 i18n (2-3 신규 키)
- `invoiceImageRequired`: "인보이스 사진을 첨부하세요"
- `invoiceImageLabel`: "인보이스 사진 (필수)"
- `invoiceImageUploadFailed`: "인보이스 사진 업로드 실패 — 거래는 저장됨, 사진은 다시 첨부하세요"

## 5. Files

**수정** (5+):
- `src/app/[locale]/(dashboard)/tax/pph21/page.tsx` — camera + 단건 upload 제거
- `src/app/[locale]/(dashboard)/tax/pph23/page.tsx` — camera + 단건 upload 제거 + manual form 에 image field 추가
- `src/app/[locale]/(dashboard)/tax/ppn/page.tsx` — camera + 단건 upload + manual form 제거
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 신규 PPh23 image 키 3개 × 5 locale

**마이그레이션 (0 또는 1)**:
- document table 에 entity_id+entity_type 있으면 0
- 없으면 `pph23_transaction.invoice_document_id uuid null` 추가 마이그레이션 1

**Endpoint 변경 0**: 기존 모두 그대로. `/api/documents/upload` 재사용.

**검증 자산 변경 0**: 기존 e2e (validate-ppn-e2e, validate-pph23-e2e, verify-ppn-single-entry-rate, validate-pph21-bintang-jaya, validate-pph23-bintang-jaya) 모두 endpoint level 회귀라 UI 변경 무관. 그대로 PASS 해야.

## 6. 검증

### 6.1 회귀
- `npm run test:smoke:prod` 17/17 그대로 PASS
- vitest bulk-import 78/78 PASS

### 6.2 수동 UI 확인
- PPh21: 페이지 로드 → 템플릿 다운로드 + xlsx 업로드 만 보임 + 직원 form 정상 (4 ↘ 2 modes)
- PPh23: 템플릿 + xlsx + manual entry (3 modes) — manual entry 의 인보이스 사진 필수 검증
- PPN: 템플릿 + xlsx 만 (2 modes), "Add Faktur" 클릭 → wholesale 안내 또는 wholesale upload 트리거

### 6.3 PPh23 manual + image upload smoke (신규 권장)
새 script `scripts/verify-pph23-manual-with-image.ts` (optional):
1. company.test 로그인
2. POST `/api/tax/pph23-transactions` (manual 입력) → transactionId 받음
3. POST `/api/documents/upload` with form-data (1KB 더미 이미지 + transactionId)
4. document table 에서 link 확인
5. cleanup

선택 사항 — 시간 절약 위해 STEP 13 으로 옵션. mandatory image field 자체는 UI 검증이 우선.

## 7. Out of scope (Phase 4+)

- PPh21 직원 등록 단건 form 제거 (현재 유지)
- PPh23 wholesale upload 시 invoice photo attach (현재는 manual entry 만 mandatory)
- PPN single-entry endpoint 자체 삭제 (deprecated 마킹은 별도 트랙)
- OCR 기능 자체 deprecate (다른 페이지에서 쓸 수도)
- 신규 invoice image gallery view
- image compression / EXIF rotate

## 8. Risks

- **PPh21 OCR 흐름 의존성**: `/api/documents/{id}/ocr` 가 다른 곳에서 호출되면 영향 X (endpoint 자체는 유지). UI 만 제거.
- **PPh23 manual + image 흐름 실패**: image upload 실패 시 transaction 은 살아있어 inconsistent. UI 에 warning + 사용자가 다시 첨부 가능하도록 transaction 카드에 "이미지 첨부" 버튼.
- **PPN manual form 제거 후 단건 입력 niche**: 한 건만 입력하고 싶은 사용자가 wholesale xlsx 만들어야 함. Q3=(a) 결정에 따라 의도된 trade-off. 추후 UI 에 "1건만 입력하시려면 템플릿에 1행만 채워서 업로드하세요" 안내 helper text.
- **unused i18n 키**: 제거된 mode 의 키들 (`uploadFromCamera`, `manualEntry` 등). 미사용으로 두면 dead weight 지만 fail X. 정리는 별도 트랙.
- **OCR document table 의 transaction link 컬럼 미존재 가능성**: STEP 1 에서 확인 후 분기. 마이그레이션 1 추가 필요할 수도.

## 9. PR 단위 / commit 전략

단일 commit (3 페이지 변경이 같은 의도, 분리 가치 낮음):
```
feat(tax-ui): upload UX 통일 — template + xlsx 만 (PPh23 는 manual+image)

- PPh21: camera + 단건 file upload 제거 → template + xlsx + 직원 form 만
- PPh23: camera + 단건 file upload 제거 → template + xlsx + manual+이미지 필수
- PPN: camera + 단건 file upload + manual form 제거 → template + wholesale 만
- PPh23 manual entry 에 invoice image mandatory upload field 추가
```
