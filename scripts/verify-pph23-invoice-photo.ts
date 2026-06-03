/**
 * Verify POST /api/tax/pph23-transactions/[id]/invoice-photo contract.
 *
 * 5 assertions:
 *   1. setup: customer login + admin direct insert pph23_transaction
 *      (tax_period='2026-99' sentinel)
 *   2. POST with multipart 1KB JPEG → 200 + documentId
 *   3. GET transaction (admin) → invoice_document_id populated
 *   4. document table row exists with customerId + type='INVOICE'
 *   5. cleanup: delete document + storage object + transaction
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-pph23-invoice-photo.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const PERIOD = '2026-99'; // sentinel — cleanup after

// 67-byte 1×1 baseline JPEG (smallest valid JPEG payload).
const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xd9,
]);

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: TEST_EMAIL, password: TEST_PASSWORD,
  });
  if (authErr || !auth.session) { console.error('x login:', authErr?.message); process.exit(1); }
  const token = auth.session.access_token;
  const { data: cust } = await sbAdmin
    .from('customer')
    .select('id')
    .eq('user_id', auth.user!.id)
    .maybeSingle();
  if (!cust) { console.error('x no customer'); process.exit(1); }

  // Pre-cleanup sentinel period (any orphan from a prior crashed run).
  const { data: orphans } = await sbAdmin
    .from('pph23_transaction')
    .select('id, invoice_document_id')
    .eq('customer_id', cust.id)
    .eq('tax_period', PERIOD);
  if (orphans && orphans.length > 0) {
    const orphanDocIds = orphans
      .map((o) => o.invoice_document_id)
      .filter((x): x is string => !!x);
    if (orphanDocIds.length > 0) {
      await sbAdmin.from('document').delete().in('id', orphanDocIds);
    }
    await sbAdmin.from('pph23_transaction').delete().in('id', orphans.map((o) => o.id));
  }

  let pass = 0;
  let fail = 0;
  let txId: string | null = null;
  let docId: string | null = null;
  let storagePath: string | null = null;

  // --- 1. setup -----------------------------------------------------------
  const { data: createdRow, error: insertErr } = await sbAdmin
    .from('pph23_transaction')
    .insert({
      customer_id: cust.id,
      tax_period: PERIOD,
      transaction_date: '2026-01-15',
      service_type: 'JASA_TEKNIK',
      gross_amount: 1000000,
      tax_rate: 0.02,
      tax_amount: 20000,
      counterparty_name: 'PHOTO TEST VENDOR',
      counterparty_npwp: '01.234.567.8-901.000',
      invoice_number: 'PHOTO-TEST-001',
      description: 'invoice-photo smoke seed',
    })
    .select('id')
    .single();
  if (insertErr || !createdRow) {
    console.error('x 1. seed insert:', insertErr?.message);
    process.exit(1);
  }
  txId = createdRow.id;
  console.log(`OK 1. setup: seeded transaction ${txId}`);
  pass++;

  try {
    // --- 2. POST multipart -------------------------------------------------
    const fd = new FormData();
    const blob = new Blob([TINY_JPEG], { type: 'image/jpeg' });
    fd.append('file', blob, 'test-invoice.jpg');
    const res = await fetch(
      `${BASE_URL}/api/tax/pph23-transactions/${txId}/invoice-photo`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd },
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.data?.documentId) {
      docId = data.data.documentId;
      storagePath = data.data.storagePath || null;
      console.log(`OK 2. POST 200 → documentId=${docId}`);
      pass++;
    } else {
      console.error(`x 2. POST ${res.status}:`, data);
      fail++;
    }

    // --- 3. transaction.invoice_document_id populated ----------------------
    const { data: txRow } = await sbAdmin
      .from('pph23_transaction')
      .select('invoice_document_id')
      .eq('id', txId)
      .single();
    if (txRow?.invoice_document_id && txRow.invoice_document_id === docId) {
      console.log(`OK 3. pph23_transaction.invoice_document_id=${txRow.invoice_document_id}`);
      pass++;
    } else {
      console.error('x 3. invoice_document_id mismatch:', txRow?.invoice_document_id, 'expected', docId);
      fail++;
    }

    // --- 4. document row exists with INVOICE + customer match --------------
    if (docId) {
      const { data: docRow } = await sbAdmin
        .from('document')
        .select('id, customer_id, document_type, file_size_bytes, mime_type')
        .eq('id', docId)
        .single();
      if (
        docRow &&
        docRow.customer_id === cust.id &&
        docRow.document_type === 'INVOICE'
      ) {
        console.log(`OK 4. document row: type=${docRow.document_type} size=${docRow.file_size_bytes}B mime=${docRow.mime_type}`);
        pass++;
      } else {
        console.error('x 4. document row mismatch:', docRow);
        fail++;
      }
    } else {
      console.error('x 4. skipped (no docId from step 2)');
      fail++;
    }
  } finally {
    // --- 5. cleanup --------------------------------------------------------
    let cleanupErrs = 0;
    if (storagePath) {
      const { error: stErr } = await sbAdmin.storage.from('tax-documents').remove([storagePath]);
      if (stErr) cleanupErrs++;
    }
    if (docId) {
      const { error: dErr } = await sbAdmin.from('document').delete().eq('id', docId);
      if (dErr) cleanupErrs++;
    }
    if (txId) {
      const { error: tErr } = await sbAdmin.from('pph23_transaction').delete().eq('id', txId);
      if (tErr) cleanupErrs++;
    }
    if (cleanupErrs === 0) {
      console.log('OK 5. cleanup: document + storage + transaction removed');
      pass++;
    } else {
      console.error(`x 5. cleanup had ${cleanupErrs} errors`);
      fail++;
    }
  }

  console.log(`\n=== ${pass} pass / ${fail} fail ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('x exception:', e); process.exit(1); });
