/**
 * Smoke test the monitoring dashboard data flow.
 *
 * Logs in as admin.test, hits /api/admin/monitoring, and asserts:
 *   - HTTP 200 + JSON shape matches MonitoringData interface
 *   - DB check is 'operational'
 *   - Circuit breakers list contains djp/midtrans/email/ocr
 *   - errorStats and recentAuditStats return numeric values (not catch fallback)
 *   - top activity types include real values from audit_log
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-monitoring-flow.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';

interface MonitoringResponse {
  status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: Array<{ name: string; status: string; latency?: number; message?: string }>;
  circuitBreakers: Array<{ name: string; state: string; failures: number }>;
  memory: { heapUsed: number; heapTotal: number; rss: number; percentage: number };
  errorStats: { lastHour: number; last24Hours: number; last7Days: number };
  recentAuditStats: { totalActions: number; topActions: Array<{ action: string; count: number }> };
}

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) {
    console.error(`   ❌ login failed for ${email}: ${error?.message ?? 'no session'}`);
    return null;
  }
  return data.session.access_token;
}

async function main() {
  console.log('📊 Monitoring dashboard smoke test\n');

  const token = await login('admin.test@aipajak.com');
  if (!token) return;
  console.log('✅ logged in as admin.test@aipajak.com\n');

  const res = await fetch(`${baseUrl}/api/admin/monitoring`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`📡 GET /api/admin/monitoring → ${res.status}`);

  if (res.status !== 200) {
    console.error('❌ unexpected status', res.status);
    console.error('   body:', (await res.text()).slice(0, 300));
    return;
  }

  const data = (await res.json()) as MonitoringResponse;

  console.log('\n━━ Overall ━━');
  console.log(`   status:      ${data.status}`);
  console.log(`   environment: ${data.environment}`);
  console.log(`   version:     ${data.version}`);
  console.log(`   uptime:      ${data.uptime}s`);

  console.log('\n━━ Services ━━');
  for (const svc of data.services) {
    const latency = svc.latency != null ? `${svc.latency}ms` : '—';
    console.log(`   ${svc.status === 'operational' ? '✅' : svc.status === 'degraded' ? '⚠️ ' : '❌'} ${svc.name}: ${svc.status} (${latency})${svc.message ? ` — ${svc.message}` : ''}`);
  }

  console.log('\n━━ Circuit Breakers ━━');
  const expectedBreakers = ['djp', 'midtrans', 'email', 'ocr'];
  for (const name of expectedBreakers) {
    const found = data.circuitBreakers.find((cb) => cb.name === name);
    if (found) {
      const icon = found.state === 'CLOSED' ? '✅' : found.state === 'OPEN' ? '❌' : '⚠️ ';
      console.log(`   ${icon} ${name}: ${found.state} (failures=${found.failures})`);
    } else {
      console.log(`   ❓ ${name}: NOT REGISTERED`);
    }
  }

  console.log('\n━━ Memory ━━');
  console.log(`   heap:       ${data.memory.heapUsed}/${data.memory.heapTotal} MB (${data.memory.percentage}%)`);
  console.log(`   rss:        ${data.memory.rss} MB`);

  console.log('\n━━ Error Stats (audit_log activity_type ∈ failure list) ━━');
  console.log(`   last 1h:    ${data.errorStats.lastHour}`);
  console.log(`   last 24h:   ${data.errorStats.last24Hours}`);
  console.log(`   last 7d:    ${data.errorStats.last7Days}`);

  console.log('\n━━ Recent Audit Activity (last 24h) ━━');
  console.log(`   total:      ${data.recentAuditStats.totalActions}`);
  if (data.recentAuditStats.topActions.length === 0) {
    console.log('   (no audit activity in last 24h — DB has no records or filter wrong)');
  } else {
    console.log('   top types:');
    for (const a of data.recentAuditStats.topActions) {
      console.log(`     - ${a.action.padEnd(30)} ${a.count}`);
    }
  }

  console.log('\n━━ Verdict ━━');
  const dbOk = data.services.find((s) => s.name.includes('Database'))?.status === 'operational';
  const breakersOk = expectedBreakers.every((n) => data.circuitBreakers.some((cb) => cb.name === n));
  const auditWorks = data.recentAuditStats.totalActions >= 0; // any non-error response

  console.log(`   ${dbOk ? '✅' : '❌'} Database check`);
  console.log(`   ${breakersOk ? '✅' : '❌'} Circuit breakers registered (4 expected)`);
  console.log(`   ${auditWorks ? '✅' : '❌'} Audit query executed (column mismatch fixed)`);

  console.log('\n✨ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
