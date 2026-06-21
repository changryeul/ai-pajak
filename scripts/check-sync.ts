import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: customers } = await admin.from('customer').select('id, full_name, company_name, customer_type, employee_synced_through_period').limit(5);
  console.log('customers:', JSON.stringify(customers, null, 2));

  const { data: payslips } = await admin.from('monthly_payslip').select('id, customer_id, period, status, employee_name').limit(10);
  console.log('payslips:', JSON.stringify(payslips, null, 2));
}
main();
