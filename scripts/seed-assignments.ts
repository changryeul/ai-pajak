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
  const advisorUser = users.find((u) => u.email === 'advisor.test@jakartatax.co.id');

  if (!customerUser || !consultantUser || !advisorUser) {
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

  const { data: advisor } = await supabase
    .from('consultant')
    .select('id')
    .eq('user_id', advisorUser.id)
    .single();

  if (!customer || !consultant || !advisor) {
    console.error('Records not found:', { customer, consultant, advisor });
    return;
  }

  console.log('Customer:', customer.id);
  console.log('Consultant:', consultant.id);
  console.log('Advisor:', advisor.id);

  // Delete existing assignments
  await supabase.from('customer_consultant').delete().eq('customer_id', customer.id);

  // Assign customer to consultant
  const { error: err1 } = await supabase
    .from('customer_consultant')
    .insert({
      customer_id: customer.id,
      consultant_id: consultant.id,
      is_active: true,
    });

  if (err1) console.error('Consultant assignment error:', err1);
  else console.log('Assigned customer to consultant');

  // Assign customer to advisor
  const { error: err2 } = await supabase
    .from('customer_consultant')
    .insert({
      customer_id: customer.id,
      consultant_id: advisor.id,
      is_active: true,
    });

  if (err2) console.error('Advisor assignment error:', err2);
  else console.log('Assigned customer to advisor');
}

seed();
