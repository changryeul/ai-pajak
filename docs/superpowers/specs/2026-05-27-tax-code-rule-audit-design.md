# Tax Code Rule — Audit Timeline (Track C)

- **Date**: 2026-05-27
- **PDF source**: 수퍼바이저 화면 메신저 포함 20260525, p.27 §5 "기준 변경이력"
- **Track**: C (of B/C/A/D sequence; B complete in 2026-05-27)
- **Status**: Design approved, ready for implementation plan

## 1. Context

Track B 가 `tax_code_rule` 의 inline 편집을 가능하게 했지만, 페이지 §5 의 mock 3행 ("SPT OP Form Profile / PPh23 판단 / Coretax Integration") 은 정적인 안내 박스이고 실제 변경 timeline 이 아니다. 또한 T4 의 `withAudit('TAX_CODE_RULE_UPDATE')` 가 audit_log 에 행을 남기긴 하지만 **handler 실행 전** "intent" 만 기록 (`details: { method, url }`) — 무엇이 무엇으로 바뀌었는지는 audit_log 에 남지 않는다.

Track C 는 §5 를 실제 PATCH 이력 timeline 으로 교체하고, audit_log 에 PATCH 당 diff (before/after) 가 저장되도록 한다.

## 2. Decisions (confirmed in brainstorming)

| # | 결정 | 선택 | 이유 |
|---|---|---|---|
| Q1 | 저장 방식 | **(c) `withAudit` 제거 + manual `recordAudit` 1행 (full diff)** | 변경당 1행, intent-vs-result 노이즈 없음. system-reference 단일 UPDATE 라 crash-mid-write 리스크 낮음. 새 테이블 0개. |
| Q2 | activity_details 내용 | **(b) per-field diff** `{ ruleId, category, diff: { field: { before, after } } }` | 변경 사실 + before/after 모두 보존, payload 5 필드라 크지 않음. row snapshot 은 over-kill. |
| Q3 | §5 UI | **(a) mock 3행 완전 교체** | PDF mock 은 spec snapshot, 진짜 audit log 와 정확히 일치하는 의도. 두 source 병존은 혼동. |

명시적으로 빠진 것:
- 신규 테이블 `tax_code_rule_audit_log` (audit_log 재활용으로 미필요)
- before-image 의 row snapshot (changed-fields diff 면 충분)
- `withAudit` 의 intent-on-crash 보존 (Track A 의 page-access gate 와 함께 재검토 가능)
- 별도 changelog/announcements 메뉴 (mock 3행의 "변경 공지" 의도 — 필요해지면 별도 트랙)

## 3. Schema — 신규 마이그레이션 0개

기존 `audit_log` 테이블 그대로 재활용. activity_type enum value `TAX_CODE_RULE_UPDATE` 는 Track B nits (마이그레이션 `20260527000002`) 에서 이미 추가됨.

`activity_details` shape (PATCH 1회당 1행):
```jsonc
{
  "ruleId":   "<uuid of tax_code_rule>",
  "category": "PPh21",
  "diff": {
    "review_note": { "before": "이전 문구", "after": "새 문구" },
    "rate_rule":   { "before": "...",     "after": "..." }
  }
}
```

`activity_details` JSONB 라 추가 스키마 변경 없음. 빈 diff (no-op) 는 audit row 생성하지 않음.

## 4. API

### 4.1 Modify `PATCH /api/admin/tax-code-rule/[id]`

`src/app/api/admin/tax-code-rule/[id]/route.ts`:

미들웨어 체인에서 **`withAudit('TAX_CODE_RULE_UPDATE')` 제거**:
```ts
return composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.TAX_OPERATOR_MASTER),
  // withAudit 제거 — 핸들러가 직접 diff 와 함께 recordAudit 호출
)(request as RequestWithSession, handlePatch);
```

핸들러 내부에서 SELECT before → UPDATE → diff 계산 → `recordAudit` (custom-pricing endpoint 가 쓰는 패턴):

```ts
// 1. before
const { data: before, error: selErr } = await admin
  .from('tax_code_rule').select('*').eq('id', id).single();
if (selErr) {
  if (selErr.code === 'PGRST116') return 404;
  return 500 + pino log;
}

// 2. update
const { data: after, error: updErr } = await admin
  .from('tax_code_rule')
  .update({ ...parsed.data, updated_by: req.session.userId, updated_at: now })
  .eq('id', id).select('*').single();
if (updErr) return 500 + pino log;

// 3. diff (변경된 필드만)
const PATCHABLE = ['tax_code', 'rate_rule', 'condition_text', 'doc_required', 'review_note'] as const;
const diff: Record<string, { before: string; after: string }> = {};
for (const k of PATCHABLE) {
  if (parsed.data[k] !== undefined && (before as TaxCodeRule)[k] !== (after as TaxCodeRule)[k]) {
    diff[k] = { before: (before as TaxCodeRule)[k], after: (after as TaxCodeRule)[k] };
  }
}

// 4. recordAudit (no-op PATCH 은 skip)
if (Object.keys(diff).length > 0) {
  await recordAudit({
    action: 'TAX_CODE_RULE_UPDATE',
    actorUserId: req.session.userId,
    actorRole: req.session.role,
    details: { ruleId: id, category: (after as TaxCodeRule).category, diff },
    ipAddress: req.headers.get('x-forwarded-for') ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  });
}
```

