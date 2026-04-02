/**
 * Seed Operator Test Data
 *
 * Run with: npx tsx scripts/seed-operator-test.ts
 *
 * Creates:
 * - 1 TAX_OPERATOR_SUPERVISOR account
 * - 3 TAX_OPERATOR accounts
 * - tax_operators profiles
 * - operator-customer assignments
 * - djp_submission_queue items (various statuses)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OPERATOR_USERS = [
  {
    email: 'supervisor.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'TAX_OPERATOR_SUPERVISOR',
    name: 'Kim Supervisor',
    employee_id: 'EMP-SUP-001',
    operatorRole: 'tax_operator_supervisor',
  },
  {
    email: 'operator1.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'TAX_OPERATOR',
    name: 'Lee Operator',
    employee_id: 'EMP-OP-001',
    operatorRole: 'tax_operator',
  },
  {
    email: 'operator2.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'TAX_OPERATOR',
    name: 'Park Operator',
    employee_id: 'EMP-OP-002',
    operatorRole: 'tax_operator',
  },
  {
    email: 'operator3.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'TAX_OPERATOR',
    name: 'Choi Operator',
    employee_id: 'EMP-OP-003',
    operatorRole: 'tax_operator',
  },
];

const TAX_TYPES = ['PPh21', 'PPh23', 'PPN', 'PPh25'];
const STATUSES = ['PENDING', 'DATA_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING'];

async function createOrGetUser(email: string, password: string, fullName: string, role: string) {
  const { data: users } = await supabase.auth.admin.listUsers();
  let user = users?.users?.find(u => u.email === email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) {
      console.error(`❌ Failed to create ${email}:`, error.message);
      return null;
    }
    user = data.user;
    console.log(`✅ Created user: ${email} (${role})`);
  } else {
    console.log(`⏭️  User ${email} already exists`);
  }

  // Upsert role
  await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', role);
  const { error: roleErr } = await supabase.from('user_roles').insert({
    user_id: user.id,
    role,
    is_active: true,
  });
  if (roleErr) console.error(`   ⚠️  Role error:`, roleErr.message);
  else console.log(`   ✅ Role: ${role}`);

  return user;
}

async function main() {
  console.log('🌱 Seeding operator test data...\n');

  // 1. Create operator users
  const operatorProfiles: Array<{ userId: string; email: string; name: string; employeeId: string; operatorRole: string }> = [];

  for (const op of OPERATOR_USERS) {
    const user = await createOrGetUser(op.email, op.password, op.name, op.role);
    if (user) {
      operatorProfiles.push({
        userId: user.id,
        email: op.email,
        name: op.name,
        employeeId: op.employee_id,
        operatorRole: op.operatorRole,
      });
    }
  }

  // 2. Create tax_operators profiles
  console.log('\n📋 Creating operator profiles...');
  const operatorIds: string[] = [];

  for (const op of operatorProfiles) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('tax_operators')
      .select('id')
      .eq('user_id', op.userId)
      .maybeSingle();

    if (existing) {
      console.log(`   ⏭️  ${op.name} profile exists (${existing.id})`);
      operatorIds.push(existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from('tax_operators')
      .insert({
        user_id: op.userId,
        employee_id: op.employeeId,
        name: op.name,
        email: op.email,
        role: op.operatorRole,
        max_clients: 35,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ ${op.name}:`, error.message);
    } else {
      console.log(`   ✅ ${op.name} (${data.id})`);
      operatorIds.push(data.id);
    }
  }

  // 3. Get customer ID
  const customerId = '00000000-0000-0000-0000-000000000010';

  // 4. Assign customer to operator1
  if (operatorIds.length > 1) {
    console.log('\n🔗 Creating assignments...');
    const { error: assignErr } = await supabase
      .from('operator_client_assignments')
      .upsert({
        operator_id: operatorIds[1], // operator1
        customer_id: customerId,
        assigned_date: new Date().toISOString().split('T')[0],
        is_active: true,
      }, { onConflict: 'operator_id,customer_id,assigned_date' });

    if (assignErr) console.error('   ⚠️  Assignment:', assignErr.message);
    else console.log(`   ✅ Customer → ${OPERATOR_USERS[1].name}`);
  }

  // 5. Create queue items
  console.log('\n📦 Creating queue items...');
  const now = new Date();

  for (let i = 0; i < 15; i++) {
    const opIndex = i < 4 ? 1 : i < 8 ? 2 : i < 12 ? 3 : 0; // distribute across operators, some unassigned
    const operatorId = opIndex > 0 && operatorIds[opIndex] ? operatorIds[opIndex] : null;
    const status = i < 12 ? STATUSES[i % STATUSES.length] : 'PENDING'; // last 3 are PENDING+unassigned
    const month = ((i % 12) + 1);

    const { error } = await supabase
      .from('djp_submission_queue')
      .upsert({
        operator_id: operatorId,
        customer_id: customerId,
        tax_type: TAX_TYPES[i % TAX_TYPES.length],
        tax_period_month: month,
        tax_period_year: 2026,
        amount: Math.round((500000 + Math.random() * 5000000) / 1000) * 1000,
        status,
        assigned_at: operatorId ? now.toISOString() : null,
        notes: i === 0 ? 'First test item' : null,
      }, { onConflict: 'customer_id,tax_type,tax_period_month,tax_period_year' });

    if (error) {
      console.error(`   ⚠️  Queue item ${i + 1}:`, error.message);
    } else {
      const assignedTo = operatorId ? OPERATOR_USERS[opIndex].name : '(미배정)';
      console.log(`   ✅ ${TAX_TYPES[i % TAX_TYPES.length]} ${month}월 [${status}] → ${assignedTo}`);
    }
  }

  console.log('\n✨ Operator test data seeding complete!\n');
  console.log('테스트 계정:');
  console.log('┌──────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 역할                    │ 이메일                                │ 비밀번호         │');
  console.log('├──────────────────────────────────────────────────────────────────────────┤');
  for (const op of OPERATOR_USERS) {
    console.log(`│ ${op.role.padEnd(23)} │ ${op.email.padEnd(37)} │ ${op.password} │`);
  }
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  console.log('\n테스트 방법:');
  console.log('1. 수퍼바이저로 로그인: supervisor.test@jakartatax.co.id');
  console.log('2. 상담원 메뉴에서 "워크로드 관리" → 미배정 건 확인 → "자동 배분" 클릭');
  console.log('3. "성과 통계" → 상담원별 순위 확인');
  console.log('4. "제출 대기열" → 아이템 확장 → "재배정" 클릭');
  console.log('5. 상담원으로 로그인: operator1.test@jakartatax.co.id');
  console.log('6. 대시보드에서 배정된 건 확인 → 상태 전환 테스트');
}

main().catch(console.error);
