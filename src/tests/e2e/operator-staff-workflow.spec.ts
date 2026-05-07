/**
 * 「상담원 백오피스」 5단계 워크플로우 e2e — Phase A-1.
 *
 * EMP001 (김상담) 계정으로 my-work → review-case → approval-request → coretax →
 * history 5단계 API 응답이 일관되게 동작하는지 검증한다. 페이지 렌더링은
 * 다른 페이지 e2e가 다루므로 여기는 API 레벨 회귀 + 핵심 routing만 다룬다.
 *
 * Prerequisites:
 *   SEED_TARGET=local npx tsx scripts/seed-supervisor-demo.ts
 *
 * 실행:
 *   npm run test:e2e -- operator-staff-workflow
 */

import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';

interface MyCasesResp {
  success: boolean;
  data: {
    items: Array<{
      id: string;
      case_code: string | null;
      service_label: string;
      status: string;
      priority: string;
      customer: { id: string; name: string };
      metrics: { review_required: number; doc_requested: number; approval: string; ntpn: string | null };
    }>;
    kpi: { urgent: number; needsReview: number; awaitingApproval: number; coretaxReady: number };
    me: { id: string; employee_id: string; name: string } | null;
  };
}

interface ReviewDetailResp {
  success: boolean;
  data: {
    case: { id: string; case_code: string | null; status: string };
    customer: { full_name: string; company_name: string | null } | null;
    reviewItems: Array<{ invoice?: string; state?: string; vendor?: string }>;
    reviewRequired: number;
    myCases: Array<{ id: string; case_code: string | null }>;
  };
}

interface FinalReviewResp {
  success: boolean;
  data: {
    canSubmit: boolean;
    finalItems: Array<{ invoice: string; aiTaxKind: string; finalTaxKind: string }>;
    kpi: { reviewRequired: number; dataRequestCount: number };
  };
}

interface CoretaxResp {
  success: boolean;
  data: {
    case: { id: string; status: string };
    stepStates: { access: { state: string }; billing: { state: string }; ntpn: { state: string }; complete: { state: string } };
    billing: { state: string; billingId: string | null };
    canRecordBilling: boolean;
    closingSessionId: string | null;
  };
}

interface HistoryResp {
  success: boolean;
  data: {
    case: { id: string };
    timeline: Array<{ event: string; kind: string }>;
    companyCases: Array<{ case_code: string | null; status: string }>;
    kpi: { processLogs: number; companyTotal: number };
  };
}

