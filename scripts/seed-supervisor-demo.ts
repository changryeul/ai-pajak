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
  // PDF '성과/평가' 화면의 12명 metric을 그대로 시드.
  accuracyPct: number;
  avgProcessingMinutes: number;
  approvalQualityScore: number;
  customerSatisfactionScore: number;
}

const supervisors: SupervisorSeed[] = [
  { email: 'sv-corporate@aipajak.com', empId: 'SUP001', name: '최수퍼', team: 'Corporate / Monthly', maxManaged: 4 },
  { email: 'sv-annual@aipajak.com',    empId: 'SUP002', name: '박수퍼', team: 'Annual Filing',       maxManaged: 3 },
  { email: 'sv-personal@aipajak.com',  empId: 'SUP003', name: '정수퍼', team: 'Personal / Support',  maxManaged: 3 },
];

// metric defaults follow the "상담원 비교 평가표" in PDF p.13-17.
const operators: OperatorSeed[] = [
  { email: 'op-emp001@aipajak.com', empId: 'EMP001', name: '김상담', workState: 'reviewing',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001', accuracyPct: 98, avgProcessingMinutes: 38, approvalQualityScore: 96, customerSatisfactionScore: 97 },
  { email: 'op-emp002@aipajak.com', empId: 'EMP002', name: '이상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001', accuracyPct: 95, avgProcessingMinutes: 44, approvalQualityScore: 91, customerSatisfactionScore: 93 },
  { email: 'op-emp005@aipajak.com', empId: 'EMP005', name: '최상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001', accuracyPct: 96, avgProcessingMinutes: 41, approvalQualityScore: 93, customerSatisfactionScore: 95 },
  { email: 'op-emp006@aipajak.com', empId: 'EMP006', name: '한상담', workState: 'consulting', autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP001', accuracyPct: 94, avgProcessingMinutes: 47, approvalQualityScore: 89, customerSatisfactionScore: 92 },
  { email: 'op-emp003@aipajak.com', empId: 'EMP003', name: '박상담', workState: 'break',      autoAssign: false, loggedInToday: true,  supervisorEmpId: 'SUP002', accuracyPct: 93, avgProcessingMinutes: 52, approvalQualityScore: 88, customerSatisfactionScore: 91 },
  { email: 'op-emp007@aipajak.com', empId: 'EMP007', name: '윤상담', workState: 'coretax',    autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP002', accuracyPct: 97, avgProcessingMinutes: 45, approvalQualityScore: 92, customerSatisfactionScore: 95 },
  { email: 'op-emp008@aipajak.com', empId: 'EMP008', name: '오상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP002', accuracyPct: 92, avgProcessingMinutes: 54, approvalQualityScore: 86, customerSatisfactionScore: 89 },
  { email: 'op-emp011@aipajak.com', empId: 'EMP011', name: '신상담', workState: 'break',      autoAssign: false, loggedInToday: true,  supervisorEmpId: 'SUP002', accuracyPct: 90, avgProcessingMinutes: 59, approvalQualityScore: 85, customerSatisfactionScore: 88 },
  { email: 'op-emp004@aipajak.com', empId: 'EMP004', name: '정상담', workState: 'offline',    autoAssign: false, loggedInToday: false, supervisorEmpId: 'SUP003', accuracyPct: 90, avgProcessingMinutes: 61, approvalQualityScore: 84, customerSatisfactionScore: 87 },
  { email: 'op-emp009@aipajak.com', empId: 'EMP009', name: '문상담', workState: 'reviewing',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP003', accuracyPct: 95, avgProcessingMinutes: 49, approvalQualityScore: 90, customerSatisfactionScore: 93 },
  { email: 'op-emp010@aipajak.com', empId: 'EMP010', name: '강상담', workState: 'available',  autoAssign: true,  loggedInToday: true,  supervisorEmpId: 'SUP003', accuracyPct: 91, avgProcessingMinutes: 50, approvalQualityScore: 87, customerSatisfactionScore: 89 },
  { email: 'op-emp012@aipajak.com', empId: 'EMP012', name: '배상담', workState: 'offline',    autoAssign: false, loggedInToday: false, supervisorEmpId: 'SUP003', accuracyPct: 88, avgProcessingMinutes: 64, approvalQualityScore: 82, customerSatisfactionScore: 85 },
];

async function findUserByEmail(email: string): Promise<string | null> {
  // GoTrue admin REST API supports email filter directly.
  // Falls back to paginated listUsers on older deployments.
  const url = `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`;
  const r = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (r.ok) {
    const j = await r.json();
    const hit = (j.users || []).find((u: { email?: string; id: string }) => u.email === email);
    if (hit) return hit.id;
  }
  // Fallback: walk pages.
  let page = 1;
  while (page <= 50) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const hit = data?.users.find(u => u.email === email);
    if (hit) return hit.id;
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
  }
  return null;
}

async function ensureAuthUser(email: string, fullName: string): Promise<string> {
  const found = await findUserByEmail(email);
  if (found) return found;

  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (data?.user) return data.user.id;
  // The "already registered" branch can race past listUsers — re-resolve.
  if (error?.message?.toLowerCase().includes('already')) {
    const again = await findUserByEmail(email);
    if (again) return again;
  }
  throw new Error(`createUser failed for ${email}: ${error?.message}`);
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
  accuracyPct?: number; avgProcessingMinutes?: number;
  approvalQualityScore?: number; customerSatisfactionScore?: number;
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
  if (args.accuracyPct !== undefined) payload.accuracy_pct = args.accuracyPct;
  if (args.avgProcessingMinutes !== undefined) payload.avg_processing_minutes = args.avgProcessingMinutes;
  if (args.approvalQualityScore !== undefined) payload.approval_quality_score = args.approvalQualityScore;
  if (args.customerSatisfactionScore !== undefined) payload.customer_satisfaction_score = args.customerSatisfactionScore;

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
      accuracyPct: op.accuracyPct,
      avgProcessingMinutes: op.avgProcessingMinutes,
      approvalQualityScore: op.approvalQualityScore,
      customerSatisfactionScore: op.customerSatisfactionScore,
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

  // Cases — mirrors the PDF "업무 배정/회수" 좌측 케이스 리스트.
  console.log('\n  • seeding demo cases…');
  await seedCases(supEmpToId, opEmpToId);
  console.log(`  ✓ demo cases`);

  console.log('\n✨ Done.\n');
  console.log('Login credentials (password: TestPassword123!):');
  for (const sv of supervisors) console.log(`  - ${sv.email} (${sv.empId} ${sv.name}, ${sv.team})`);
  console.log('  - op-emp001..emp012@aipajak.com (12 operators)');
}

interface CaseSeed {
  caseCode: string;
  customerName: string;
  customerNpwp: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  serviceLabel: string;
  taxType: string;        // PPh21 / PPh23 / PPh25 / PPN / SPT_TAHUNAN / etc
  status: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  operatorEmpId: string | null;
  supervisorEmpId: string | null;
  dueDays: number | null; // relative to today
  amount: number;
  // Period override (otherwise current month/year). Lets us distinguish multiple
  // cases for the same customer-taxType pair (UNIQUE constraint).
  monthOffset?: number;
  yearOverride?: number;
}

const cases: CaseSeed[] = [
  // PDF 업무 배정/회수 화면의 6개 좌측 케이스를 그대로 재현.
  { caseCode: 'REQ-NEW-001', customerName: 'PT Baru Masuk',     customerNpwp: '01.000.001.0-001.000', customerType: 'COMPANY',
    serviceLabel: 'SPT Masa 원천세', taxType: 'PPh23', status: 'DATA_REVIEW',      priority: 'URGENT', operatorEmpId: null,    supervisorEmpId: 'SUP002', dueDays: 0,  amount: 5_000_000 },
  { caseCode: 'REQ-REPEAT-001', customerName: 'PT Hijau Lumut', customerNpwp: '01.000.002.0-001.000', customerType: 'COMPANY',
    serviceLabel: 'SPT Masa 원천세', taxType: 'PPh23', status: 'DATA_REVIEW',      priority: 'HIGH',   operatorEmpId: null,    supervisorEmpId: 'SUP002', dueDays: 1,  amount: 7_200_000 },
  { caseCode: 'C-001',         customerName: 'PT Hijau Lumut',  customerNpwp: '01.000.002.0-001.000', customerType: 'COMPANY',
    serviceLabel: 'SPT Masa 원천세', taxType: 'PPh23', status: 'DATA_REVIEW',      priority: 'HIGH',   operatorEmpId: 'EMP001', supervisorEmpId: 'SUP002', dueDays: -1, amount: 13_000_000, monthOffset: -1 },
  { caseCode: 'C-001-2025',    customerName: 'PT Hijau Lumut',  customerNpwp: '01.000.002.0-001.000', customerType: 'COMPANY',
    serviceLabel: 'SPT Tahunan Badan Coretax 2025+', taxType: 'SPT_TAHUNAN', status: 'COMPLETED', priority: 'NORMAL', operatorEmpId: 'EMP001', supervisorEmpId: 'SUP002', dueDays: 30, amount: 0, monthOffset: 0, yearOverride: 2025 },
  { caseCode: 'C-002',         customerName: 'PT ABC',          customerNpwp: '01.000.003.0-001.000', customerType: 'COMPANY',
    serviceLabel: 'SPT Tahunan Badan Coretax 2025+', taxType: 'SPT_TAHUNAN', status: 'PENDING_APPROVAL', priority: 'URGENT', operatorEmpId: 'EMP001', supervisorEmpId: 'SUP002', dueDays: 2, amount: 22_000_000, monthOffset: 0, yearOverride: 2025 },
  { caseCode: 'C-003',         customerName: 'PT Konstruksi Jaya', customerNpwp: '01.000.004.0-001.000', customerType: 'COMPANY',
    serviceLabel: 'SPT Masa 원천세', taxType: 'PPh23', status: 'PENDING_DOCS',     priority: 'NORMAL', operatorEmpId: 'EMP002', supervisorEmpId: 'SUP002', dueDays: 5,  amount: 3_500_000 },
  { caseCode: 'C-004',         customerName: 'Budi Santoso',    customerNpwp: '01.000.005.0-001.000', customerType: 'INDIVIDUAL',
    serviceLabel: 'SPT Masa 원천세', taxType: 'PPh23', status: 'PENDING',          priority: 'NORMAL', operatorEmpId: null,    supervisorEmpId: 'SUP003', dueDays: 7,  amount: 1_200_000 },
];

async function ensureCustomer(c: CaseSeed): Promise<string> {
  const npwpDigits = c.customerNpwp.replace(/\D/g, '');
  const { data: existing } = await admin
    .from('customer')
    .select('id')
    .eq('npwp', npwpDigits)
    .maybeSingle();
  if (existing) return existing.id;
  const payload: Record<string, unknown> = {
    customer_type: c.customerType,
    full_name: c.customerName,
    company_name: c.customerType === 'COMPANY' ? c.customerName : null,
    npwp: npwpDigits,
    email: `${c.caseCode.toLowerCase()}@example.com`,
    is_pkp: false,
  };
  const { data, error } = await admin.from('customer').insert(payload).select('id').single();
  if (error || !data) throw new Error(`customer insert failed for ${c.customerName}: ${error?.message}`);
  return data.id;
}

async function seedCases(
  supEmpToId: Map<string, string>,
  opEmpToId: Map<string, string>,
): Promise<void> {
  const today = new Date();
  for (const c of cases) {
    const customerId = await ensureCustomer(c);
    const due = c.dueDays != null
      ? new Date(today.getTime() + c.dueDays * 86_400_000).toISOString().slice(0, 10)
      : null;
    const operatorId = c.operatorEmpId ? opEmpToId.get(c.operatorEmpId) ?? null : null;
    const supervisorId = c.supervisorEmpId ? supEmpToId.get(c.supervisorEmpId) ?? null : null;
    const periodDate = new Date(today.getFullYear(), today.getMonth() + (c.monthOffset ?? 0), 1);
    const month = periodDate.getMonth() + 1;
    const year = c.yearOverride ?? periodDate.getFullYear();

    const payload = {
      customer_id: customerId,
      case_code: c.caseCode,
      service_label: c.serviceLabel,
      tax_type: c.taxType,
      tax_period_month: month,
      tax_period_year: year,
      amount: c.amount,
      status: c.status,
      priority: c.priority,
      operator_id: operatorId,
      supervisor_id: supervisorId,
      due_date: due,
      assigned_at: operatorId ? new Date().toISOString() : null,
    };

    const { data: existing } = await admin
      .from('djp_submission_queue')
      .select('id')
      .eq('case_code', c.caseCode)
      .maybeSingle();
    if (existing) {
      await admin.from('djp_submission_queue').update(payload).eq('id', existing.id);
    } else {
      const { error } = await admin.from('djp_submission_queue').insert(payload);
      if (error) console.warn(`  ! case ${c.caseCode} insert: ${error.message}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
