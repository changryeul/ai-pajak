/**
 * Round-trip verification:
 *   1. Login as supervisor
 *   2. GET settings → capture baseline approval + channels
 *   3. PATCH with flipped approval.slaMaxReviewDays + channels.telegram
 *   4. GET → assert flipped values come back
 *   5. PATCH back to baseline
 *   6. GET → assert baseline restored
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.production.local', override: true });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const base = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';

async function login() {
  const client = createClient(url, anon);
  const { data, error } = await client.auth.signInWithPassword({
    email: 'supervisor.test@aipajak.com',
    password: 'TestPassword123!',
  });
  if (error || !data.session) throw error || new Error('no session');
  return data.session.access_token;
}

async function api(token: string, method: 'GET' | 'PATCH', body?: unknown) {
  const r = await fetch(`${base}/api/consultant-erp/supervisor/settings`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) throw new Error(`${method} ${r.status}: ${text}`);
  return json;
}

(async () => {
  console.log('🔐 Login as supervisor.test...');
  const token = await login();

  console.log('1️⃣  GET baseline');
  const g0 = await api(token, 'GET');
  const baseline = {
    approval: g0.data.approval,
    channels: g0.data.channels,
  };
  console.log('   baseline.approval.slaMaxReviewDays =', baseline.approval.slaMaxReviewDays);
  console.log('   baseline.channels.telegram        =', baseline.channels.telegram);

  const flippedSla = baseline.approval.slaMaxReviewDays === 2 ? 5 : 2;
  const flippedTelegram = !baseline.channels.telegram;

  console.log(`2️⃣  PATCH approval.slaMaxReviewDays=${flippedSla}, channels.telegram=${flippedTelegram}`);
  await api(token, 'PATCH', {
    approval: { slaMaxReviewDays: flippedSla },
    channels: { telegram: flippedTelegram },
  });

  console.log('3️⃣  GET → expect persisted values');
  const g1 = await api(token, 'GET');
  if (g1.data.approval.slaMaxReviewDays !== flippedSla) {
    throw new Error(`slaMaxReviewDays did not persist: got ${g1.data.approval.slaMaxReviewDays}, expected ${flippedSla}`);
  }
  if (g1.data.channels.telegram !== flippedTelegram) {
    throw new Error(`telegram did not persist: got ${g1.data.channels.telegram}, expected ${flippedTelegram}`);
  }
  // Other fields must remain at defaults (not overwritten).
  if (g1.data.approval.requireSupervisorApproval !== baseline.approval.requireSupervisorApproval) {
    throw new Error('partial PATCH overwrote sibling approval field');
  }
  if (g1.data.channels.email !== baseline.channels.email) {
    throw new Error('partial PATCH overwrote sibling channel field');
  }
  console.log('   ✅ persisted + merged correctly');

  console.log('4️⃣  PATCH back to baseline');
  await api(token, 'PATCH', {
    approval: { slaMaxReviewDays: baseline.approval.slaMaxReviewDays },
    channels: { telegram: baseline.channels.telegram },
  });

  console.log('5️⃣  GET → expect baseline restored');
  const g2 = await api(token, 'GET');
  if (g2.data.approval.slaMaxReviewDays !== baseline.approval.slaMaxReviewDays) {
    throw new Error('failed to restore slaMaxReviewDays');
  }
  if (g2.data.channels.telegram !== baseline.channels.telegram) {
    throw new Error('failed to restore telegram');
  }
  console.log('   ✅ restored');

  console.log('\n🎉 supervisor settings round-trip PASS');
})().catch((e) => {
  console.error('💥', e.message);
  process.exit(1);
});
