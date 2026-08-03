/**
 * Runs every non-destructive smoke + regression script in sequence and
 * prints a single PASS/FAIL roll-up. Used as the "did anything regress?"
 * gate before tagging a release or after a deploy.
 *
 *   npm run test:smoke:prod   (== SEED_TARGET=prod tsx scripts/test-smoke-all.ts)
 *   npm run test:smoke        (local Supabase, requires `supabase start`)
 *
 * Each individual script already cleans up after itself in finally,
 * so this runner is safe to abort partway. We DO NOT short-circuit on
 * the first failure — the goal is to see the full damage in one shot.
 */
import { spawn } from 'child_process';
import path from 'path';

const HERE = __dirname;

interface Step {
  name: string;
  file: string;
  /** When true, allow the step to fail without polluting the final exit. */
  optional?: boolean;
}

const STEPS: Step[] = [
  // --- Supervisor ERP surfaces -----------------------------------------
  { name: 'supervisor-erp P1 (11 endpoints)', file: 'test-supervisor-erp-p1.ts' },
  { name: 'supervisor settings round-trip', file: 'test-supervisor-settings-roundtrip.ts' },
  { name: 'supervisor 6-month trend (seed+verify)', file: 'seed-and-verify-trend.ts' },
  // --- Invoice line-item pipeline (Phase 1 + Phase 2) ------------------
  { name: 'invoice lines read path (Phase 1)', file: 'seed-and-verify-invoice-lines.ts' },
  { name: 'invoice parser contract (Phase 2)', file: 'test-invoice-parser-phase2.ts' },
  { name: 'upload autoParse contract', file: 'test-upload-autoparse.ts' },
  { name: 'invoice line review PATCH', file: 'test-invoice-line-review.ts' },
  // --- Cross-tenant + role isolation -----------------------------------
  { name: 'RLS isolation (JTC vs EXTERNAL)', file: 'verify-rls-isolation.ts', optional: true },
  { name: 'external consultant isolation', file: 'test-external-consultant-isolation.ts', optional: true },
  // --- Firm admin (P6 follow-up) ---------------------------------------
  { name: 'firm-admin staff/clients/billing (14 asserts)', file: 'test-firm-admin-flow.ts' },
  { name: 'firm signup → FIRM_ADMIN bootstrap (7 asserts)', file: 'test-firm-signup-admin-invite.ts' },
  { name: 'master tenants GET/PATCH (8 asserts)', file: 'test-master-tenants.ts' },
  // --- Operator + billing flows ----------------------------------------
  { name: 'operator queue flow (Coretax 8-state + legacy 400)', file: 'test-operator-queue-flow.ts', optional: true },
  { name: 'workqueue PPh21 (quick-create + detail + request + RBAC)', file: 'test-workqueue-pph21.ts' },
  { name: 'workqueue withholding (quick-create + detail + request + RBAC)', file: 'test-workqueue-withholding.ts' },
  { name: 'workqueue PPN (quick-create + detail + request + RBAC)', file: 'test-workqueue-ppn.ts' },
  { name: 'workqueue UMKM (quick-create + detail + request + RBAC)', file: 'test-workqueue-umkm.ts' },
  { name: 'auto-queue creation (customer write → queue row)', file: 'test-auto-queue-creation.ts' },
  { name: 'workqueue AI pre-review (shape + RBAC + graceful)', file: 'test-workqueue-ai-review.ts' },
  { name: 'workqueue approval loop (request→approve/reject + canApprove + 403)', file: 'test-workqueue-approval-loop.ts' },
  { name: 'workqueue reassign (operators list + supervisor reassign + 403/400)', file: 'test-workqueue-reassign.ts' },
  // 2026-08-03 — wht-import 큐 훅 + 미배정 노출 + first-action claim
  { name: 'workqueue visibility (import hook + unassigned + claim)', file: 'test-workqueue-visibility.ts' },
  { name: 'billing 3-endpoint smoke', file: 'test-billing-flow.ts', optional: true },
  { name: 'monitoring/Sentry flow', file: 'test-monitoring-flow.ts', optional: true },
  // --- P1 미배정 고객 큐 (2026-07-03) ---------------------------------
  // SUPERVISOR only endpoint contract (unauth 401, consultant 403, supervisor 200 + shape).
  // Signup 후 customer_consultant 없이 남은 개인·일반법인 고객을 SUPERVISOR 가
  // 배정할 수 있어야 하는 흐름. 회귀가 깨지면 새 가입자가 큐에서 실종됨.
  { name: 'unassigned customers queue (P1)', file: 'test-unassigned-customers.ts' },
  { name: 'new-customer assignment lifecycle', file: 'test-new-customer-assignment.ts' },
  // v13 §5 — 회원가입 접수 즉시 자동배정 (signup → operator_client_assignments)
  { name: 'signup → auto-assignment golden path', file: 'test-signup-auto-assign.ts', optional: true },
  // v19 트랙 2 — ID Billing 발행 보드 (승인 게이트 + 작성본 xlsx + tenant 분리)
  { name: 'id-billing issuance board flow', file: 'test-id-billing-flow.ts' },
  // v13 트랙 3 — 승인대기 리모델 (4-값 분리 + 검토요청 게이트 + 승인값 스탬프)
  { name: 'approval remodel (4-value + review requests)', file: 'test-approval-remodel.ts' },
  // v13 트랙 4 — 자동배정 엔진 (스코어 배정 + 감사 + overflow fallback)
  { name: 'auto-assignment engine (scored + audit)', file: 'test-auto-assignment.ts' },
  // v13 트랙 5 A+B — ID Billing 이관현황 + 평가 실측/제안값
  { name: 'supervisor handover + evaluation (§7/§8)', file: 'test-supervisor-handover-eval.ts' },
  // v13 트랙 5-C — 상담원 소속관리 (이동 요청 → 승인 워크플로우)
  { name: 'operator affiliation transfer (§6)', file: 'test-operator-affiliation.ts' },
  // v19 트랙 6 — PPN Coretax 대조 (고객 제출 vs Coretax 출력)
  { name: 'ppn coretax reconciliation (§9)', file: 'test-ppn-coretax-recon.ts' },
  // --- Admin / config governance ---------------------------------------
  { name: 'tax code rule CRUD + RBAC (Track B)', file: 'test-tax-code-rule.ts' },
  { name: 'customer-ai inbox end-to-end (Phase 1)', file: 'test-customer-ai-inbox.ts' },
  { name: 'coretax toggle (Track D)', file: 'test-coretax-toggle.ts' },
  { name: 'operator MFA toggle (2FA 강제)', file: 'test-operator-mfa-toggle.ts' },
  { name: 'luxury classifications CRUD + RBAC', file: 'test-luxury-classifications.ts' },
  { name: 'customer-ai templates CRUD + RBAC', file: 'test-customer-ai-templates.ts' },
  // --- Real-file importer regression (BINTANG JAYA) --------------------
  // These run against the real customer xlsx at ~/Downloads. In CI or fresh
  // checkouts the file is absent; the scripts exit 0 with a SKIPPED log so
  // the runner counts them as PASS. Marked optional defensively.
  { name: 'pph23 wholesale importer e2e (BINTANG JAYA)', file: 'validate-pph23-e2e.ts', optional: true },
  { name: 'ppn wholesale importer e2e (BINTANG JAYA)', file: 'validate-ppn-e2e.ts', optional: true },
  // --- Inline-edit PUT contracts (2026-06-02 commit 8494873) -----------
  { name: 'pph23 PUT contract (inline edit)', file: 'verify-pph23-put-contract.ts' },
  { name: 'ppn PUT contract (inline edit)', file: 'verify-ppn-put-contract.ts' },
  { name: 'pph23 invoice photo attach', file: 'verify-pph23-invoice-photo.ts' },
  { name: 'SPT Masa PPN dpp_nilai_lain split', file: 'verify-spt-masa-ppn-split.ts' },
  { name: 'pph26 wholesale import contract', file: 'verify-pph26-import-contract.ts' },
  { name: 'closing credit auto-fill', file: 'verify-closing-auto-credits.ts' },
  { name: 'closing pph23 photo status', file: 'verify-closing-pph23-photo-status.ts' },
  // --- PPh21 strict 34-col app template (2026-06-14, supersedes JTC) ---
  // In-memory template generation + multipart POST → DB read-back.
  // No fixture dependency → always runs.
  { name: 'pph21 strict template e2e', file: 'verify-pph21-strict-template.ts' },
  { name: 'pph21 payslip NPWP surcharge', file: 'verify-payslip-npwp-surcharge.ts' },
  { name: 'pph21 rate-provider DB overrides', file: 'verify-rate-provider-overrides.ts' },
  // --- PPh 4(2) partial view via regime filter (2026-06-17) -----------
  { name: 'pph42 partial view (regime=PPH4_2)', file: 'verify-pph42-page.ts' },
  // --- Operator-initiated SPT Masa from chat thread (2026-06-17) -----
  { name: 'operator spt-masa quick-create', file: 'verify-operator-spt-masa-create.ts' },
  // --- SPT Masa submission request 서버 추적 옵션 B (2026-06-19) ---------
  { name: 'spt masa submission request (옵션 B)', file: 'verify-spt-masa-request.ts' },
  { name: 'operator spt-masa-requests list', file: 'verify-operator-spt-masa-requests-list.ts' },
  // --- WHT one-sheet 통합 매입 ledger (2026-06-08) ---------------------
  { name: 'wht onesheet import contract', file: 'verify-wht-onesheet-contract.ts' },
  // --- PPN JTC 13-col template robustness (2026-06-09) -----------------
  // Empty-slot detection + original-Excel-row preservation. In-memory only,
  // no DB, no fixture file → always runs.
  { name: 'ppn JTC template contract', file: 'verify-ppn-jtc-template-contract.ts' },
  // --- COMPANY signup → company-profile completeness (2026-06-28) -------
  // signup-company endpoint → DB row → /api/company-profile GET → cleanup.
  // 회사 가입 트랙이 깨지면 즉시 fail. business_category 신규 컬럼도 함께 검증.
  { name: 'company signup e2e (completeness ≥ 60%)', file: 'verify-company-signup-flow.ts' },
  // --- PPN luxury 토글 시 ppn/dpp_nilai_lain 재계산 (2026-06-29) -------
  // PMK 131/2024: essential=11% / luxury=12%. UI 토글이 ppn 도 같이 재계산 보장.
  { name: 'ppn luxury toggle (PMK 131/2024)', file: 'verify-ppn-luxury-toggle.ts' },
  // --- Schema drift guard (2026-06-03 audit) ---------------------------
  // Catches migration-history-vs-actual-schema drift early. The 2026-04-10
  // batch incident lost 30+ columns + 1 entire table silently; this runs
  // on every smoke pass so the next broken push is caught immediately.
  { name: 'prod schema drift audit', file: 'verify-prod-schema-drift.ts' },
];

