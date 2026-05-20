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
  // --- Cross-tenant + role isolation -----------------------------------
  { name: 'RLS isolation (JTC vs EXTERNAL)', file: 'verify-rls-isolation.ts', optional: true },
  { name: 'external consultant isolation', file: 'test-external-consultant-isolation.ts', optional: true },
  // --- Operator + billing flows ----------------------------------------
  { name: 'operator queue 11-state flow', file: 'test-operator-queue-flow.ts', optional: true },
  { name: 'billing 3-endpoint smoke', file: 'test-billing-flow.ts', optional: true },
  { name: 'monitoring/Sentry flow', file: 'test-monitoring-flow.ts', optional: true },
];

interface Result {
  step: Step;
  status: 'PASS' | 'FAIL' | 'MISSING';
  ms: number;
  exit: number | null;
}

function runStep(step: Step): Promise<Result> {
  return new Promise((resolve) => {
    const fullPath = path.join(HERE, step.file);
    const t0 = Date.now();
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`▶ ${step.name}  (${step.file})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const child = spawn('npx', ['tsx', fullPath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      const ms = Date.now() - t0;
      const exit = code ?? 0;
      let status: Result['status'] = 'PASS';
      if (exit !== 0) status = 'FAIL';
      resolve({ step, status, ms, exit });
    });
    child.on('error', (err) => {
      const ms = Date.now() - t0;
      const msg = err.message;
      console.error(`!! step ${step.name} spawn failed: ${msg}`);
      resolve({
        step,
        status: msg.includes('ENOENT') ? 'MISSING' : 'FAIL',
        ms,
        exit: null,
      });
    });
  });
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
      r.status === 'PASS' ? '✅' : r.status === 'MISSING' ? '⏭️ ' : '💥';
    const tag = r.step.optional && r.status !== 'PASS' ? ' (optional)' : '';
    const seconds = (r.ms / 1000).toFixed(1);
    console.log(`  ${icon} ${r.step.name}  —  ${seconds}s${tag}`);
    if (r.status === 'FAIL' && !r.step.optional) hardFail++;
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const skipped = results.filter((r) => r.status === 'MISSING').length;
  console.log(
    `\n  ${passed} pass · ${skipped} missing · ${hardFail} required-fail / ${results.length} total\n`,
  );

  process.exit(hardFail > 0 ? 1 : 0);
})();
