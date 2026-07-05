/**
 * Playwright Global Setup
 *
 * Sets up test users and data via Supabase Admin API before all tests run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test user definitions
const TEST_USERS = [
  {
    email: 'customer.test@example.com',
    password: 'TestPassword123!',
    role: 'CUSTOMER',
    fullName: 'John Doe Test',
    customerData: {
      customerType: 'INDIVIDUAL',
      npwp: '1234567890123456',
      phone: '+62-812-3456789',
      address: 'Jl. Test No. 1, Jakarta',
    },
  },
  {
    email: 'consultant.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'CONSULTANT',
    fullName: 'Jane Smith Consultant',
    consultantData: {
      phone: '+62-812-1111111',
    },
  },
  {
    email: 'advisor.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'TAX_ADVISOR',
    fullName: 'Bob Johnson Tax Advisor',
    consultantData: {
      phone: '+62-812-2222222',
    },
    taxAdvisorData: {
      licenseNumber: 'BREVET-A-12345',
      licenseType: 'Brevet A',
      licenseExpiryDate: '2030-12-31',
    },
  },
  {
    email: 'admin.test@aipajak.com',
    password: 'TestPassword123!',
    role: 'PLATFORM_ADMIN',
    fullName: 'Alice Admin',
  },
];

async function globalSetup() {
  console.log('\n✅ Environment variables loaded:');
  console.log(`   SUPABASE_URL: ${supabaseUrl}`);
  console.log(`   ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***' : 'MISSING'}\n`);

  // Write env vars to a temp file for workers to read
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    TEST_SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  fs.writeFileSync(path.resolve(process.cwd(), '.playwright-env.json'), JSON.stringify(envVars));

  console.log('🚀 Starting E2E test data setup...\n');

  try {
    // Get tax_partner ID (seeded in migrations)
    const { data: taxPartner } = await supabaseAdmin
      .from('tax_partner')
      .select('id')
      .eq('name', 'Jakarta Tax Consulting')
      .single();

    if (!taxPartner) {
      throw new Error('Tax partner not found. Did migrations run correctly?');
    }

    const taxPartnerId = taxPartner.id;
    console.log(`✅ Found tax partner: ${taxPartnerId}`);

    // Get platform ID
    const { data: platform } = await supabaseAdmin
      .from('platform')
      .select('id')
      .eq('name', 'AI Pajak')
      .single();

    if (!platform) {
      throw new Error('Platform not found. Did migrations run correctly?');
    }

    const platformId = platform.id;
    console.log(`✅ Found platform: ${platformId}`);

    // Store created IDs for later use
    const userIds: Record<string, string> = {};
    let customerId: string | null = null;
    let consultantId: string | null = null;
    let taxAdvisorConsultantId: string | null = null;

    // Clean up existing test data FIRST (before creating new data)
    // Find existing test customer
    const { data: existingCustomer } = await supabaseAdmin
      .from('customer')
      .select('id')
      .eq('email', 'customer.test@example.com')
      .single();

    if (existingCustomer) {
      console.log(`🧹 Cleaning up existing test data for customer: ${existingCustomer.id}`);

      // Delete audit logs first (to remove FK constraints)
      await supabaseAdmin
        .from('audit_log')
        .delete()
        .eq('customer_id', existingCustomer.id);

      await supabaseAdmin
        .from('tax_activity_log')
        .delete()
        .eq('customer_id', existingCustomer.id);

      // Delete billing transactions
      await supabaseAdmin
        .from('billing_transaction')
        .delete()
        .eq('customer_id', existingCustomer.id);

      // Delete tax filings
      await supabaseAdmin
        .from('tax_filing')
        .delete()
        .eq('customer_id', existingCustomer.id);

      console.log('✅ Cleaned up existing test data');
    }

    // Create users via Auth Admin API
    for (const user of TEST_USERS) {
      console.log(`\n📧 Setting up user: ${user.email}`);

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      let userId: string;

      if (existingUser) {
        console.log(`   User already exists: ${existingUser.id}`);
        userId = existingUser.id;

        // Update password to ensure it's correct
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: user.password,
          email_confirm: true,
        });
      } else {
        // Create new user
        const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.fullName,
          },
        });

        if (error) {
          console.error(`   ❌ Failed to create user: ${error.message}`);
          continue;
        }

        userId = newUser.user!.id;
        console.log(`   ✅ Created user: ${userId}`);
      }

      userIds[user.email] = userId;

      // Create role-specific data
      if (user.role === 'CUSTOMER' && user.customerData) {
        // Create or update customer
        const { data: existingCustomer } = await supabaseAdmin
          .from('customer')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log(`   Customer already exists: ${customerId}`);
        } else {
          const { data: newCustomer, error } = await supabaseAdmin
            .from('customer')
            .insert({
              user_id: userId,
              customer_type: user.customerData.customerType,
              npwp: user.customerData.npwp,
              full_name: user.fullName,
              email: user.email,
              phone: user.customerData.phone,
              address: user.customerData.address,
            })
            .select('id')
            .single();

          if (error) {
            console.error(`   ❌ Failed to create customer: ${error.message}`);
          } else {
            customerId = newCustomer!.id;
            console.log(`   ✅ Created customer: ${customerId}`);
          }
        }
      }

      if ((user.role === 'CONSULTANT' || user.role === 'TAX_ADVISOR') && user.consultantData) {
        // Create or update consultant
        const { data: existingConsultant } = await supabaseAdmin
          .from('consultant')
          .select('id')
          .eq('user_id', userId)
          .single();

        let currentConsultantId: string;

        if (existingConsultant) {
          currentConsultantId = existingConsultant.id;
          console.log(`   Consultant already exists: ${currentConsultantId}`);
        } else {
          const { data: newConsultant, error } = await supabaseAdmin
            .from('consultant')
            .insert({
              user_id: userId,
              tax_partner_id: taxPartnerId,
              full_name: user.fullName,
              email: user.email,
              phone: user.consultantData.phone,
              is_active: true,
              employment_start_date: '2025-01-01',
            })
            .select('id')
            .single();

          if (error) {
            console.error(`   ❌ Failed to create consultant: ${error.message}`);
            continue;
          } else {
            currentConsultantId = newConsultant!.id;
            console.log(`   ✅ Created consultant: ${currentConsultantId}`);
          }
        }

        if (user.role === 'CONSULTANT') {
          consultantId = currentConsultantId;
        } else {
          taxAdvisorConsultantId = currentConsultantId;
        }

        // Create tax_advisor record for TAX_ADVISOR
        if (user.role === 'TAX_ADVISOR' && user.taxAdvisorData) {
          const { data: existingAdvisor } = await supabaseAdmin
            .from('tax_advisor')
            .select('id')
            .eq('consultant_id', currentConsultantId)
            .single();

          if (existingAdvisor) {
            console.log(`   Tax advisor already exists: ${existingAdvisor.id}`);
          } else {
            const { error } = await supabaseAdmin
              .from('tax_advisor')
              .insert({
                consultant_id: currentConsultantId,
                license_number: user.taxAdvisorData.licenseNumber,
                license_type: user.taxAdvisorData.licenseType,
                license_expiry_date: user.taxAdvisorData.licenseExpiryDate,
                is_verified: true,
              });

            if (error) {
              console.error(`   ❌ Failed to create tax advisor: ${error.message}`);
            } else {
              console.log(`   ✅ Created tax advisor`);
            }
          }
        }
      }

      // Create user_role record
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', user.role)
        .single();

      if (!existingRole) {
        const organizationId = user.role === 'PLATFORM_ADMIN'
          ? platformId
          : (user.role === 'CUSTOMER' ? null : taxPartnerId);

        const organizationType = user.role === 'PLATFORM_ADMIN'
          ? 'PLATFORM'
          : (user.role === 'CUSTOMER' ? null : 'TAX_PARTNER');

        const { error } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role: user.role,
            organization_id: organizationId,
            organization_type: organizationType,
            is_active: true,
          });

        if (error) {
          console.error(`   ❌ Failed to create user role: ${error.message}`);
        } else {
          console.log(`   ✅ Created user role: ${user.role}`);
        }
      } else {
        console.log(`   User role already exists`);
      }
    }

    // Create customer-consultant assignments
    if (customerId && consultantId) {
      const { data: existingAssignment } = await supabaseAdmin
        .from('customer_consultant')
        .select('id')
        .eq('customer_id', customerId)
        .eq('consultant_id', consultantId)
        .single();

      if (!existingAssignment) {
        await supabaseAdmin
          .from('customer_consultant')
          .insert({
            customer_id: customerId,
            consultant_id: consultantId,
            is_active: true,
          });
        console.log('\n✅ Created customer-consultant assignment (consultant)');
      }
    }

    if (customerId && taxAdvisorConsultantId) {
      const { data: existingAssignment } = await supabaseAdmin
        .from('customer_consultant')
        .select('id')
        .eq('customer_id', customerId)
        .eq('consultant_id', taxAdvisorConsultantId)
        .single();

      if (!existingAssignment) {
        await supabaseAdmin
          .from('customer_consultant')
          .insert({
            customer_id: customerId,
            consultant_id: taxAdvisorConsultantId,
            is_active: true,
          });
        console.log('✅ Created customer-consultant assignment (tax advisor)');
      }
    }

    // Store POA IDs
    let activePoaId: string | null = null;
    let draftPoaId: string | null = null;
    let pendingPoaId: string | null = null;
    let unsignedDraftPoaId: string | null = null; // Separate DRAFT POA that stays DRAFT
    let scopeMismatchCustomerId: string | null = null; // Customer with PPh23_ONLY POA
    let scopeMismatchPoaId: string | null = null; // POA that belongs to another customer (PPh23_ONLY)

    // Create POAs
    if (customerId) {
      // Create ACTIVE POA
      const { data: existingActivePoa } = await supabaseAdmin
        .from('power_of_attorney')
        .select('id, status')
        .eq('poa_number', 'POA-TEST-2025-001')
        .single();

      if (existingActivePoa) {
        activePoaId = existingActivePoa.id;
        // Reset status to ACTIVE if changed by tests
        if (existingActivePoa.status !== 'ACTIVE') {
          await supabaseAdmin
            .from('power_of_attorney')
            .update({ status: 'ACTIVE' })
            .eq('id', activePoaId);
          console.log(`   ACTIVE POA reset to ACTIVE: ${activePoaId}`);
        } else {
          console.log(`   ACTIVE POA already exists: ${activePoaId}`);
        }
      } else {
        const { data: newActivePoa } = await supabaseAdmin
          .from('power_of_attorney')
          .insert({
            poa_number: 'POA-TEST-2025-001',
            customer_id: customerId,
            tax_partner_id: taxPartnerId,
            scope: 'ALL_TAX_TYPES',
            valid_from: '2025-01-01',
            valid_to: '2026-12-31',
            document_url: 'https://storage.test/poa-active.pdf',
            status: 'ACTIVE',
            customer_signed_at: new Date('2025-01-15T10:00:00Z'),
            customer_signature_url: 'https://storage.test/sig1.png',
            tax_partner_signed_at: new Date('2025-01-15T14:00:00Z'),
            tax_partner_signed_by_user_id: userIds['advisor.test@jakartatax.co.id'],
            tax_partner_signature_url: 'https://storage.test/sig2.png',
          })
          .select('id')
          .single();
        activePoaId = newActivePoa?.id || null;
        console.log(`✅ Created ACTIVE POA: ${activePoaId}`);
      }

      // Create DRAFT POA (used by customer to sign, becomes PENDING_SIGNATURE)
      const { data: existingDraftPoa } = await supabaseAdmin
        .from('power_of_attorney')
        .select('id, status')
        .eq('poa_number', 'POA-TEST-2025-002')
        .single();

      if (existingDraftPoa) {
        draftPoaId = existingDraftPoa.id;
        // Reset status to DRAFT if changed by tests
        if (existingDraftPoa.status !== 'DRAFT') {
          await supabaseAdmin
            .from('power_of_attorney')
            .update({
              status: 'DRAFT',
              customer_signed_at: null,
              customer_signature_url: null,
              tax_partner_signed_at: null,
              tax_partner_signature_url: null,
              tax_partner_signed_by_user_id: null,
            })
            .eq('id', draftPoaId);
          console.log(`   DRAFT POA reset to DRAFT: ${draftPoaId}`);
        } else {
          console.log(`   DRAFT POA already exists: ${draftPoaId}`);
        }
      } else {
        const { data: newDraftPoa } = await supabaseAdmin
          .from('power_of_attorney')
          .insert({
            poa_number: 'POA-TEST-2025-002',
            customer_id: customerId,
            tax_partner_id: taxPartnerId,
            scope: 'ALL_TAX_TYPES',
            valid_from: '2025-01-01',
            valid_to: '2026-12-31',
            document_url: 'https://storage.test/poa-draft.pdf',
            status: 'DRAFT',
          })
          .select('id')
          .single();
        draftPoaId = newDraftPoa?.id || null;
        console.log(`✅ Created DRAFT POA: ${draftPoaId}`);
      }

      // Create PENDING_SIGNATURE POA (used by advisor to sign, becomes ACTIVE)
      const { data: existingPendingPoa } = await supabaseAdmin
        .from('power_of_attorney')
        .select('id, status')
        .eq('poa_number', 'POA-TEST-2025-003')
        .single();

      if (existingPendingPoa) {
        pendingPoaId = existingPendingPoa.id;
        // Reset status to PENDING_SIGNATURE if changed by tests
        if (existingPendingPoa.status !== 'PENDING_SIGNATURE') {
          await supabaseAdmin
            .from('power_of_attorney')
            .update({
              status: 'PENDING_SIGNATURE',
              customer_signed_at: new Date('2025-01-10T10:00:00Z'),
              customer_signature_url: 'https://storage.test/sig3.png',
              tax_partner_signed_at: null,
              tax_partner_signature_url: null,
              tax_partner_signed_by_user_id: null,
            })
            .eq('id', pendingPoaId);
          console.log(`   PENDING_SIGNATURE POA reset: ${pendingPoaId}`);
        } else {
          console.log(`   PENDING_SIGNATURE POA already exists: ${pendingPoaId}`);
        }
      } else {
        const { data: newPendingPoa } = await supabaseAdmin
          .from('power_of_attorney')
          .insert({
            poa_number: 'POA-TEST-2025-003',
            customer_id: customerId,
            tax_partner_id: taxPartnerId,
            scope: 'ALL_TAX_TYPES',
            valid_from: '2025-01-01',
            valid_to: '2026-12-31',
            document_url: 'https://storage.test/poa-pending.pdf',
            status: 'PENDING_SIGNATURE',
            customer_signed_at: new Date('2025-01-10T10:00:00Z'),
            customer_signature_url: 'https://storage.test/sig3.png',
          })
          .select('id')
          .single();
        pendingPoaId = newPendingPoa?.id || null;
        console.log(`✅ Created PENDING_SIGNATURE POA: ${pendingPoaId}`);
      }

      // Create PPh23-ONLY POA customer (for testing scope mismatch)
      const { data: existingScopeMismatchCustomer } = await supabaseAdmin
        .from('customer')
        .select('id')
        .eq('email', 'scope-mismatch.test@example.com')
        .single();

      if (existingScopeMismatchCustomer) {
        scopeMismatchCustomerId = existingScopeMismatchCustomer.id;
        console.log(`   Scope mismatch customer already exists: ${scopeMismatchCustomerId}`);
      } else {
        // Create an auth user for scope mismatch customer
        const { data: scopeMismatchUser } = await supabaseAdmin.auth.admin.createUser({
          email: 'scope-mismatch.test@example.com',
          password: 'TestPassword123!',
          email_confirm: true,
          user_metadata: { full_name: 'Scope Mismatch Customer' },
        });

        if (scopeMismatchUser?.user) {
          const { data: newScopeMismatchCustomer } = await supabaseAdmin
            .from('customer')
            .insert({
              user_id: scopeMismatchUser.user.id,
              customer_type: 'INDIVIDUAL',
              npwp: '9999888877776666',
              full_name: 'Scope Mismatch Customer',
              email: 'scope-mismatch.test@example.com',
              phone: '+62-812-9999999',
              address: 'Jl. Scope Test No. 1, Jakarta',
            })
            .select('id')
            .single();

          scopeMismatchCustomerId = newScopeMismatchCustomer?.id || null;

          // Create customer role
          if (scopeMismatchCustomerId) {
            await supabaseAdmin.from('user_roles').insert({
              user_id: scopeMismatchUser.user.id,
              role: 'CUSTOMER',
              is_active: true,
            });

            // Create customer-consultant assignment
            if (taxAdvisorConsultantId) {
              await supabaseAdmin.from('customer_consultant').insert({
                customer_id: scopeMismatchCustomerId,
                consultant_id: taxAdvisorConsultantId,
                is_active: true,
              });
            }
          }

          console.log(`✅ Created scope mismatch customer: ${scopeMismatchCustomerId}`);
        }
      }

      // Create PPh23_ONLY POA for scope mismatch testing
      if (scopeMismatchCustomerId) {
        const { data: existingPPh23Poa } = await supabaseAdmin
          .from('power_of_attorney')
          .select('id, status')
          .eq('poa_number', 'POA-TEST-PPH23-ONLY')
          .single();

        if (existingPPh23Poa) {
          scopeMismatchPoaId = existingPPh23Poa.id;
          if (existingPPh23Poa.status !== 'ACTIVE') {
            await supabaseAdmin
              .from('power_of_attorney')
              .update({ status: 'ACTIVE' })
              .eq('id', existingPPh23Poa.id);
          }
          console.log(`   PPh23_ONLY POA already exists: ${existingPPh23Poa.id}`);
        } else {
          const { data: newPPh23Poa } = await supabaseAdmin
            .from('power_of_attorney')
            .insert({
              poa_number: 'POA-TEST-PPH23-ONLY',
              customer_id: scopeMismatchCustomerId,
              tax_partner_id: taxPartnerId,
              scope: 'PPh23_ONLY',
              valid_from: '2025-01-01',
              valid_to: '2026-12-31',
              document_url: 'https://storage.test/poa-pph23-only.pdf',
              status: 'ACTIVE',
              customer_signed_at: new Date('2025-01-15T10:00:00Z'),
              customer_signature_url: 'https://storage.test/sig-pph23.png',
              tax_partner_signed_at: new Date('2025-01-15T14:00:00Z'),
              tax_partner_signed_by_user_id: userIds['advisor.test@jakartatax.co.id'],
              tax_partner_signature_url: 'https://storage.test/sig-pph23-partner.png',
            })
            .select('id')
            .single();
          scopeMismatchPoaId = newPPh23Poa?.id || null;
          console.log(`✅ Created PPh23_ONLY POA: ${newPPh23Poa?.id}`);
        }
      }

      // Create UNSIGNED DRAFT POA (for testing that advisor cannot sign before customer)
      // This POA must ALWAYS stay in DRAFT status
      const { data: existingUnsignedDraftPoa } = await supabaseAdmin
        .from('power_of_attorney')
        .select('id, status')
        .eq('poa_number', 'POA-TEST-2025-004')
        .single();

      if (existingUnsignedDraftPoa) {
        unsignedDraftPoaId = existingUnsignedDraftPoa.id;
        // Reset status to DRAFT if changed
        if (existingUnsignedDraftPoa.status !== 'DRAFT') {
          await supabaseAdmin
            .from('power_of_attorney')
            .update({
              status: 'DRAFT',
              customer_signed_at: null,
              customer_signature_url: null,
              tax_partner_signed_at: null,
              tax_partner_signature_url: null,
              tax_partner_signed_by_user_id: null,
            })
            .eq('id', unsignedDraftPoaId);
          console.log(`   UNSIGNED DRAFT POA reset to DRAFT: ${unsignedDraftPoaId}`);
        } else {
          console.log(`   UNSIGNED DRAFT POA already exists: ${unsignedDraftPoaId}`);
        }
      } else {
        const { data: newUnsignedDraftPoa } = await supabaseAdmin
          .from('power_of_attorney')
          .insert({
            poa_number: 'POA-TEST-2025-004',
            customer_id: customerId,
            tax_partner_id: taxPartnerId,
            scope: 'ALL_TAX_TYPES',
            valid_from: '2025-01-01',
            valid_to: '2026-12-31',
            document_url: 'https://storage.test/poa-unsigned-draft.pdf',
            status: 'DRAFT',
          })
          .select('id')
          .single();
        unsignedDraftPoaId = newUnsignedDraftPoa?.id || null;
        console.log(`✅ Created UNSIGNED DRAFT POA: ${unsignedDraftPoaId}`);
      }
    }

    // Save created IDs to a file for tests to use
    const testData = {
      userIds,
      customerId,
      consultantId,
      taxAdvisorConsultantId,
      taxPartnerId,
      platformId,
      activePoaId,
      draftPoaId,
      pendingPoaId,
      unsignedDraftPoaId,
      scopeMismatchCustomerId,
      scopeMismatchPoaId,
    };
    fs.writeFileSync(
      path.resolve(process.cwd(), '.playwright-test-data.json'),
      JSON.stringify(testData, null, 2)
    );
    console.log('✅ Saved test data to .playwright-test-data.json');
    console.log(`   - activePoaId: ${activePoaId}`);
    console.log(`   - draftPoaId: ${draftPoaId}`);
    console.log(`   - pendingPoaId: ${pendingPoaId}`);
    console.log(`   - unsignedDraftPoaId: ${unsignedDraftPoaId}`);

    console.log('\n✨ E2E test data setup complete!\n');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

export default globalSetup;
