import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { count, data } = await admin.from('tax_filing').select('id, tax_type, tax_period, status, customer_id', { count: 'exact' }).order('created_at', { ascending: false }).limit(10);
  console.log(`tax_filing rows: ${count}`);
  console.log(JSON.stringify(data, null, 2));
}
main();