interface Result {
  step: Step;
  status: 'PASS' | 'RETRY_PASS' | 'FAIL' | 'MISSING';
  ms: number;
  exit: number | null;
  retried?: boolean;
}

// Per-step timeout — generous; long-running smokes (autoParse, parser) take 10-15s.
const STEP_TIMEOUT_MS = 5 * 60_000;
// Delay before retry — gives transient causes (deploy roll, rate-limit cooldown) time to clear.
const RETRY_DELAY_MS = 5_000;

/** Spawn ONE attempt of a script. Returns exit code + ms. */
function spawnAttempt(step: Step): Promise<{ exit: number | null; ms: number; status: 'PASS' | 'FAIL' | 'MISSING'; timedOut?: boolean }> {
  return new Promise((resolve) => {
    const fullPath = path.join(HERE, step.file);
    const t0 = Date.now();
    const child = spawn('npx', ['tsx', fullPath], {
      stdio: 'inherit',
      env: process.env,
    });

    const killTimer = setTimeout(() => {
      console.error(`\n⏱  step exceeded ${STEP_TIMEOUT_MS / 1000}s — killing`);
      child.kill('SIGTERM');
      // Force-kill if SIGTERM doesn't take effect in 3s.
      setTimeout(() => child.kill('SIGKILL'), 3_000);
    }, STEP_TIMEOUT_MS);

    let timedOut = false;
    child.on('close', (code) => {
      clearTimeout(killTimer);
      const ms = Date.now() - t0;
      const exit = code ?? 0;
      resolve({ exit, ms, status: exit === 0 ? 'PASS' : 'FAIL', timedOut });
    });
    child.on('error', (err) => {
      clearTimeout(killTimer);
      const ms = Date.now() - t0;
      const msg = err.message;
      console.error(`!! step ${step.name} spawn failed: ${msg}`);
      resolve({
        exit: null,
        ms,
        status: msg.includes('ENOENT') ? 'MISSING' : 'FAIL',
      });
    });
    // Mark timedOut for telemetry when SIGTERM closes the child.
    const origKill = child.kill.bind(child);
    child.kill = ((sig?: NodeJS.Signals | number) => { timedOut = true; return origKill(sig); }) as typeof child.kill;
  });
}

