import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { count, data } = await admin
    .from('ppn_faktur_monthly')
    .select('id, customer_id, tax_period, faktur_type, counterparty_name, dpp, ppn, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(30);
  console.log(`Total ppn_faktur_monthly rows: ${count}`);
  console.log(`Recent rows:`);
  for (const r of data || []) {
    const dpp = r.dpp ? Number(r.dpp).toLocaleString() : '—';
    const ppn = r.ppn ? Number(r.ppn).toLocaleString() : '—';
    console.log(`  ${r.faktur_type.padEnd(8)} ${r.tax_period}  ${(r.counterparty_name||'—').slice(0,30).padEnd(30)} DPP ${dpp}  PPN ${ppn}`);
  }
  // KELUARAN vs MASUKAN
  const outCount = (data||[]).filter(r => r.faktur_type === 'KELUARAN').length;
  const inCount = (data||[]).filter(r => r.faktur_type === 'MASUKAN').length;
  console.log(`\nKELUARAN: ${outCount}, MASUKAN: ${inCount}`);
}
main();
