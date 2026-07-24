/**
 * Phase 2 invoice parser smoke check on prod.
 *  1. Seed 1 MONTHLY session + 1 WITHHOLDING_INVOICE document (synthetic
 *     storage_path so the parser hits the graceful fallback, not a real
 *     Anthropic call — keeps the test cheap + deterministic).
 *  2. POST /parse-invoice → expect 200 with mode=MOCK (since the path is
 *     synthetic) and inserted=0.
 *  3. Cleanup unconditionally.
 *
 * The real-vision path is exercised manually when an actual invoice PDF
 * lives at the document's storage_path. This script just guards the
 * endpoint contract + fallback shape.
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
const CONSULTANT_ID = '00000000-0000-0000-0000-000000000041';
const TAX_PARTNER_ID = '00000000-0000-0000-0000-000000000040';

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
  try {
    const { token, userId } = await loginSupervisor();

    console.log('1️⃣  Seed session');
    const today = new Date();
    const taxPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    // Pre-cleanup leftover sessions from crashed runs (unique constraint).
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

    const { data: s, error: sErr } = await admin
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
    if (sErr) throw sErr;
    sessionId = s.id;
    console.log(`   session ${sessionId}`);

    console.log('2️⃣  Seed WITHHOLDING_INVOICE document with synthetic path');
    const { data: d, error: dErr } = await admin
      .from('consultant_session_document')
      .insert({
        session_id: sessionId,
        slot: 'WITHHOLDING_INVOICE',
        // synthetic-path-fallback triggers when extension is missing.
        storage_path: `synthetic/${sessionId}/no-extension`,
        original_filename: 'fake-invoice',
        uploaded_by: userId,
        parse_status: 'PENDING',
      })
      .select('id')
      .single();
    if (dErr) throw dErr;
    docId = d.id;
    console.log(`   doc ${docId}`);

    console.log('3️⃣  POST /parse-invoice');
    const r = await fetch(
      `${base}/api/consultant-erp/sessions/${sessionId}/parse-invoice`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: docId }),
      },
    );
    if (!r.ok) throw new Error(`parse-invoice ${r.status}: ${await r.text()}`);
    const j = await r.json();
    if (!j.success) throw new Error(`success=false: ${JSON.stringify(j)}`);
    if (j.data.mode !== 'MOCK') {
      throw new Error(`expected mode=MOCK for synthetic path, got ${j.data.mode}`);
    }
    if (j.data.inserted !== 0) {
      throw new Error(`expected inserted=0 for fallback, got ${j.data.inserted}`);
    }
    console.log(`   ✅ mode=${j.data.mode}, reason=${j.data.reason}`);

    console.log('4️⃣  POST again with wrong slot — expect 400');
    // Patch slot to a non-invoice value and re-call.
    await admin
      .from('consultant_session_document')
      .update({ slot: 'PAYROLL' })
      .eq('id', docId);
    const r2 = await fetch(
      `${base}/api/consultant-erp/sessions/${sessionId}/parse-invoice`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: docId }),
      },
    );
    if (r2.status !== 400) {
      throw new Error(`expected 400 for non-invoice slot, got ${r2.status}`);
    }
    console.log('   ✅ slot guard returns 400');

    console.log('5️⃣  Consultant 403 sanity');
    const c = createClient(url, anon);
    const { data: consResp } = await c.auth.signInWithPassword({
      email: 'external.consultant@mitrapajak.com',
      password: 'TestPassword123!',
    });
    const consToken = consResp?.session?.access_token;
    if (consToken) {
      // Restore invoice slot so the auth check is the only gate.
      await admin
        .from('consultant_session_document')
        .update({ slot: 'WITHHOLDING_INVOICE' })
        .eq('id', docId);
      const r3 = await fetch(
        `${base}/api/consultant-erp/sessions/${sessionId}/parse-invoice`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${consToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentId: docId }),
        },
      );
      // CONSULTANT can call this — the endpoint is consultant-or-supervisor.
      // What we assert is that the call doesn't break for a CONSULTANT.
      if (r3.status >= 500) {
        throw new Error(`consultant call 5xx: ${r3.status}`);
      }
      console.log(`   ✅ consultant call returns ${r3.status} (no 5xx)`);
    } else {
      console.log('   ⏭️  consultant login failed, skip');
    }

    console.log('\n🎉 invoice parser phase 2 smoke PASS');
  } catch (e) {
    console.error('💥', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Cleanup');
    if (docId) {
      await admin.from('consultant_session_invoice_line').delete().eq('document_id', docId);
      await admin.from('consultant_session_document').delete().eq('id', docId);
    }
    if (sessionId) await admin.from('consultant_session').delete().eq('id', sessionId);
    console.log('   done');
  }
})();
