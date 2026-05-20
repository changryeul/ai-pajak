/**
 * Verifies the autoParse option on the documents/upload endpoint.
 *
 * Real file uploads via fetch + FormData are awkward to drive from a
 * smoke script (we'd need a real PDF in the bucket), so this test takes
 * a more surgical path:
 *   1. Seed a MONTHLY session.
 *   2. Build a tiny in-memory text file and upload it with
 *      autoParse=true on slot=WITHHOLDING_INVOICE.
 *   3. Assert the response now includes `data.parse` (mode + inserted +
 *      reason). Because the file is plain text the parser will fall
 *      back to MOCK (synthetic-path-fallback would also do — we just
 *      need the shape).
 *   4. Cleanup unconditionally.
 *
 * If the new branch is broken or the field is missing, the assert
 * surface fails fast.
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
const STORAGE_BUCKET = 'consultant-erp-docs';

const admin = createClient(url, serviceKey);

async function loginConsultant() {
  const c = createClient(url, anon);
  const { data, error } = await c.auth.signInWithPassword({
    email: 'consultant.test@jakartatax.co.id',
    password: 'TestPassword123!',
  });
  if (error || !data.session) throw error || new Error('no session');
  return data.session.access_token;
}

(async () => {
  let sessionId: string | null = null;
  let docId: string | null = null;
  let storagePath: string | null = null;
  try {
    const token = await loginConsultant();

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
        status: 'DRAFT',
        current_step: 1,
      })
      .select('id')
      .single();
    if (sErr) throw sErr;
    sessionId = s.id;
    console.log(`   session ${sessionId}`);

    console.log('2️⃣  Upload tiny text file with autoParse=true');
    const form = new FormData();
    form.append('slot', 'WITHHOLDING_INVOICE');
    form.append('autoParse', 'true');
    const blob = new Blob(['not a real invoice — graceful-fallback check'], {
      type: 'text/plain',
    });
    form.append('file', blob, 'fake-invoice.txt');

    const r = await fetch(
      `${base}/api/consultant-erp/sessions/${sessionId}/documents/upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    );
    if (!r.ok) throw new Error(`upload ${r.status}: ${await r.text()}`);
    const j = await r.json();
    if (!j.success) throw new Error(`success=false: ${JSON.stringify(j)}`);
    docId = j.data.documentId;
    storagePath = j.data.storagePath;

    if (!j.data.parse) {
      throw new Error('autoParse=true but response has no data.parse field');
    }
    const { parse } = j.data;
    if (typeof parse.inserted !== 'number') throw new Error('parse.inserted missing');
    if (parse.mode !== 'CLAUDE' && parse.mode !== 'MOCK')
      throw new Error(`parse.mode unexpected: ${parse.mode}`);
    console.log(
      `   ✅ parse.mode=${parse.mode}, inserted=${parse.inserted}, confidence=${parse.confidence}, reason=${parse.reason}`,
    );

    console.log('3️⃣  Upload without autoParse — expect NO data.parse');
    const form2 = new FormData();
    form2.append('slot', 'OTHER_REFERENCE');
    const blob2 = new Blob(['plain text'], { type: 'text/plain' });
    form2.append('file', blob2, 'note.txt');
    const r2 = await fetch(
      `${base}/api/consultant-erp/sessions/${sessionId}/documents/upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form2,
      },
    );
    const j2 = await r2.json();
    if (!r2.ok) throw new Error(`upload2 ${r2.status}: ${JSON.stringify(j2)}`);
    if ('parse' in j2.data) {
      throw new Error('Non-invoice + no autoParse but response carries data.parse');
    }
    console.log('   ✅ no data.parse on non-invoice slot');

    console.log('\n🎉 upload autoParse contract PASS');
  } catch (e) {
    console.error('💥', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Cleanup');
    if (docId) {
      await admin.from('consultant_session_invoice_line').delete().eq('document_id', docId);
      await admin.from('consultant_session_document').delete().eq('id', docId);
    }
    if (storagePath) {
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
    }
    if (sessionId) {
      // Also remove the secondary doc + storage we created in step 3.
      const { data: leftover } = await admin
        .from('consultant_session_document')
        .select('id, storage_path')
        .eq('session_id', sessionId);
      for (const row of leftover ?? []) {
        await admin.storage.from(STORAGE_BUCKET).remove([row.storage_path]).catch(() => {});
        await admin.from('consultant_session_document').delete().eq('id', row.id);
      }
      await admin.from('consultant_session').delete().eq('id', sessionId);
    }
    console.log('   done');
  }
})();