응답 shape 변경 없음 (`{ data: TaxCodeRule }`).

### 4.2 New `GET /api/admin/tax-code-rule/audit-log`

`src/app/api/admin/tax-code-rule/audit-log/route.ts`:

- 미들웨어: `composeMiddleware(requireAuth, blockPlatformAdmin)` (read-only, all auth roles).
- Query: `?limit=` (1~50, default 10).
- 구현:
  ```ts
  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from('audit_log')
    .select('id, actor_user_id, actor_role, activity_details, created_at')
    .eq('activity_type', 'TAX_CODE_RULE_UPDATE')
    .order('created_at', { ascending: false })
    .limit(limit);

  // actor email join — getUserById per unique actor (parallel)
  // Confirmed elsewhere in repo (src/app/api/auth/signup/route.ts:72).
  // For 10-row log with 1-2 MASTER actors this is 1-2 calls — trivial.
  const userIds = [...new Set(rows.map(r => r.actor_user_id))];
  const emailById = Object.fromEntries(
    await Promise.all(
      userIds.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        return [id, data.user?.email ?? null] as const;
      }),
    ),
  );
  ```
- 응답 shape:
  ```jsonc
  { "data": [
    {
      "id": "<audit row uuid>",
      "ruleId": "<tax_code_rule uuid>",
      "category": "PPh21",
      "actorRole": "TAX_OPERATOR_MASTER",
      "actorUserId": "...",
      "actorEmail": "master.test@aipajak.com",
      "createdAt": "2026-05-27T14:23:00Z",
      "diff": { "review_note": { "before": "...", "after": "..." } }
    }
  ] }
  ```
- 빈 결과: `{ data: [] }`.
- `Cache-Control: no-store`.

대안 actor lookup (간단): audit_log row 에 `actor_user_id` 만 노출하고 client 가 알아서 표시. 첫 cut 은 email join 으로 시작.

## 5. UI

### 5.1 `page.tsx` 변경

`AUDIT_ROWS` 상수 + 정적 §5 렌더 삭제. 같은 server component 에서 audit-log fetch:

```ts
const { data: rulesRaw } = await supabase.from('tax_code_rule').select('*').order('sort_order');
const rules = (rulesRaw ?? []) as TaxCodeRule[];

// NEW: audit timeline
const { data: auditRows } = await admin
  .from('audit_log')
  .select('id, actor_user_id, actor_role, activity_details, created_at')
  .eq('activity_type', 'TAX_CODE_RULE_UPDATE')
  .order('created_at', { ascending: false })
  .limit(10);
// actor email join — getUserById per unique actor (parallel)
const userIds = [...new Set((auditRows ?? []).map(r => r.actor_user_id))];
const emailById = Object.fromEntries(
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return [id, data.user?.email ?? null] as const;
    }),
  ),
);

const initialAuditRows: AuditRowDTO[] = (auditRows ?? []).map(r => ({
  id: r.id,
  ruleId: r.activity_details.ruleId,
  category: r.activity_details.category,
  actorRole: r.actor_role,
  actorUserId: r.actor_user_id,
  actorEmail: emailById[r.actor_user_id] ?? null,
  createdAt: r.created_at,
  diff: r.activity_details.diff,
}));
```

§5 섹션의 정적 `<ul>` 을 `<TaxCodeRuleAuditTimeline initialRows={initialAuditRows} />` 으로 교체.

### 5.2 `_components/TaxCodeRuleAuditTimeline.tsx` (신규)

Client component (`'use client'`), 상태:
- `expandedId: string | null` — 펼친 행 (한 번에 하나).

Props: `{ initialRows: AuditRowDTO[] }`.

행 렌더링:
```
[ PPh21 pill ]  변경 필드: review_note, rate_rule        2026-05-27 14:23 · master.test@aipajak.com  [applied]  [▼]

  (expanded:)
  ┌─ review_note ─────────────────────────────────────────┐
  │ Before:   직원구분/비과세/공제항목 확인               │
  │ After:    직원구분/비과세/공제항목 + 추가 검토 확인   │
  └────────────────────────────────────────────────────────┘
  ┌─ rate_rule ───────────────────────────────────────────┐
  │ Before:   ...                                         │
  │ After:    ...                                         │
  └────────────────────────────────────────────────────────┘
```