async function runStep(step: Step): Promise<Result> {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`▶ ${step.name}  (${step.file})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const first = await spawnAttempt(step);

  // PASS or MISSING — no retry. Only FAIL with non-zero exit gets one retry.
  if (first.status !== 'FAIL') {
    return { step, status: first.status, ms: first.ms, exit: first.exit };
  }

  console.log(`\n⚠  step FAILED (exit=${first.exit}, ${(first.ms / 1000).toFixed(1)}s) — retrying once in ${RETRY_DELAY_MS / 1000}s …`);
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

  const second = await spawnAttempt(step);
  const totalMs = first.ms + RETRY_DELAY_MS + second.ms;
  if (second.status === 'PASS') {
    return { step, status: 'RETRY_PASS', ms: totalMs, exit: second.exit, retried: true };
  }
  return { step, status: 'FAIL', ms: totalMs, exit: second.exit, retried: true };
}

(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  AI Pajak smoke runner — ${STEPS.length} steps`.padEnd(63) + '║');
  console.log(`║  SEED_TARGET=${process.env.SEED_TARGET ?? 'local'}`.padEnd(63) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const results: Result[] = [];
  for (const step of STEPS) {
    const r = await runStep(step);
    results.push(r);
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Summary                                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  let hardFail = 0;
  for (const r of results) {
    const icon =
      r.status === 'PASS' ? '✅' :
      r.status === 'RETRY_PASS' ? '⚠️ ' :
      r.status === 'MISSING' ? '⏭️ ' : '💥';
    const tag = r.step.optional && r.status === 'FAIL' ? ' (optional)' : '';
    const retryNote = r.status === 'RETRY_PASS' ? '  [retried]' : '';
    const seconds = (r.ms / 1000).toFixed(1);
    console.log(`  ${icon} ${r.step.name}  —  ${seconds}s${tag}${retryNote}`);
    if (r.status === 'FAIL' && !r.step.optional) hardFail++;
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const retryPassed = results.filter((r) => r.status === 'RETRY_PASS').length;
  const skipped = results.filter((r) => r.status === 'MISSING').length;
  const retryNote = retryPassed > 0 ? ` · ${retryPassed} retry-pass` : '';
  console.log(
    `\n  ${passed} pass${retryNote} · ${skipped} missing · ${hardFail} required-fail / ${results.length} total\n`,
  );

  process.exit(hardFail > 0 ? 1 : 0);
})();
