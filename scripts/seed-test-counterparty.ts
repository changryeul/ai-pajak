import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000011';

async function main() {
  const counterparties = [
    { name: 'PT Vendor Jaya', npwp: '01.111.222.3-444.000', type: 'VENDOR', is_foreign: false },
    { name: 'PT Client Sentosa', npwp: '01.222.333.4-555.000', type: 'CLIENT', is_foreign: false },
    { name: 'Global Services Pte Ltd', npwp: null, type: 'VENDOR', is_foreign: true, country: 'SG' },
  ];

  for (const cp of counterparties) {
    const { data, error } = await supabase
      .from('tax_counterparty')
      .insert({
        customer_id: CUSTOMER_ID,
        name: cp.name,
        npwp: cp.npwp,
        type: cp.type,
        is_foreign: cp.is_foreign,
        country: cp.is_foreign ? cp.country : 'ID',
      })
      .select('id, name')
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        console.log(`⏭ ${cp.name}: already exists`);
      } else {
        console.log(`⚠ ${cp.name}: ${error.message}`);
      }
    } else {
      console.log(`✅ ${data?.name} (${data?.id})`);
    }
  }

  // Get counterparty IDs
  const { data: cps } = await supabase
    .from('tax_counterparty')
    .select('id, name, npwp, is_foreign')
    .eq('customer_id', CUSTOMER_ID);

  if (!cps || cps.length === 0) {
    console.log('❌ No counterparties found');
    return;
  }

  console.log(`\n📋 ${cps.length} counterparties. Creating transactions...`);

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const txns = [
    { cp: cps[0], service_type: 'PPh 23', gross: 10000000, rate: 0.02, desc: 'IT consulting' },
    { cp: cps[0], service_type: 'PPh 23', gross: 25000000, rate: 0.02, desc: 'Management fee' },
    { cp: cps.length > 1 ? cps[1] : cps[0], service_type: 'PPh 23', gross: 15000000, rate: 0.02, desc: 'Technical support' },
  ];

  const foreignCp = cps.find((c: { is_foreign: boolean }) => c.is_foreign);
  if (foreignCp) {
    txns.push({ cp: foreignCp, service_type: 'PPh 26', gross: 50000000, rate: 0.20, desc: 'Cross-border service' });
  }

  for (const tx of txns) {
    const { error } = await supabase
      .from('pph23_transaction')
      .insert({
        customer_id: CUSTOMER_ID,
        counterparty_name: tx.cp.name,
        counterparty_npwp: tx.cp.npwp,
        service_type: tx.service_type,
        gross_amount: tx.gross,
        tax_rate: tx.rate,
        tax_amount: Math.round(tx.gross * tx.rate),
        transaction_date: `${year}-${String(month).padStart(2, '0')}-15`,
        tax_period: period,
        description: tx.desc,
      });

    if (error) {
      console.log(`⚠ ${tx.desc}: ${error.message}`);
    } else {
      console.log(`✅ ${tx.cp.name} — ${tx.desc} (Rp ${tx.gross.toLocaleString()} × ${(tx.rate * 100)}%)`);
    }
  }

  console.log('\n✨ Refresh PPh23 page to see data.');
}

main().catch(console.error);
