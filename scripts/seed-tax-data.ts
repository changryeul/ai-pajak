import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://localhost:54321',
  'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seed() {
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const users = usersData.users;
  const customerUser = users.find((u) => u.email === 'customer.test@example.com');
  const consultantUser = users.find((u) => u.email === 'consultant.test@jakartatax.co.id');

  if (!customerUser || !consultantUser) {
    console.error('Users not found');
    return;
  }

  const { data: customer } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', customerUser.id)
    .single();

  const { data: consultant } = await supabase
    .from('consultant')
    .select('id')
    .eq('user_id', consultantUser.id)
    .single();

  if (!customer || !consultant) {
    console.error('Customer or consultant not found');
    return;
  }

  console.log('Customer:', customer.id, 'Consultant:', consultant.id);

  const { error } = await supabase.from('tax_calculation').insert({
    customer_id: customer.id,
    consultant_id: consultant.id,
    calculated_by_user_id: consultantUser.id,
    tax_type: 'PPh21',
    tax_period: '2025-12',
    tax_year: 2025,
    income_data: {
      employer_npwp: '01.234.567.8-091.000',
      employer_name: 'PT TEKNOLOGI MAJU INDONESIA',
    },
    calculation_result: {
      grossIncome: 237600000,
      positionCosts: 6000000,
      pensionContribution: 2400000,
      netIncome: 229200000,
      ptkp: 67500000,
      taxableIncome: 161700000,
      taxDue: 18255000,
      calculatedTax: 18255000,
    },
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Tax calculation seeded successfully');
  }
}

seed();
