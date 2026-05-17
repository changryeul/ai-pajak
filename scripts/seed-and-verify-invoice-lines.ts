/**
 * End-to-end invoice-line verification on prod with seed-then-cleanup:
 *  1. Seed 1 MONTHLY consultant_session for PT Example Indonesia
 *  2. Seed 1 consultant_session_document (slot=WITHHOLDING_INVOICE)
 *  3. Seed 3 consultant_session_invoice_line rows attached to that doc
 *  4. GET /supervisor/approval/:sessionId
 *  5. Assert invoiceLines.length=3 + shape + grand total math
 *  6. Cleanup unconditionally (lines → doc → session)
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
  try {
    console.log('🔐 Login...');
    const { token, userId } = await loginSupervisor();

    console.log('1️⃣  Seed session');
    const today = new Date();
    const taxPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
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

    console.log('2️⃣  Seed WITHHOLDING_INVOICE document');
    const { data: d, error: dErr } = await admin
      .from('consultant_session_document')
      .insert({
        session_id: sessionId,
        slot: 'WITHHOLDING_INVOICE',
        storage_path: `test/${sessionId}/invoice.pdf`,
        original_filename: 'test-invoice.pdf',
        uploaded_by: userId,
        parse_status: 'PARSED',
      })
      .select('id')
      .single();
    if (dErr) throw dErr;
    docId = d.id;
    console.log(`   doc ${docId}`);

    console.log('3️⃣  Seed 3 invoice lines');
    const lines = [
      {
        document_id: docId,
        session_id: sessionId,
        line_no: 1,
        invoice_number: 'INV-2026-001',
        invoice_date: '2026-05-10',
        counterparty_name: 'PT Mitra Sukses',
        counterparty_npwp: '01.234.567.8-901.000',
        description: 'Konsultasi pajak Mei',
        quantity: 1,
        unit_price: 10_000_000,
        subtotal: 10_000_000,
        vat_amount: 1_100_000,
        withholding_amount: 200_000,
        total: 10_900_000,
        parse_confidence: 92,
      },
      {
        document_id: docId,
        session_id: sessionId,
        line_no: 2,
        invoice_number: 'INV-2026-001',
        invoice_date: '2026-05-10',
        counterparty_name: 'PT Mitra Sukses',
        counterparty_npwp: '01.234.567.8-901.000',
        description: 'Pengembalian dokumen',
        quantity: 1,
        unit_price: 500_000,
        subtotal: 500_000,
        vat_amount: 55_000,
        withholding_amount: 10_000,
        total: 545_000,
        parse_confidence: 88,
      },
      {
        document_id: docId,
        session_id: sessionId,
        line_no: 3,
        invoice_number: 'INV-2026-002',
        invoice_date: '2026-05-15',
        counterparty_name: 'CV Indah Jaya',
        counterparty_npwp: '02.345.678.9-012.000',
        description: 'Sewa kantor (Mei)',
        quantity: 1,
        unit_price: 5_000_000,
        subtotal: 5_000_000,
        vat_amount: 550_000,
        withholding_amount: 500_000,
        total: 5_050_000,
        parse_confidence: 95,
      },
    ];
    const { error: lErr } = await admin
      .from('consultant_session_invoice_line')
      .insert(lines);
    if (lErr) throw lErr;
    console.log(`   inserted ${lines.length} lines`);

    console.log('4️⃣  GET /supervisor/approval/:sessionId');
    const r = await fetch(
      `${base}/api/consultant-erp/supervisor/approval/${sessionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) throw new Error(`detail ${r.status}: ${await r.text()}`);
    const detail = await r.json();
    const got: typeof lines = detail?.data?.invoiceLines ?? [];

    if (got.length !== 3) throw new Error(`expected 3 invoiceLines, got ${got.length}`);
    if (!got[0].line_no || got[0].line_no > got[1].line_no)
      throw new Error('lines not sorted by line_no');
    if (got[0].counterparty_npwp !== '01.234.567.8-901.000')
      throw new Error(`bad npwp: ${got[0].counterparty_npwp}`);

    const grandTotal = got.reduce((s, l) => s + Number(l.total ?? 0), 0);
    if (grandTotal !== 16_495_000)
      throw new Error(`grand total ${grandTotal}, expected 16,495,000`);

    console.log(`   ✅ invoice lines OK — grand total Rp ${grandTotal.toLocaleString('id-ID')}`);

    console.log('\n🎉 invoice-line seed+verify PASS');
  } catch (e) {
    console.error('💥', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Cleanup');
    if (docId) {
      await admin.from('consultant_session_invoice_line').delete().eq('document_id', docId);
      await admin.from('consultant_session_document').delete().eq('id', docId);
    }
    if (sessionId) {
      await admin.from('consultant_session').delete().eq('id', sessionId);
    }
    console.log('   done');
  }
})();
