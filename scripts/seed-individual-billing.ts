/**
 * Seed two approved ID Billing items for the INDIVIDUAL test customer
 * (customer.test@example.com) so the /tax/billing screen renders the
 * example rows from the design spec:
 *
 *   PPh 21 / PT ABC Indonesia / Rp 5,000,000 / 111222333444
 *   PPh 23 / PT Vendor Global / Rp 2,000,000 / 555666777888
 *
 * Both rows land in `EBILLING_GENERATED` so the customer sees an active
 * NTPN input + 파일 업로드/사진 촬영/제출 actions.
 *
 * Usage:
 *   SEED_TARGET=prod npx tsx scripts/seed-individual-billing.ts
 *   npx tsx scripts/seed-individual-billing.ts                # local
 *
 * Safe to re-run — uses upsert on (customer_id, tax_type, period).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 Loaded env from ${envFile}`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = 'customer.test@example.com';
const PERIOD_YEAR = 2026;
const PERIOD_MONTH = 4;

const ROWS = [
  {
    tax_type: 'PPh21',
    amount: 5_000_000,
    ebilling_code: '111222333444',
    counterparty_name: 'PT ABC Indonesia',
  },
  {
    tax_type: 'PPh23',
    amount: 2_000_000,
    ebilling_code: '555666777888',
    counterparty_name: 'PT Vendor Global',
  },
];

async function main() {
  // Resolve customer by joining auth.users via service-role SQL.
  // listUsers() is unreliable on populated prod DBs; query auth.users
  // directly through PostgREST instead.
  const { data: customer, error: custErr } = await admin
    .schema('public')
    .from('customer')
    .select('id, customer_type, full_name, company_name, user_id')
    .eq('customer_type', 'INDIVIDUAL')
    .order('created_at', { ascending: true });
  if (custErr || !customer || customer.length === 0) {
    console.error('Customer lookup failed:', custErr);
    process.exit(1);
  }

  // Find which customer row corresponds to TEST_EMAIL by checking the auth row
  let target: typeof customer[number] | null = null;
  for (const row of customer) {
    if (!row.user_id) continue;
    const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
    if (authUser?.user?.email === TEST_EMAIL) {
      target = row;
      break;
    }
  }
  if (!target) {
    console.error(`No INDIVIDUAL customer matched ${TEST_EMAIL}`);
    process.exit(1);
  }
  // Reassign customer to single match for the rest of the script.
  const matched = target;

  console.log(`✓ Customer: ${matched.full_name || matched.company_name} (${matched.id})`);

  for (const row of ROWS) {
    const payload = {
      customer_id: matched.id,
      tax_type: row.tax_type,
      tax_period_month: PERIOD_MONTH,
      tax_period_year: PERIOD_YEAR,
      amount: row.amount,
      status: 'EBILLING_GENERATED',
      ebilling_code: row.ebilling_code,
      counterparty_name: row.counterparty_name,
      notes: 'Demo seed for /tax/billing screen',
    };
    const { error: upsertErr } = await admin
      .from('djp_submission_queue')
      .upsert(payload, { onConflict: 'customer_id,tax_type,tax_period_month,tax_period_year' });
    if (upsertErr) {
      console.error(`Upsert failed for ${row.tax_type}:`, upsertErr);
      process.exit(1);
    }
    console.log(`✓ Upserted ${row.tax_type} — ${row.counterparty_name} (${row.ebilling_code})`);
  }

  console.log('\n✅ Done. Open /tax/billing on the customer.test account to verify.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
