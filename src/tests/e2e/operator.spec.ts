/**
 * Operator Workflow E2E Tests
 *
 * Tests for:
 * - Supervisor: workload, statistics, complaints, approval rules, auto-assign
 * - Operator: queue access, status transitions
 * - RBAC: role-based access control enforcement
 * - Realtime stats API
 */

import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';

test.describe('TAX_OPERATOR_SUPERVISOR Role Tests', () => {
  let supervisorToken: string;

  test.beforeAll(async ({ request }) => {
    supervisorToken = await loginAs(
      request,
      TEST_USERS.TAX_OPERATOR_SUPERVISOR.email,
      TEST_USERS.TAX_OPERATOR_SUPERVISOR.password
    );
  });

  test('✅ Supervisor can access workload API', async ({ request }) => {
    const response = await request.get('/api/operator/workload', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('operators');
    expect(body.data).toHaveProperty('unassigned_items');
    expect(body.data).toHaveProperty('summary');
    expect(body.data.summary).toHaveProperty('total_operators');
    expect(body.data.summary).toHaveProperty('active_operators');
    expect(body.data.summary).toHaveProperty('avg_utilization_pct');
  });

  test('✅ Supervisor can access statistics API', async ({ request }) => {
    const response = await request.get('/api/operator/statistics?period=monthly', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('operators');
    expect(body.data).toHaveProperty('totals');
    expect(body.data).toHaveProperty('period');
    expect(body.data.period).toBe('monthly');
  });

  test('✅ Supervisor can access complaints API', async ({ request }) => {
    const response = await request.get('/api/operator/complaints', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('summary');
    expect(body.data).toHaveProperty('pagination');
  });

  test('✅ Supervisor can access approval rules API', async ({ request }) => {
    const response = await request.get('/api/operator/approval-rules', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('rule');
    expect(body.data).toHaveProperty('statistics');
    expect(body.data.statistics).toHaveProperty('autoApprovalRate');
  });

  test('✅ Supervisor can update approval rules', async ({ request }) => {
    const response = await request.put('/api/operator/approval-rules', {
      headers: createAuthHeaders(supervisorToken),
      data: {
        maxRiskScore: 40,
        minComplianceScore: 70,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.max_risk_score).toBe(40);
    expect(body.data.min_compliance_score).toBe(70);

    // Restore defaults
    await request.put('/api/operator/approval-rules', {
      headers: createAuthHeaders(supervisorToken),
      data: { maxRiskScore: 30, minComplianceScore: 75 },
    });
  });

  test('✅ Supervisor can view all queue items', async ({ request }) => {
    const response = await request.get('/api/operator/queue?limit=10', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('pagination');
  });

  test('✅ Supervisor can trigger auto-assign', async ({ request }) => {
    const response = await request.post('/api/operator/auto-assign', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('assigned');
    expect(body.data).toHaveProperty('overflow');
    expect(body.data).toHaveProperty('details');
    expect(typeof body.data.assigned).toBe('number');
  });

  test('✅ Supervisor can access realtime stats', async ({ request }) => {
    const response = await request.get('/api/operator/queue/realtime-stats', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('statusDistribution');
    expect(body.data).toHaveProperty('hourlyThroughput');
    expect(body.data).toHaveProperty('agingItems');
    expect(body.data).toHaveProperty('metrics');
    expect(body.data.metrics).toHaveProperty('autoApprovalRate');
    expect(body.data.metrics).toHaveProperty('slaBreaches');
    expect(Array.isArray(body.data.hourlyThroughput)).toBe(true);
  });

  test('✅ Supervisor can access operator dashboard data', async ({ request }) => {
    const response = await request.get('/api/operator', {
      headers: createAuthHeaders(supervisorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('stats');
    expect(body.data).toHaveProperty('summary');
  });
});

test.describe('TAX_OPERATOR Role Tests', () => {
  let operatorToken: string;

  test.beforeAll(async ({ request }) => {
    operatorToken = await loginAs(
      request,
      TEST_USERS.TAX_OPERATOR.email,
      TEST_USERS.TAX_OPERATOR.password
    );
  });

  test('✅ Operator can access own queue items', async ({ request }) => {
    const response = await request.get('/api/operator/queue?limit=10', {
      headers: createAuthHeaders(operatorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');
  });

  test('✅ Operator can access own dashboard data', async ({ request }) => {
    const response = await request.get('/api/operator', {
      headers: createAuthHeaders(operatorToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('❌ Regular operator cannot access workload API', async ({ request }) => {
    const response = await request.get('/api/operator/workload', {
      headers: createAuthHeaders(operatorToken),
    });

    expect(response.status()).toBe(403);
  });

  test('❌ Regular operator cannot access statistics API', async ({ request }) => {
    const response = await request.get('/api/operator/statistics?period=monthly', {
      headers: createAuthHeaders(operatorToken),
    });

    expect(response.status()).toBe(403);
  });

  test('❌ Regular operator cannot trigger auto-assign', async ({ request }) => {
    const response = await request.post('/api/operator/auto-assign', {
      headers: createAuthHeaders(operatorToken),
    });

    expect(response.status()).toBe(403);
  });

  test('❌ Regular operator cannot update approval rules', async ({ request }) => {
    const response = await request.put('/api/operator/approval-rules', {
      headers: createAuthHeaders(operatorToken),
      data: { maxRiskScore: 50 },
    });

    expect(response.status()).toBe(403);
  });
});

test.describe('RBAC — Non-Operator Access Denial', () => {
  let customerToken: string;

  test.beforeAll(async ({ request }) => {
    customerToken = await loginAs(
      request,
      TEST_USERS.CUSTOMER.email,
      TEST_USERS.CUSTOMER.password
    );
  });

  test('❌ Customer cannot access operator queue', async ({ request }) => {
    const response = await request.get('/api/operator/queue', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.status()).toBe(403);
  });

  test('❌ Customer cannot access operator workload', async ({ request }) => {
    const response = await request.get('/api/operator/workload', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.status()).toBe(403);
  });

  test('❌ Customer cannot access operator statistics', async ({ request }) => {
    const response = await request.get('/api/operator/statistics', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.status()).toBe(403);
  });

  test('✅ Customer can access own queue (payment status)', async ({ request }) => {
    const response = await request.get('/api/customer/queue', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('summary');
  });
});
