# PPh23 Wholesale + Invoice Photo Attach

- **Date**: 2026-06-03
- **Status**: Approved (Q1+Q2 = a+a)
- **Builds on**: PPh23 Phase 4 (commit `34c5029`) — manual entry mandatory image. wholesale 흐름은 photo 없이 import (Phase 4 out of scope).

## 1. Context

PPh23 wholesale xlsx import 후 표에서 각 row 의 invoice evidence 첨부 가능. manual entry 의 mandatory 와 달리 wholesale 은 optional (bulk import 빠른 흐름 우선, 사진 후속 보강).

## 2. Decisions
| # | 결정 | 선택 |
|---|---|---|
| Q1 | 첨부 방식 | **(a) post-import 행별 📷 attach button** |
| Q2 | mandatory 수준 | **(a) optional** + 사진 없는 row 에 amber warning |

## 3. Schema

신규 마이그레이션 `supabase/migrations/20260603000012_pph23_invoice_document_link.sql`:

```sql
ALTER TABLE pph23_transaction
  ADD COLUMN IF NOT EXISTS invoice_document_id UUID REFERENCES document(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pph23_invoice_document
  ON pph23_transaction(invoice_document_id)
  WHERE invoice_document_id IS NOT NULL;
```

마이그레이션 1 (1 컬럼 + 1 인덱스).

## 4. Endpoints

### 4.1 신규: `POST /api/tax/pph23-transactions/[id]/invoice-photo`

multipart/form-data: `file` (image/* or pdf)

처리:
1. transaction 존재 확인 (customer 권한 검증)
2. `POST /api/documents/upload` 내부 로직 재사용 — `documentType='INVOICE'`, `customerId`, `taxPeriod`
3. document.id 받음
4. `UPDATE pph23_transaction SET invoice_document_id = $1 WHERE id = $2`
5. Response: `{ data: { documentId, publicUrl? } }`

middleware: `composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(CUSTOMER, CONSULTANT_JTC, TAX_ADVISOR_JTC), withAudit('PPH23_INVOICE_ATTACH'))`

### 4.2 변경: 기존 manual entry (`34c5029` 의 invoice image upload)

현재 implicit link (customer + period + type) 만. 신규 endpoint 로 migrate — 정확한 explicit link.

`handleAddTransaction` 의 image upload 부분:
- 기존: POST `/api/documents/upload` 후 toast
- 신규: POST `/api/tax/pph23-transactions/[id]/invoice-photo` — server 가 link 자동 update

### 4.3 변경: GET `/api/tax/pph23-transactions`

response 에 `invoice_document_id` 포함 + `has_invoice` boolean 또는 nested document URL.

## 5. UI

### 5.1 PPh23 transaction 표
컬럼 추가: "사진" (좁은 — icon만):

```tsx
// Phase 3.2 의 inline edit pattern 참고
<td className="text-center">
  {tx.invoice_document_id ? (
    <span className="inline-flex items-center text-green-600" title={t('invoiceAttached')}>
      <CheckCircle className="h-4 w-4" />
    </span>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openPhotoAttach(tx.id); }}
      className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 text-[11px]"
      title={t('invoiceMissing')}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <Camera className="h-3.5 w-3.5" />
    </button>
  )}
</td>
```

### 5.2 Photo attach 흐름
`openPhotoAttach(transactionId)` 가:
1. hidden file input 클릭 (또는 camera capture)
2. file 선택 → POST `/api/tax/pph23-transactions/[id]/invoice-photo` (multipart)
3. 성공 → row state 의 `invoice_document_id` 업데이트 + ✓ flash (Phase 3.2 패턴)
4. 실패 → error toast

두 input (카메라 / 파일 선택) — manual entry 와 동일 패턴. modal 또는 inline pill.

가장 단순 v1: dropdown action menu:
```tsx
<details className="inline-block">
  <summary><Camera className="h-3.5 w-3.5" /></summary>
  <div className="absolute z-10 bg-white border rounded shadow p-2">
    <button onClick={() => triggerCamera(tx.id)}>📷 사진 촬영</button>
    <button onClick={() => triggerFile(tx.id)}>📄 파일 선택</button>
  </div>
</details>
```

또는 더 단순 → modal: `<Dialog>` open per row.

**선택**: dropdown — 작고 깔끔, 모달 부담 없음.

## 6. i18n (~5 키 × 5 locale)

- `colInvoicePhoto`: "사진" (column header)
- `invoiceAttached`: "사진 첨부됨"
- `invoiceMissing`: "사진 없음 (클릭하여 첨부)"
- `invoiceUploadSuccess`: "사진 첨부 완료"
- `invoiceUploadFailed`: "사진 첨부 실패"

## 7. Smoke

기존 `validate-pph23-e2e.ts` 변경 0 (wholesale 흐름은 photo 없이도 작동). 신규 contract test:

`scripts/verify-pph23-invoice-photo.ts` — 5 assertion:
1. customer (company.test) login + setup transaction via PUT/admin direct (PPh23 POST schema 회피)
2. POST `/api/tax/pph23-transactions/[id]/invoice-photo` with multipart → 200 + documentId
3. GET transaction → `invoice_document_id` populated
4. document table 에 row 확인 (`documentType='INVOICE'`, customerId 일치)
5. cleanup (transaction + document delete)

smoke runner 통합 — 22→23.

## 8. Files

**신규** (3):
- `supabase/migrations/20260603000012_pph23_invoice_document_link.sql`
- `src/app/api/tax/pph23-transactions/[id]/invoice-photo/route.ts`
- `scripts/verify-pph23-invoice-photo.ts`

**수정** (5):
- `src/app/api/tax/pph23-transactions/route.ts` — GET 에 invoice_document_id 추가
- `src/app/[locale]/(dashboard)/tax/pph23/page.tsx` — 표 컬럼 + dropdown + handler
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 5 키 × 5 locale
- `scripts/test-smoke-all.ts` — STEPS +1
- (선택) manual entry 의 image upload 코드도 신규 endpoint 사용으로 migrate

**마이그레이션**: 1 (1 컬럼 + 1 인덱스)

## 9. Out of scope (Phase 5+)

- 자동 OCR (사진 첨부 시 invoice no/amount 추출 → transaction 자동 채움)
- 사진 thumbnail preview in 표
- 사진 zoom view modal
- batch zip attach (Q1 의 (b) 옵션)
- mandatory configurable per-customer (Q2 의 (c) 옵션)

## 10. Risks

- **기존 manual entry 흐름 호환성**: Phase 4 의 implicit link 코드가 신규 endpoint 로 migrate 안 되면 두 흐름 공존 (implicit + explicit). v1 은 wholesale rows 만 explicit, manual entry 는 그대로 두고 followup 으로 migrate 검토.
- **document 권한**: `/api/documents/upload` 가 CUSTOMER + CONSULTANT 허용. 신규 endpoint 도 동일. 권한 leak 없음.
- **공유 사진 (한 invoice 가 여러 transaction)**: 현재 spec 은 1:1 (FK ON DELETE SET NULL). 1:N 필요하면 별도 junction 테이블 — Phase 5.
- **사진 사이즈**: 1-5MB 이미지. /api/documents/upload 가 이미 제한 처리.
- **prod schema drift audit**: 신규 컬럼 + 인덱스 — drift CI guard 가 detect. PASS expected.
