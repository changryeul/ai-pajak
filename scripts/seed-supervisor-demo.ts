/**
 * Seed: Supervisor 백오피스 데모 데이터.
 *
 * Mirrors the layout shown in `AI Pajak 백오피스_수퍼바이저.pdf`:
 *   - 3 supervisors (SUP001 Corporate/Monthly, SUP002 Annual Filing, SUP003 Personal/Support)
 *   - 12 operators (EMP001..EMP012) split across the 3 supervisors per the PDF's
 *     "Supervisor 관리 인원 설정" panel
 *   - Auth users are created so the supervisor can actually log in
 *   - Initial work_state values match the dashboard 5x2 grid in the PDF
 *
 * Targets local Supabase by default. Use SEED_TARGET=prod to run against the
 * remote project (.env.production.local).
 */

import { config as dotenvConfig } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';

const target = process.env.SEED_TARGET === 'prod' ? 'prod' : 'local';
const envFile = target === 'prod' ? '.env.production.local' : '.env.local';
dotenvConfig({ path: path.resolve(process.cwd(), envFile) });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`Missing env in ${envFile} (SUPABASE_URL or SERVICE_ROLE_KEY)`);
  process.exit(1);
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'TestPassword123!';

interface SupervisorSeed {
  email: string;
  empId: string;
  name: string;
  team: string;
  maxManaged: number;
}

interface OperatorSeed {
  email: string;
  empId: string;
  name: string;
  workState: 'available' | 'consulting' | 'reviewing' | 'coretax' | 'break' | 'offline' | 'resigned';
  autoAssign: boolean;
  loggedInToday: boolean;
  supervisorEmpId: string;
}

const supervisors: SupervisorSeed[] = [
  { email: 'sv-corporate@aipajak.com', empId: 'SUP001', name: '최수퍼', team: 'Corporate / Monthly', maxManaged: 4 },
  { email: 'sv-annual@aipajak.com',    empId: 'SUP002', name: '박수퍼', team: 'Annual Filing',       maxManaged: 3 },
  { email: 'sv-personal@aipajak.com',  empId: 'SUP003', name: '정수퍼', team: 'Personal / Support',  maxManaged: 3 },
];

