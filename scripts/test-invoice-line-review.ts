/**
 * Smoke check for the PATCH /invoice-lines/:lineId endpoint.
 *
 *  1. Seed a MONTHLY session + 1 WITHHOLDING_INVOICE doc + 1 line.
 *  2. PATCH { is_reviewed: true } → expect 200 + is_reviewed=true echoed.
 *  3. GET /supervisor/approval/:id → expect that line now has
 *     is_reviewed=true in invoiceLines[].
 *  4. PATCH { is_reviewed: false, reviewer_note: 'undo' } → expect both
 *     fields reflected.
 *  5. PATCH with empty body → expect 400 (refine rule).
 *  6. Cleanup unconditionally.
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.production.local', override: true });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const base = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';

const CUSTOMER_ID = '00000000-0000-0000-0000-000000000011';
const CONSULTANT_ID = 'e9d88904-dd85-4082-800e-698a529aa69d';
const TAX_PARTNER_ID = '00000000-0000-0000-0000-000000000003';

const admin = createClient(url, serviceKey);

async function loginSupervisor() {
  const c = createClient(url, anon);
  const { data, error } = await c.auth.signInWithPassword({
    email: 'supervisor.test@aipajak.com',
    password: 'TestPassword123!',
  });
  if (error || !data.session) throw error || new Error('no session');
  return { token: data.session.access_token, userId: data.session.user.id };
}

(async () => {
  let sessionId: string | null = null;
  let docId: string | null = null;
  let lineId: string | null = null;
  try {
    const { token, userId } = await loginSupervisor();

    console.log('1️⃣  Seed session + doc + 1 line');
    const today = new Date();
    const taxPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    // Pre-cleanup leftover sessions from crashed runs.
    const { data: stale } = await admin
      .from('consultant_session')
      .select('id')
      .eq('customer_id', CUSTOMER_ID)
      .eq('filing_kind', 'MONTHLY')
      .eq('tax_period', taxPeriod);
    if (stale && stale.length > 0) {
      const staleIds = stale.map((x) => x.id);
      const { data: docs } = await admin.from('consultant_session_document').select('id').in('session_id', staleIds);
      if (docs && docs.length > 0) {
        await admin.from('consultant_session_invoice_line').delete().in('document_id', docs.map((d) => d.id));
        await admin.from('consultant_session_document').delete().in('session_id', staleIds);
      }
      await admin.from('consultant_session').delete().in('id', staleIds);
    }

    const { data: s } = await admin
      .from('consultant_session')
      .insert({
        customer_id: CUSTOMER_ID,
        tax_partner_id: TAX_PARTNER_ID,
        consultant_id: CONSULTANT_ID,
        filing_kind: 'MONTHLY',
        tax_period: taxPeriod,
        status: 'PENDING_APPROVAL',
        current_step: 5,
      })
      .select('id')
      .single();
    sessionId = s!.id;
    const { data: d } = await admin
      .from('consultant_session_document')
      .insert({
        session_id: sessionId,
        slot: 'WITHHOLDING_INVOICE',
        storage_path: `test/${sessionId}/inv.pdf`,
        original_filename: 'inv.pdf',
        uploaded_by: userId,
        parse_status: 'PARSED',
      })
      .select('id')
      .single();
    docId = d!.id;
    const { data: l } = await admin
      .from('consultant_session_invoice_line')
      .insert({
        document_id: docId,
        session_id: sessionId,
        line_no: 1,
        invoice_number: 'INV-REVIEW-1',
        invoice_date: '2026-05-20',
        counterparty_name: 'PT Review Test',
        currency: 'IDR',
        description: 'Smoke line',
        subtotal: 1_000_000,
        total: 1_100_000,
      })
      .select('id')
      .single();
    lineId = l!.id;
    console.log(`   line ${lineId}`);

    console.log('2️⃣  PATCH is_reviewed=true');
    const r1 = await fetch(
      `${base}/api/consultant-erp/sessions/${sessionId}/invoice-lines/${lineId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_reviewed: true }),
      },
    );
    if (!r1.ok) throw new Error(`PATCH1 ${r1.status}: ${await r1.text()}`);
    const j1 = await r1.json();
    if (j1.data.line.is_reviewed !== true) {
      throw new Error('is_reviewed not echoed true');
    }
    console.log('   ✅ is_reviewed=true');

    console.log('3️⃣  GET approval → line reflected');
    const g = await fetch(
      `${base}/api/consultant-erp/supervisor/approval/${sessionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const gj = await g.json();
    const got = (gj.data.invoiceLines as Array<{ id: string; is_reviewed: boolean }>).find(
      (x) => x.id === lineId,
    );
    if (!got?.is_reviewed) {
      throw new Error(`line not is_reviewed in GET: ${JSON.stringify(got)}`);
    }
    console.log('   ✅ supervisor GET picks up review state');

    console.log('4️⃣  PATCH undo + note');
    const r2 = await fetch(
      `${base}/api/consultant-erp/sessions/${sessionId}/invoice-lines/${lineId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_reviewed: false, reviewer_note: 'undo' }),
      },
    );
    if (!r2.ok) throw new Error(`PATCH2 ${r2.status}: ${await r2.text()}`);
    const j2 = await r2.json();
    if (j2.data.line.is_reviewed !== false || j2.data.line.reviewer_note !== 'undo') {
      throw new Error(`unexpected echo: ${JSON.stringify(j2)}`);
    }
    console.log('   ✅ undo + note persisted');

    console.log('5️⃣  PATCH empty body → 400');
    const r3 = await fetch(
      `${base}/api/consultant-erp/sessions/${sessionId}/invoice-lines/${lineId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    if (r3.status !== 400) throw new Error(`expected 400, got ${r3.status}`);
    console.log('   ✅ empty body 400');

    console.log('\n🎉 invoice line review PASS');
  } catch (e) {
    console.error('💥', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Cleanup');
    if (lineId) await admin.from('consultant_session_invoice_line').delete().eq('id', lineId);
    if (docId) await admin.from('consultant_session_document').delete().eq('id', docId);
    if (sessionId) await admin.from('consultant_session').delete().eq('id', sessionId);
    console.log('   done');
  }
})();
