# AI Pajak E2E Tests - Role-Based Access Control

**Playwright-based E2E tests for RBAC enforcement**

---

## 📋 Overview

This test suite verifies that all **5 Hard Rules** are enforced across the AI Pajak platform:

1. ✅ **Two-layer authorization** (API middleware + Database RLS)
2. ✅ **PLATFORM_ADMIN cannot access tax data**
3. ✅ **Tax actions traceable to Jakarta Tax Consulting**
4. ✅ **Platform never performs tax filing**
5. ✅ **All tax operations create audit logs**

---

## 🎯 Test Coverage

| Test Suite | Tests | Critical |
|------------|-------|----------|
| **customer.spec.ts** | 7 tests | ⚠️ Medium |
| **consultant.spec.ts** | 7 tests | ⚠️ Medium |
| **tax-advisor.spec.ts** | 13 tests | 🚨 High |
| **platform-admin.spec.ts** | 12 tests | 🚨 **CRITICAL** |
| **system.spec.ts** | 9 tests | ⚠️ Medium |
| **audit.spec.ts** | 11 tests | 🚨 High |
| **billing-phases.spec.ts** (Phase B-3/K-2/D) | 7 tests | 🚨 High |
| **billing-custom-pricing.spec.ts** (Phase K-3/E) | 3 tests | ⚠️ Medium |
| **operator-queue-workflow.spec.ts** (Phase G2) | 6 tests | 🚨 High |
| **Total** | **75 tests** | |

### Phase B-3 / K / D / E / G2 suites (neue since 2026-04-11)

- `billing-phases.spec.ts` — the three per-surface endpoints
  (`corporate-plan`, `consultant-plan`, `individual-spt`) and their
  graceful-degrade pattern when no Midtrans credentials are configured
- `billing-custom-pricing.spec.ts` — master → customer handshake
  (master creates DRAFT, marks SENT, customer accepts, subscription is
  auto-materialized) + cross-customer guard + non-master block
- `operator-queue-workflow.spec.ts` — supervisor drives a synthetic
  queue item through the 11-state workflow (regression for the four
  G2 bugs: role/column mismatch, `updated_by` phantom column,
  payment-proof audit_log mismatch, reject API action)

Prerequisites for the new suites:

```bash
npm run db:seed-test-users                                      # JTC side
npx tsx scripts/seed-master-and-external.ts                     # operator team + EXTERNAL partner
npx tsx scripts/seed-company-customer.ts                        # COMPANY customer record
```

Dedicated run commands:

```bash
npm run test:e2e:billing        # billing-phases + custom-pricing
npm run test:e2e:operator-queue # operator-queue-workflow only
npm run test:e2e:phase-b3-k-d   # all three new suites
```

---

## 🚨 Critical Security Tests

### Platform Admin Blocking (MOST IMPORTANT)

If **ANY** of these tests fail, **DO NOT DEPLOY** to production:

- ❌ Platform admin CANNOT calculate tax
- ❌ Platform admin CANNOT file tax
- ❌ Platform admin CANNOT view individual tax filing
- ❌ Platform admin CANNOT view customer details
- ❌ Platform admin CANNOT create/sign POA
- ❌ Platform admin CANNOT create billing
- ✅ Platform admin CAN view aggregated dashboard (anonymized only)
- ✅ Platform admin dashboard contains NO customer PII

### POA Validation Tests

- ❌ Tax Advisor CANNOT file tax WITHOUT active POA
- ❌ Tax Advisor CANNOT file tax with EXPIRED POA
- ❌ Tax Advisor CANNOT file tax with POA SCOPE mismatch
- ✅ Tax Advisor CAN file tax WITH active POA

### Audit Trail Tests

- ✅ Tax filing creates audit log
- ✅ POA creation creates audit log
- ✅ Billing creation creates audit log
- ✅ Failed attempts are logged

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### 2. Set Up Environment

Create `.env.test`:

```bash
# Supabase Test Environment
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
TEST_SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Base URL
BASE_URL=http://localhost:3000
```

### 3. Seed Test Database

```bash
# Run database migrations
supabase migration up

# Seed test users
npm run test:seed
```

Test users required:
- `customer.test@example.com` (CUSTOMER)
- `consultant.test@jakartatax.co.id` (CONSULTANT)
- `advisor.test@jakartatax.co.id` (TAX_ADVISOR)
- `admin.test@aipajak.com` (PLATFORM_ADMIN)

