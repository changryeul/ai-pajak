/**
 * Seed monthly payment data for testing
 * Run: npx tsx scripts/seed-monthly-payments.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function seed() {
  // Find customer
  const { data: users } = await supabase.auth.admin.listUsers();
  const customerUser = users.users.find(u => u.email === 'customer.test@example.com');
  if (!customerUser) { console.error('Customer not found'); return; }

  const { data: customer } = await supabase.from('customer').select('id').eq('user_id', customerUser.id).single();
  if (!customer) { console.error('Customer record not found'); return; }

  console.log('Customer:', customer.id);

  const year = 2026;
  const currentMonth = new Date().getMonth() + 1; // 1-based

  // Delete existing
  await supabase.from('tax_monthly_payment').delete().eq('customer_id', customer.id).eq('tax_year', year);

  const payments = [];

  // PPh 21 - 월 1,500,000 (직원 급여 원천징수)
  for (let m = 1; m <= 12; m++) {
    const isPaid = m < currentMonth;
    const period = `${year}-${String(m).padStart(2, '0')}`;
    payments.push({
      customer_id: customer.id,
      tax_type: 'PPh21',
      tax_period: period,
      tax_year: year,
      amount_due: 1_500_000,
      amount_paid: isPaid ? 1_500_000 : 0,
      status: isPaid ? 'PAID' : 'UNPAID',
      payment_deadline: `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-10`,
      reporting_deadline: `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-20`,
      ntpn: isPaid ? `NTPN${year}${String(m).padStart(2, '0')}21` : null,
      payment_date: isPaid ? `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-08` : null,
    });
  }

  // PPh 23 - 월 800,000 (서비스 원천징수)
  for (let m = 1; m <= 12; m++) {
    const isPaid = m < currentMonth;
    const period = `${year}-${String(m).padStart(2, '0')}`;
    payments.push({
      customer_id: customer.id,
      tax_type: 'PPh23',
      tax_period: period,
      tax_year: year,
      amount_due: 800_000,
      amount_paid: isPaid ? 800_000 : 0,
      status: isPaid ? 'PAID' : (m === currentMonth - 1 && !isPaid ? 'OVERDUE' : 'UNPAID'),
      payment_deadline: `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-10`,
      reporting_deadline: `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-20`,
      ntpn: isPaid ? `NTPN${year}${String(m).padStart(2, '0')}23` : null,
    });
  }

  // PPN - 월 2,200,000 (부가세 차이)
  for (let m = 1; m <= 12; m++) {
    const isPaid = m < currentMonth;
    const period = `${year}-${String(m).padStart(2, '0')}`;
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? year + 1 : year;
    const lastDay = new Date(nextY, nextM, 0).getDate();
    payments.push({
      customer_id: customer.id,
      tax_type: 'PPN',
      tax_period: period,
      tax_year: year,
      amount_due: 2_200_000,
      amount_paid: isPaid ? 2_200_000 : 0,
      status: isPaid ? 'PAID' : 'UNPAID',
      payment_deadline: `${nextY}-${String(nextM).padStart(2, '0')}-${lastDay}`,
      reporting_deadline: `${nextY}-${String(nextM).padStart(2, '0')}-${lastDay}`,
      ntpn: isPaid ? `NTPN${year}${String(m).padStart(2, '0')}PN` : null,
    });
  }

  // PPh Final UMKM - 월 500,000 (매출 x 0.5%)
  for (let m = 1; m <= 12; m++) {
    const isPaid = m < currentMonth;
    const period = `${year}-${String(m).padStart(2, '0')}`;
    payments.push({
      customer_id: customer.id,
      tax_type: 'PPh_FINAL',
      tax_period: period,
      tax_year: year,
      amount_due: 500_000,
      amount_paid: isPaid ? 500_000 : 0,
      status: isPaid ? 'PAID' : 'UNPAID',
      payment_deadline: `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-15`,
      reporting_deadline: `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-15`,
    });
  }

  const { error } = await supabase.from('tax_monthly_payment').insert(payments);
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log(`Seeded ${payments.length} monthly payments for ${year}`);
    console.log('PPh 21: 12 months x Rp 1,500,000');
    console.log('PPh 23: 12 months x Rp 800,000');
    console.log('PPN: 12 months x Rp 2,200,000');
    console.log('PPh Final: 12 months x Rp 500,000');
    console.log(`Months 1-${currentMonth - 1}: PAID, Month ${currentMonth}+: UNPAID`);
  }
}

seed();
