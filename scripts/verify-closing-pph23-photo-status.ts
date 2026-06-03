/**
 * Verify GET /api/tax/annual-closing/[id]/pph23-photo-status contract:
 *
 *   1. Login as company.test (COMPANY customer) + sanity check
 *   2. Pre-cleanup sentinel year 2097 + create sentinel closing_session
 *   3. Seed: 2× pph23_transaction (both without invoice_document_id) +
 *      1× pph23_transaction with invoice_document_id pointing to a seeded
 *      document row. Three counterparties to verify groupBy ordering.
 *   4. GET /pph23-photo-status → 200, total=3, attached=1, missing=2,
 *      attachedPct=33, counterparties sorted by missing desc, top counterparty
 *      is the one with the most missing rows.
 *   5. Cleanup (transactions + document + session)
 *
 * Uses sentinel fiscal_year 2097 + tax_period '2097-MM' to avoid colliding
 * with verify-closing-auto-credits.ts (which uses 2098) and real prod data.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-closing-pph23-photo-status.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) {
  console.error(`✗ ${envFile} not found`);
  process.exit(1);
}
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const FISCAL_YEAR = 2097; // sentinel (auto-credits uses 2098)
const PERIOD_PREFIX = `${FISCAL_YEAR}-`;

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  let pass = 0;
  let fail = 0;
  let seededDocId: string | null = null;
  let sessId: string | null = null;
  let custId: string | null = null;

  try {
    // 1. Auth
    const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (authErr || !auth.session) {
      console.error('✗ login:', authErr?.message);
      process.exit(1);
    }
    const token = auth.session.access_token;
    const { data: cust } = await sbAdmin
      .from('customer')
      .select('id')
      .eq('user_id', auth.user!.id)
      .maybeSingle();
    if (!cust) {
      console.error('✗ no customer');
      process.exit(1);
    }
    custId = cust.id;
    console.log(`✅ 1. login + customer ${cust.id}`);
    pass++;

    // 2. Pre-cleanup + sentinel closing_session
    await sbAdmin
      .from('pph23_transaction')
      .delete()
      .eq('customer_id', cust.id)
      .like('tax_period', `${PERIOD_PREFIX}%`);
    await sbAdmin
      .from('tax_closing_session')
      .delete()
      .eq('customer_id', cust.id)
      .eq('fiscal_year', FISCAL_YEAR);

    const { data: sess, error: sessErr } = await sbAdmin
      .from('tax_closing_session')
      .insert({
        customer_id: cust.id,
        fiscal_year: FISCAL_YEAR,
        closing_type: 'PPH25',
        current_step: 'collect',
        status: 'IN_PROGRESS',
        data: {},
        signed_statements_uploaded: false,
      })
      .select()
      .single();
    if (sessErr || !sess) {
      console.error('✗ 2. create closing_session:', sessErr?.message);
      process.exit(1);
    }
    sessId = sess.id;
    console.log(`✅ 2. pre-cleanup + sentinel closing_session ${sess.id} (fiscal_year=${FISCAL_YEAR})`);
    pass++;

    // 3. Seed: 1 document + 3 pph23_transaction (1 attached, 2 missing)
    const { data: doc, error: docErr } = await sbAdmin
      .from('document')
      .insert({
        customer_id: cust.id,
        uploaded_by_user_id: auth.user!.id,
        document_type: 'OTHER',
        file_path: `sentinel/${cust.id}/pph23-${FISCAL_YEAR}.png`,
        file_name: 'sentinel-pph23-invoice.png',
        mime_type: 'image/png',
        file_size_bytes: 1024,
      })
      .select()
      .single();
    if (docErr || !doc) {
      console.error('✗ 3a. seed document:', docErr?.message);
      await sbAdmin.from('tax_closing_session').delete().eq('id', sess.id);
      process.exit(1);
    }
    seededDocId = doc.id;

    const seedTx = await sbAdmin.from('pph23_transaction').insert([
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}01`,
        transaction_date: `${FISCAL_YEAR}-01-15`,
        counterparty_name: 'COUNTERPARTY ALPHA',
        counterparty_npwp: '01.111.111.1-111.000',
        service_type: 'jasa_lain',
        gross_amount: 10_000_000,
        tax_rate: 0.02,
        tax_amount: 200_000,
        invoice_document_id: doc.id,
      },
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}02`,
        transaction_date: `${FISCAL_YEAR}-02-15`,
        counterparty_name: 'COUNTERPARTY BRAVO',
        counterparty_npwp: '02.222.222.2-222.000',
        service_type: 'jasa_lain',
        gross_amount: 5_000_000,
        tax_rate: 0.02,
        tax_amount: 100_000,
      },
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}03`,
        transaction_date: `${FISCAL_YEAR}-03-15`,
        counterparty_name: 'COUNTERPARTY BRAVO',
        counterparty_npwp: '02.222.222.2-222.000',
        service_type: 'jasa_lain',
        gross_amount: 7_500_000,
        tax_rate: 0.02,
        tax_amount: 150_000,
      },
    ]);
    if (seedTx.error) {
      console.error('✗ 3b. seed transactions:', seedTx.error.message);
      process.exit(1);
    }
    console.log('✅ 3. seed 1 document + 3 pph23 transactions (1 attached + 2 missing)');
    pass++;

    // 4. GET → verify shape
    const res = await fetch(
      `${BASE_URL}/api/tax/annual-closing/${sess.id}/pph23-photo-status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: {
        total?: number;
        attached?: number;
        missing?: number;
        attachedPct?: number;
        counterparties?: Array<{
          name: string;
          npwp: string | null;
          total: number;
          attached: number;
          missing: number;
          missingAmount: number;
        }>;
        computedAt?: string;
      };
    };

    if (!res.ok || !json.success || !json.data) {
      console.error(
        `✗ 4. GET — status=${res.status} body=${JSON.stringify(json).slice(0, 300)}`,
      );
      fail++;
    } else {
      const d = json.data;
      const bravo = d.counterparties?.find((c) => c.npwp === '02.222.222.2-222.000');
      const alpha = d.counterparties?.find((c) => c.npwp === '01.111.111.1-111.000');
      const ok =
        d.total === 3 &&
        d.attached === 1 &&
        d.missing === 2 &&
        d.attachedPct === 33 &&
        d.counterparties?.length === 2 &&
        // sort: bravo (missing=2) before alpha (missing=0)
        d.counterparties?.[0]?.npwp === '02.222.222.2-222.000' &&
        bravo?.missing === 2 &&
        bravo?.missingAmount === 12_500_000 &&
        alpha?.attached === 1 &&
        alpha?.missing === 0 &&
        typeof d.computedAt === 'string';
      if (ok) {
        console.log(
          `✅ 4. shape OK: total=${d.total} attached=${d.attached} missing=${d.missing} ` +
            `pct=${d.attachedPct}% counterparties=${d.counterparties?.length} ` +
            `sortOrder[0]=bravo(missing=${bravo?.missing}, missingAmount=${bravo?.missingAmount})`,
        );
        pass++;
      } else {
        console.error('✗ 4. shape mismatch:', JSON.stringify(d).slice(0, 500));
        fail++;
      }
    }
  } finally {
    // 5. Cleanup
    if (custId) {
      await sbAdmin
        .from('pph23_transaction')
        .delete()
        .eq('customer_id', custId)
        .like('tax_period', `${PERIOD_PREFIX}%`);
    }
    if (sessId) {
      await sbAdmin.from('tax_closing_session').delete().eq('id', sessId);
    }
    if (seededDocId) {
      await sbAdmin.from('document').delete().eq('id', seededDocId);
    }
    console.log('✅ 5. cleanup');
    pass++;
  }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