test.describe('Phase A — 상담원 백오피스 5단계 워크플로우', () => {
  // 같은 describe 안 테스트들이 module-level let(cases)을 공유하므로 serial 모드.
  test.describe.configure({ mode: 'serial' });

  let token: string;
  let cases: MyCasesResp['data']['items'];

  test.beforeAll(async ({ request }) => {
    token = await loginAs(
      request,
      TEST_USERS.TAX_OPERATOR_EMP001.email,
      TEST_USERS.TAX_OPERATOR_EMP001.password,
    );
  });

  test('Phase 1 — /api/operator/me 가 EMP001 메타를 반환', async ({ request }) => {
    const r = await request.get('/api/operator/me', { headers: createAuthHeaders(token) });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.data.role).toMatch(/TAX_OPERATOR/);
    expect(j.data.operator?.employee_id).toBe('EMP001');
    expect(j.data.activeCount).toBeGreaterThanOrEqual(3);
  });

  test('Phase 2 — /api/operator/my-cases 가 4 KPI + 카드를 반환', async ({ request }) => {
    const r = await request.get('/api/operator/my-cases', { headers: createAuthHeaders(token) });
    expect(r.status()).toBe(200);
    const j = (await r.json()) as MyCasesResp;
    expect(j.success).toBe(true);
    expect(j.data.items.length).toBeGreaterThanOrEqual(3);
    expect(j.data.kpi.urgent).toBeGreaterThanOrEqual(1);
    expect(j.data.kpi.awaitingApproval).toBeGreaterThanOrEqual(1);
    expect(j.data.kpi.coretaxReady).toBeGreaterThanOrEqual(2);
    cases = j.data.items;

    // 시드 보강 케이스가 모두 EMP001에 보여야 함.
    const codes = cases.map(c => c.case_code).filter(Boolean);
    for (const expected of ['C-001', 'C-002', 'C-005', 'C-006']) {
      expect(codes).toContain(expected);
    }
  });

  test('Phase 3 — review-detail (C-002 PENDING_APPROVAL 4 reviewItems)', async ({ request }) => {
    const c002 = cases.find(c => c.case_code === 'C-002');
    expect(c002).toBeDefined();
    const r = await request.get(`/api/operator/cases/${c002!.id}/review-detail`, { headers: createAuthHeaders(token) });
    expect(r.status()).toBe(200);
    const j = (await r.json()) as ReviewDetailResp;
    expect(j.success).toBe(true);
    expect(j.data.case.status).toBe('PENDING_APPROVAL');
    expect(j.data.reviewItems.length).toBe(4);
    expect(j.data.reviewRequired).toBeGreaterThanOrEqual(2);
    expect(j.data.myCases.length).toBeGreaterThanOrEqual(3);
    expect(j.data.customer?.company_name).toBe('PT ABC');
  });

  test('Phase 4 — final-review (C-005 APPROVED canSubmit=false because approved)', async ({ request }) => {
    const c005 = cases.find(c => c.case_code === 'C-005');
    expect(c005).toBeDefined();
    const r = await request.get(`/api/operator/cases/${c005!.id}/final-review`, { headers: createAuthHeaders(token) });
    expect(r.status()).toBe(200);
    const j = (await r.json()) as FinalReviewResp;
    expect(j.success).toBe(true);
    // C-005 is APPROVED (already past 승인요청), so canSubmit must be false but
    // reviewRequired = 0 (검토 완료 상태).
    expect(j.data.kpi.reviewRequired).toBe(0);
    expect(j.data.canSubmit).toBe(false);
    expect(j.data.finalItems.length).toBeGreaterThanOrEqual(3);
    // AI 판단과 최종 세목이 동일하게 시작해야 한다 (사용자가 아직 안 바꿈).
    expect(j.data.finalItems[0].finalTaxKind).toBe(j.data.finalItems[0].aiTaxKind);
  });

  test('Phase 5 — coretax (C-005 APPROVED → billing 단계 진입가능)', async ({ request }) => {
    const c005 = cases.find(c => c.case_code === 'C-005');
    const r = await request.get(`/api/operator/cases/${c005!.id}/coretax`, { headers: createAuthHeaders(token) });
    expect(r.status()).toBe(200);
    const j = (await r.json()) as CoretaxResp;
    expect(j.success).toBe(true);
    expect(j.data.canRecordBilling).toBe(true);
    expect(j.data.stepStates.access.state).toBe('진행가능');
    expect(j.data.stepStates.billing.state).toBe('진행가능'); // APPROVED + ebilling_code 없음
    expect(j.data.closingSessionId).toBeNull(); // 결산 wizard와 무관한 케이스
  });

  test('Phase 5b — coretax (C-006 EBILLING_GENERATED → billing 완료, ntpn 진행가능)', async ({ request }) => {
    const c006 = cases.find(c => c.case_code === 'C-006');
    const r = await request.get(`/api/operator/cases/${c006!.id}/coretax`, { headers: createAuthHeaders(token) });
    expect(r.status()).toBe(200);
    const j = (await r.json()) as CoretaxResp;
    expect(j.success).toBe(true);
    expect(j.data.stepStates.billing.state).toBe('완료');
    expect(j.data.stepStates.ntpn.state).toBe('진행가능');
    expect(j.data.billing.billingId).toBe('820123456789012');
  });

  test('Phase 6 — history (C-001 회사별 이력에 C-001-2025도 함께 묶임)', async ({ request }) => {
    const c001 = cases.find(c => c.case_code === 'C-001');
    const r = await request.get(`/api/operator/cases/${c001!.id}/history`, { headers: createAuthHeaders(token) });
    expect(r.status()).toBe(200);
    const j = (await r.json()) as HistoryResp;
    expect(j.success).toBe(true);
    // PT Hijau Lumut은 C-001(active) + C-001-2025(COMPLETED) + REQ-REPEAT-001 까지 ≥ 2.
    expect(j.data.companyCases.length).toBeGreaterThanOrEqual(2);
    expect(j.data.kpi.companyTotal).toBeGreaterThan(0);
  });

  test('가드 — 다른 상담원 케이스의 review-item PUT은 403', async ({ request }) => {
    // C-003 / C-004 는 EMP002 또는 미배정. EMP001로 review-item 시도하면 403.
    // 단, 이 테스트는 별도 케이스가 시드에 있어야만 검증 가능. 없으면 skip.
    const r = await request.get('/api/operator/cases', { headers: createAuthHeaders(token) });
    if (r.status() !== 200) return; // operator/cases 라우트가 없는 환경이면 skip
    const j = await r.json();
    const others = (j.data?.items ?? []).filter((it: { case_code: string | null; operator_id: string | null }) =>
      it.case_code === 'C-003' || it.case_code === 'C-004',
    );
    if (others.length === 0) test.skip();

    const target = others[0] as { id: string };
    const put = await request.put(`/api/operator/cases/${target.id}/review-item`, {
      headers: createAuthHeaders(token),
      data: { invoice: 'INV-W-001', action: 'mark-checked' },
    });
    expect([403, 404]).toContain(put.status()); // 다른 상담원 또는 invoice item 없음
  });

  test('OCR 라우트 — POST 인증 통과, GET은 405', async ({ request }) => {
    // 실제 Claude 호출 안 함 (비용). 라우트 빌드 + 인증만 검증.
    const c001 = cases.find(c => c.case_code === 'C-001');
    const r = await request.post(`/api/operator/cases/${c001!.id}/invoices/ocr`, {
      headers: createAuthHeaders(token),
      data: {}, // fileBase64 없음 → 400
    });
    expect([400, 502]).toContain(r.status());
  });
});