빈 상태 (`initialRows.length === 0`):
```
[ 빈 상태 안내: "아직 편집 이력이 없습니다." ]
```

### 5.3 색상 / 디자인

- category pill: Track B 의 카테고리 색상 (slate) 재활용
- state pill: 항상 emerald "applied"
- before 셀: `bg-rose-50 text-rose-700`
- after 셀: `bg-emerald-50 text-emerald-700`
- expand toggle: `▼` (collapsed) / `▲` (expanded), small ghost button

## 6. i18n (5 locale, 6 신규 키)

`operatorSettings.audit.*` 에 추가:

| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `empty` | "아직 편집 이력이 없습니다." | "No edit history yet." | "Belum ada riwayat edit." | "編集履歴がありません。" | "暂无编辑历史。" |
| `changedFields` | "변경 필드" | "Changed fields" | "Bidang yang diubah" | "変更フィールド" | "更改字段" |
| `expandToggle` | "자세히" | "Details" | "Detail" | "詳細" | "详情" |
| `collapseToggle` | "접기" | "Collapse" | "Tutup" | "閉じる" | "收起" |
| `colBefore` | "이전" | "Before" | "Sebelum" | "変更前" | "之前" |
| `colAfter` | "변경 후" | "After" | "Setelah" | "変更後" | "之后" |

기존 키 중 mock 용 (`stateApplied`, `stateReviewing`, `sampleByTaxAdmin`, `sampleBySystem`) 은 `stateApplied` 만 유지하고 나머지 3개 삭제 (mock UI 도 함께 사라짐).

## 7. Regression

`scripts/test-tax-code-rule.ts` 에 3 assertion 추가 (기존 12 → 15):

13. **MASTER GET /audit-log → 200, data 는 배열** (빈 배열도 PASS — 이전 PATCH 가 시드 안된 환경 대비).
14. **PATCH 직후 audit-log 의 첫 행 = 방금 변경**: ruleId === pph21.id, category === 'PPh21', diff.review_note.before === originalReviewNote, diff.review_note.after === TEMP.
15. **PLATFORM_ADMIN GET /audit-log → 403**.

`test-smoke-all.ts` 의 step 이름은 그대로 (Track C 가 동일 endpoint family 확장이라).

## 8. Files

신규:
- `src/app/api/admin/tax-code-rule/audit-log/route.ts` — GET endpoint
- `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRuleAuditTimeline.tsx` — client component

수정:
- `src/app/api/admin/tax-code-rule/[id]/route.ts` — withAudit 제거 + SELECT before + manual recordAudit
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — §5 replace + AUDIT_ROWS 삭제
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — `operatorSettings.audit.*` 6 신규 키 + 3 mock 키 삭제
- `scripts/test-tax-code-rule.ts` — 3 assertion 추가 (12 → 15)

마이그레이션 신규: **0개**.

## 9. Out of scope (Track A/D)

- 페이지 자체 접근 게이트 (Track A) — Coretax 토글 → DB-driven (Track D)
- 변경 announcements/changelog 메뉴 (mock 3행의 "공지" 의도) — 별도 트랙으로 분리
- audit_log 의 retention/소프트 삭제 정책
- 다국어 diff 표시 (현재 ko 컬럼만이라 영향 없음)

## 10. Risks / open questions

- **`withAudit` 제거 → handler 크래시 시 audit 누락**: PATCH 가 SELECT 와 UPDATE 사이에 크래시하면 audit 안 남음. system-reference 단일 UPDATE 환경 + admin one-row-at-a-time UI 라 실제 위험 낮음. 필요해지면 추후 manual `recordAudit('TAX_CODE_RULE_UPDATE_INTENT')` 를 사전에 한번 더 호출하는 방식으로 보강 가능.
- **Actor email join 방법**: `admin.auth.admin.getUserById(id)` 를 unique actor 마다 parallel 호출. signup/route.ts 가 이미 쓰는 패턴, 10-row log 면 보통 1-2 콜이라 성능 무관. listUsers 는 전체 pagination 부담이라 회피.
- **audit_log 행에 leftover `__SMOKE_` 가 남아 있을 수 있음** (이전 smoke 의 revert 직전 행). UI 는 그대로 표시 — 운영 상 무해.
- **race condition between SELECT before and UPDATE**: admin UI 가 한 번에 한 행만 편집하고 PATCH 가 빠른 단일 statement 라 실제 발생 가능성 미미. 정확성이 필요해지면 추후 PostgreSQL `WITH` CTE 또는 RPC 로 single-statement 화.