const operators: OperatorSeed[] = [
  // SUP001 (4명 — 정상)
  { email: 'op-emp001@aipajak.com', empId: 'EMP001', name: '김상담', workState: 'reviewing',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001' },
  { email: 'op-emp002@aipajak.com', empId: 'EMP002', name: '이상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001' },
  { email: 'op-emp005@aipajak.com', empId: 'EMP005', name: '최상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001' },
  { email: 'op-emp006@aipajak.com', empId: 'EMP006', name: '한상담', workState: 'consulting', autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001' },
  // SUP002 (4명 — 초과)
  { email: 'op-emp003@aipajak.com', empId: 'EMP003', name: '박상담', workState: 'break',      autoAssign: false, loggedInToday: true,  supervisorEmpId: 'SUP002' },
  { email: 'op-emp007@aipajak.com', empId: 'EMP007', name: '윤상담', workState: 'coretax',    autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP002' },
  { email: 'op-emp008@aipajak.com', empId: 'EMP008', name: '오상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP002' },
  { email: 'op-emp011@aipajak.com', empId: 'EMP011', name: '신상담', workState: 'break',      autoAssign: false, loggedInToday: true,  supervisorEmpId: 'SUP002' },
  // SUP003 (4명 — 초과)
  { email: 'op-emp004@aipajak.com', empId: 'EMP004', name: '정상담', workState: 'offline',    autoAssign: false, loggedInToday: false, supervisorEmpId: 'SUP003' },
  { email: 'op-emp009@aipajak.com', empId: 'EMP009', name: '문상담', workState: 'reviewing',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP003' },
  { email: 'op-emp010@aipajak.com', empId: 'EMP010', name: '강상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP003' },
  { email: 'op-emp012@aipajak.com', empId: 'EMP012', name: '배상담', workState: 'offline',    autoAssign: false, loggedInToday: false, supervisorEmpId: 'SUP003' },
];

async function ensureAuthUser(email: string, fullName: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find(u => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser failed for ${email}: ${error?.message}`);
  return data.user.id;
}

async function ensureRole(userId: string, role: string) {
  const { data: existing } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();
  if (existing) return;
  await admin.from('user_roles').insert({ user_id: userId, role, is_active: true });
}

async function ensureOperator(args: {
  userId: string; empId: string; name: string; email: string;
  role: 'tax_operator' | 'tax_operator_supervisor';
  maxClients?: number; maxManaged?: number;
  workState?: string; autoAssign?: boolean; loggedInToday?: boolean;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    user_id: args.userId,
    employee_id: args.empId,
    name: args.name,
    email: args.email,
    role: args.role,
    status: 'active',
    work_state: args.workState ?? 'available',
    auto_assign_enabled: args.autoAssign ?? true,
    last_login_at: args.loggedInToday === false ? null : new Date().toISOString(),
  };
  if (args.maxClients !== undefined) payload.max_clients = args.maxClients;
  if (args.maxManaged !== undefined) payload.max_managed = args.maxManaged;

  const { data: existing } = await admin
    .from('tax_operators')
    .select('id')
    .eq('employee_id', args.empId)
    .maybeSingle();
  if (existing) {
    await admin.from('tax_operators').update(payload).eq('id', existing.id);
    return existing.id;
  }
  const { data, error } = await admin.from('tax_operators').insert(payload).select('id').single();
  if (error || !data) throw new Error(`tax_operators insert failed for ${args.empId}: ${error?.message}`);
  return data.id;
}

async function main() {
  console.log(`🌱 Seeding supervisor demo into ${target} (${SUPABASE_URL})`);

  const supEmpToId = new Map<string, string>();

  for (const sv of supervisors) {
    const userId = await ensureAuthUser(sv.email, `${sv.name} (${sv.empId})`);
    await ensureRole(userId, 'TAX_OPERATOR_SUPERVISOR');
    const opRowId = await ensureOperator({
      userId, empId: sv.empId, name: sv.name, email: sv.email,
      role: 'tax_operator_supervisor', maxClients: 0, maxManaged: sv.maxManaged,
      workState: 'available', autoAssign: true, loggedInToday: true,
    });
    supEmpToId.set(sv.empId, opRowId);
    console.log(`  ✓ supervisor ${sv.empId} ${sv.name} (${sv.team})`);
  }

  const opEmpToId = new Map<string, string>();
  for (const op of operators) {
    const userId = await ensureAuthUser(op.email, `${op.name} (${op.empId})`);
    await ensureRole(userId, 'TAX_OPERATOR');
    const opRowId = await ensureOperator({
      userId, empId: op.empId, name: op.name, email: op.email,
      role: 'tax_operator', maxClients: 35,
      workState: op.workState, autoAssign: op.autoAssign, loggedInToday: op.loggedInToday,
    });
    opEmpToId.set(op.empId, opRowId);
  }
  console.log(`  ✓ ${operators.length} operators`);

  // Supervisor ↔ Operator assignment
  for (const op of operators) {
    const supId = supEmpToId.get(op.supervisorEmpId);
    const opId = opEmpToId.get(op.empId);
    if (!supId || !opId) continue;
    const { data: existing } = await admin
      .from('supervisor_operator_assignment')
      .select('id')
      .eq('operator_id', opId)
      .maybeSingle();
    if (existing) {
      await admin.from('supervisor_operator_assignment').update({
        supervisor_id: supId, is_active: true,
      }).eq('id', existing.id);
    } else {
      await admin.from('supervisor_operator_assignment').insert({
        supervisor_id: supId, operator_id: opId, is_active: true,
      });
    }
  }
  console.log(`  ✓ supervisor↔operator assignments`);

  console.log('\n✨ Done.\n');
  console.log('Login credentials (password: TestPassword123!):');
  for (const sv of supervisors) console.log(`  - ${sv.email} (${sv.empId} ${sv.name}, ${sv.team})`);
  console.log('  - op-emp001..emp012@aipajak.com (12 operators)');
}

main().catch(err => { console.error(err); process.exit(1); });