### 4. Run Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e:customer
npm run test:e2e:consultant
npm run test:e2e:tax-advisor
npm run test:e2e:platform-admin  # CRITICAL TESTS
npm run test:e2e:system
npm run test:e2e:audit

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Generate report
npm run test:e2e:report
```

---

## 📁 Test Structure

```
tests/e2e/
├── auth/
│   └── login.helper.ts          # Authentication helpers
├── fixtures/
│   └── users.ts                 # Test user fixtures
├── customer.spec.ts             # CUSTOMER role tests
├── consultant.spec.ts           # CONSULTANT role tests
├── tax-advisor.spec.ts          # TAX_ADVISOR role tests
├── platform-admin.spec.ts       # 🚨 PLATFORM_ADMIN blocking tests
├── system.spec.ts               # SYSTEM role tests
├── audit.spec.ts                # Audit trail verification tests
└── README.md                    # This file
```

---

## 🔐 Test User Fixtures

### CUSTOMER

```typescript
{
  email: 'customer.test@example.com',
  password: 'TestPassword123!',
  role: 'CUSTOMER',
  customerId: 'test-customer-uuid-001',
}
```

**Permissions**:
- ✅ Create POA
- ✅ Sign POA
- ❌ Calculate tax
- ❌ File tax

### CONSULTANT

```typescript
{
  email: 'consultant.test@jakartatax.co.id',
  password: 'TestPassword123!',
  role: 'CONSULTANT',
  consultantId: 'test-consultant-uuid-001',
}
```

**Permissions**:
- ✅ Calculate tax (assigned customers only)
- ❌ File tax
- ❌ Sign POA

### TAX_ADVISOR

```typescript
{
  email: 'advisor.test@jakartatax.co.id',
  password: 'TestPassword123!',
  role: 'TAX_ADVISOR',
  consultantId: 'test-advisor-uuid-001',
}
```

**Permissions**:
- ✅ Calculate tax
- ✅ File tax (REQUIRES ACTIVE POA)
- ✅ Sign POA
- ❌ File tax without POA

### PLATFORM_ADMIN

```typescript
{
  email: 'admin.test@aipajak.com',
  password: 'TestPassword123!',
  role: 'PLATFORM_ADMIN',
}
```

**Permissions**:
- ✅ View aggregated dashboard (anonymized)
- ❌ Calculate tax
- ❌ File tax
- ❌ View individual customer data
- ❌ Create billing

### SYSTEM

```typescript
{
  serviceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
  role: 'SYSTEM',
}
```

**Permissions**:
- ✅ Create billing transactions
- ❌ Calculate tax
- ❌ File tax
- ❌ Sign POA

---

## ✅ Test Acceptance Criteria

### All Tests Must Pass

```
✅ 59/59 tests passing
❌ 0 tests failing
⚠️ 0 tests skipped
```

### Critical Security Gates

Before deployment, verify:

1. **Platform Admin Blocking**: All 12 tests PASS
2. **POA Validation**: All tests PASS
3. **Audit Trail**: All tests PASS
4. **Role Separation**: All tests PASS

### Performance Criteria

- Total test execution time: < 5 minutes
- Individual test execution time: < 30 seconds
- No flaky tests (100% consistent)

---

## 🐛 Troubleshooting

### Test Failures

**"Login failed"**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Verify test users exist
npm run test:seed
```

**"POA not found"**
```bash
# Seed POA test data
npm run test:seed:poa
```

**"Network request failed"**
```bash
# Ensure dev server is running
npm run dev

# Or use webServer in playwright.config.ts
```

### Common Issues

**Port already in use**:
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
BASE_URL=http://localhost:3001 npm run test:e2e
```

**Database not seeded**:
```bash
# Reset database and reseed
supabase db reset
npm run test:seed
```

---

## 📊 Test Reports

### HTML Report

```bash
# Generate and open HTML report
npm run test:e2e:report
```

Report includes:
- Test execution timeline
- Screenshots of failures
- Network logs
- Console logs
- Test artifacts

### JSON Report

```bash
# Generate JSON report
npm run test:e2e -- --reporter=json --reporter=json,outputFile=test-results/results.json
```

### CI Integration

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    BASE_URL: ${{ secrets.BASE_URL }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    TEST_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

---

## 🔒 Security Considerations

### Test Data Isolation

- Use separate test database (never production)
- Test users have `test` in email domain
- Test data marked with `test-` prefix
- Cleanup after test runs

### Sensitive Data

- Never commit real credentials
- Use environment variables for all secrets
- Rotate test credentials regularly
- Limit test service role key permissions

### Access Control

- Test users should have minimal permissions
- Test database should be isolated
- No cross-contamination with production data

---

## 📚 Related Documentation

- [API Implementation Summary](../../docs/API_IMPLEMENTATION_SUMMARY.md)
- [Auth/RBAC Implementation](../../docs/AUTH_RBAC_IMPLEMENTATION.md)
- [Operations Manual](../../docs/OPERATIONS_MANUAL.md)
- [Data Masking Policy](../../docs/DATA_MASKING_POLICY.md)

---

## 🎯 Success Metrics

### Deployment Gate

```
All 59 E2E tests PASS
└─ customer.spec.ts: 7/7 ✅
└─ consultant.spec.ts: 7/7 ✅
└─ tax-advisor.spec.ts: 13/13 ✅
└─ platform-admin.spec.ts: 12/12 ✅  ← CRITICAL
└─ system.spec.ts: 9/9 ✅
└─ audit.spec.ts: 11/11 ✅

🎉 READY FOR DEPLOYMENT
```

### If Any Test Fails

```
❌ DO NOT DEPLOY TO PRODUCTION
❌ Fix failing tests first
❌ Re-run entire test suite
❌ Document root cause
❌ Update tests if needed
```

---

**Status**: ✅ All 59 tests implemented and ready
**Last Updated**: 2025-12-23
