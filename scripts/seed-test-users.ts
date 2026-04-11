/**
 * Seed Test Users for E2E Testing
 *
 * Run with: npx tsx scripts/seed-test-users.ts
 *
 * Creates test users for RBAC E2E tests:
 * - CUSTOMER (INDIVIDUAL) — 개인 고객
 * - CUSTOMER (COMPANY)    — 법인 고객
 * - CONSULTANT_JTC
 * - TAX_ADVISOR_JTC
 * - PLATFORM_ADMIN
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
// SEED_TARGET=prod → .env.production.local, otherwise .env.local
const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 Loaded env from ${envFile}`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  {
    email: 'customer.test@example.com',
    password: 'TestPassword123!',
    user_metadata: {
      full_name: 'John Doe Test',
      role: 'CUSTOMER',
      customer_type: 'INDIVIDUAL',
    },
  },
  {
    email: 'company.test@example.com',
    password: 'TestPassword123!',
    user_metadata: {
      full_name: 'PT Example Indonesia',
      role: 'CUSTOMER',
      customer_type: 'COMPANY',
    },
  },
  {
    email: 'consultant.test@jakartatax.co.id',
    password: 'TestPassword123!',
    user_metadata: {
      full_name: 'Jane Smith Consultant',
      role: 'CONSULTANT_JTC',
    },
  },
  {
    email: 'advisor.test@jakartatax.co.id',
    password: 'TestPassword123!',
    user_metadata: {
      full_name: 'Bob Johnson Tax Advisor',
      role: 'TAX_ADVISOR_JTC',
    },
  },
  {
    email: 'admin.test@aipajak.com',
    password: 'TestPassword123!',
    user_metadata: {
      full_name: 'Alice Admin',
      role: 'PLATFORM_ADMIN',
    },
  },
];

async function seedTestUsers() {
  console.log('🌱 Seeding test users...\n');

  for (const user of TEST_USERS) {
    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === user.email);

      if (existingUser) {
        console.log(`⏭️  User ${user.email} already exists, updating role...`);

        // Delete existing role first
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', existingUser.id);

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: existingUser.id,
            role: user.user_metadata.role,
            is_active: true,
            organization_id: null,
            organization_type: null,
          });

        if (roleError) {
          console.error(`   ⚠️  Failed to set role:`, roleError.message);
        } else {
          console.log(`   ✅ Role set: ${user.user_metadata.role} (is_active: true)`);
        }
        continue;
      }

      // Create user
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: user.user_metadata,
      });

      if (error) {
        console.error(`❌ Failed to create ${user.email}:`, error.message);
      } else {
        console.log(`✅ Created user: ${user.email} (${user.user_metadata.role})`);

        // Insert into user_roles table with is_active = true
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: user.user_metadata.role,
            is_active: true,
            organization_id: null,
            organization_type: null,
          });

        if (roleError) {
          console.error(`   ⚠️  Failed to set role:`, roleError.message);
        } else {
          console.log(`   ✅ Role set: ${user.user_metadata.role} (is_active: true)`);
        }
      }
    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err);
    }
  }

  console.log('\n✨ Test user seeding complete!');
  console.log('\nTest accounts:');
  TEST_USERS.forEach((u) => {
    console.log(`  - ${u.email} / ${u.password} (${u.user_metadata.role})`);
  });

  // Create additional test data
  console.log('\n🌱 Creating additional test data...\n');
  await createTestData();
}

async function createTestData() {
  // Get user IDs
  const { data: users } = await supabase.auth.admin.listUsers();
  const customerUser = users?.users?.find(u => u.email === 'customer.test@example.com');
  const companyUser = users?.users?.find(u => u.email === 'company.test@example.com');
  const consultantUser = users?.users?.find(u => u.email === 'consultant.test@jakartatax.co.id');
  const advisorUser = users?.users?.find(u => u.email === 'advisor.test@jakartatax.co.id');

  if (!customerUser || !companyUser || !consultantUser || !advisorUser) {
    console.error('❌ Users not found');
    return;
  }

  // First, ensure platform_owner exists
  const platformOwnerId = '00000000-0000-0000-0000-000000000001';
  const { error: poError } = await supabase.from('platform_owner').upsert({
    id: platformOwnerId,
    name: 'Mono Flip Global',
    legal_name: 'PT Mono Flip Global',
    npwp: '0000000000000001',
  }, { onConflict: 'id' });

  if (poError) {
    console.error('❌ Platform owner creation error:', poError.message);
  } else {
    console.log('✅ Platform owner created: Mono Flip Global');
  }

  // Create platform
  const platformId = '00000000-0000-0000-0000-000000000002';
  const { error: platError } = await supabase.from('platform').upsert({
    id: platformId,
    platform_owner_id: platformOwnerId,
    name: 'AI Pajak',
    domain: 'ai-pajak.com',
    is_active: true,
  }, { onConflict: 'id' });

  if (platError) {
    console.error('❌ Platform creation error:', platError.message);
  } else {
    console.log('✅ Platform created: AI Pajak');
  }

  // Create tax_partner (Jakarta Tax Consulting)
  const taxPartnerId = '00000000-0000-0000-0000-000000000003';
  const { error: tpError } = await supabase.from('tax_partner').upsert({
    id: taxPartnerId,
    platform_id: platformId,
    name: 'Jakarta Tax Consulting',
    legal_name: 'PT Jakarta Tax Consulting',
    tax_license_number: 'TAX-LICENSE-JTC-001',
    npwp: '0000000000000002',
    email_domain: 'jakartatax.co.id',
    partnership_start_date: '2024-01-01',
    is_active: true,
  }, { onConflict: 'id' });

  if (tpError) {
    console.error('❌ Tax partner creation error:', tpError.message);
  } else {
    console.log('✅ Tax partner created: Jakarta Tax Consulting');
  }

  // Create INDIVIDUAL customer record
  const customerId = '00000000-0000-0000-0000-000000000010';
  const { error: customerError } = await supabase.from('customer').upsert({
    id: customerId,
    user_id: customerUser.id,
    customer_type: 'INDIVIDUAL',
    full_name: 'John Doe Test',
    email: 'customer.test@example.com',
    npwp: '1234567890123456',
  }, { onConflict: 'id' });

  if (customerError) {
    console.error('❌ Individual customer creation error:', customerError.message);
  } else {
    console.log('✅ Individual customer record created: John Doe Test');
  }

  // Create COMPANY customer record (법인 고객 테스트용)
  const companyCustomerId = '00000000-0000-0000-0000-000000000011';
  const { error: companyError } = await supabase.from('customer').upsert({
    id: companyCustomerId,
    user_id: companyUser.id,
    customer_type: 'COMPANY',
    full_name: 'PT Example Indonesia',
    company_name: 'PT Example Indonesia',
    email: 'company.test@example.com',
    npwp: '0123456789012000',
    address: 'Jl. Sudirman No. 1, Jakarta Pusat',
    // 기본 세무 프로필 — 완성도 50% 정도로 시작 (나머지는 UI에서 완성)
    business_category: 'SERVICE',
    legal_form: 'PT',
    established_year: 2020,
    annual_revenue: 5_000_000_000,
    revenue_year: 2025,
    has_employees: true,
    employee_count: 10,
    is_pkp: true,
    is_umkm: false,
    pays_service_fees: true,
  }, { onConflict: 'id' });

  if (companyError) {
    console.error('❌ Company customer creation error:', companyError.message);
  } else {
    console.log('✅ Company customer record created: PT Example Indonesia');
  }

  // Create consultant record for CONSULTANT_JTC user
  const consultantId = '00000000-0000-0000-0000-000000000020';
  const { error: consultantError } = await supabase.from('consultant').upsert({
    id: consultantId,
    tax_partner_id: taxPartnerId,
    user_id: consultantUser.id,
    full_name: 'Jane Smith Consultant',
    email: 'consultant.test@jakartatax.co.id',
    employment_start_date: '2024-01-01',
    is_active: true,
  }, { onConflict: 'id' });

  if (consultantError) {
    console.error('❌ Consultant creation error:', consultantError.message);
  } else {
    console.log('✅ Consultant record created: Jane Smith Consultant');
  }

  // Create consultant record for TAX_ADVISOR_JTC user (consultant is required before tax_advisor)
  const advisorConsultantId = '00000000-0000-0000-0000-000000000021';
  const { error: advisorConsultantError } = await supabase.from('consultant').upsert({
    id: advisorConsultantId,
    tax_partner_id: taxPartnerId,
    user_id: advisorUser.id,
    full_name: 'Bob Johnson Tax Advisor',
    email: 'advisor.test@jakartatax.co.id',
    employment_start_date: '2024-01-01',
    is_active: true,
  }, { onConflict: 'id' });

  if (advisorConsultantError) {
    console.error('❌ Advisor consultant record creation error:', advisorConsultantError.message);
  } else {
    console.log('✅ Advisor consultant record created: Bob Johnson Tax Advisor');
  }

  // Create tax_advisor record (linked to consultant)
  const taxAdvisorId = '00000000-0000-0000-0000-000000000030';
  const { error: advisorError } = await supabase.from('tax_advisor').upsert({
    id: taxAdvisorId,
    consultant_id: advisorConsultantId,
    license_number: 'BREVET-A-12345',
    license_type: 'Brevet A',
    is_verified: true,
  }, { onConflict: 'id' });

  if (advisorError) {
    console.error('❌ Tax advisor creation error:', advisorError.message);
  } else {
    console.log('✅ Tax advisor record created: Bob Johnson Tax Advisor');
  }

  // Delete existing assignments before creating new ones
  await supabase.from('customer_consultant')
    .delete()
    .in('customer_id', [customerId, companyCustomerId]);

  // Create customer-consultant assignment (개인 고객)
  const { error: assignmentError } = await supabase.from('customer_consultant').insert({
    customer_id: customerId,
    consultant_id: consultantId,
    is_active: true,
  });

  if (assignmentError) {
    console.error('❌ Assignment error:', assignmentError.message);
  } else {
    console.log('✅ Individual Customer-Consultant assignment created');
  }

  // Create customer-advisor assignment (개인 고객)
  const { error: advisorAssignmentError } = await supabase.from('customer_consultant').insert({
    customer_id: customerId,
    consultant_id: advisorConsultantId,
    is_active: true,
  });

  if (advisorAssignmentError) {
    console.error('❌ Advisor assignment error:', advisorAssignmentError.message);
  } else {
    console.log('✅ Individual Customer-Advisor assignment created');
  }

  // Create company customer-consultant assignments (법인 고객)
  const { error: companyAssignmentError } = await supabase.from('customer_consultant').insert([
    { customer_id: companyCustomerId, consultant_id: consultantId, is_active: true },
    { customer_id: companyCustomerId, consultant_id: advisorConsultantId, is_active: true },
  ]);

  if (companyAssignmentError) {
    console.error('❌ Company assignment error:', companyAssignmentError.message);
  } else {
    console.log('✅ Company Customer-Consultant/Advisor assignments created');
  }

  // Delete existing POAs before creating new ones
  await supabase.from('power_of_attorney')
    .delete()
    .eq('customer_id', customerId);

  // Create active POA with fixed ID for testing
  const poaId = '00000000-0000-0000-0000-000000000100';
  const { error: poaError } = await supabase.from('power_of_attorney').upsert({
    id: poaId,
    poa_number: 'POA-TEST-2025-001',
    customer_id: customerId,
    tax_partner_id: taxPartnerId,
    scope: 'ALL_TAX_TYPES',
    valid_from: '2025-01-01',
    valid_to: '2026-12-31',
    document_url: 'https://storage.example.com/poa/test-poa.pdf',
    status: 'ACTIVE',
    customer_signed_at: '2025-01-15T10:00:00Z',
    tax_partner_signed_at: '2025-01-15T14:00:00Z',
    tax_partner_signed_by_user_id: advisorUser.id,
  }, { onConflict: 'id' });

  if (poaError) {
    console.error('❌ POA creation error:', poaError.message);
  } else {
    console.log('✅ Active POA created');
  }

  console.log('\n✨ Test data creation complete!');
}

seedTestUsers().catch(console.error);
