import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // company.test@example.com 의 customer 와 그 tax_filing 행
  const { data: users } = await admin.auth.admin.listUsers();
  const company = users.users.find(u => u.email === 'company.test@example.com');
  console.log('company user id:', company?.id);

  if (company) {
    const { data: customer } = await admin.from('customer').select('id, customer_type, company_name').eq('user_id', company.id).maybeSingle();
    console.log('customer:', customer);
    if (customer) {
      const { data: filings, count } = await admin.from('tax_filing').select('id, tax_type, tax_period, status', { count: 'exact' }).eq('customer_id', customer.id);
      console.log(`tax_filing for this customer: ${count}`);
      console.log(JSON.stringify(filings, null, 2));
    }
  }
}
main();
