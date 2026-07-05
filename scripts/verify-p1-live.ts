/**
 * P1 실무 데이터 검증 — Tommy Lee 담당 신규 배정 13건 + 마이그 P4 실효성.
 * 부수효과 없음 (read-only).
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/verify-p1-live.ts
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.production.local' });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const TOMMY = 'iamtommylee66@gmail.com';

  // 1) Tommy Lee consultant + 담당 customer
  const { data: tommy } = await admin
    .from('consultant')
    .select('id, full_name, email, tax_partner_id')
    .eq('email', TOMMY)
    .maybeSingle();
  if (!tommy) { console.error('Tommy Lee not found'); process.exit(1); }

  const { data: assignments } = await admin
    .from('customer_consultant')
    .select('customer_id, created_at, is_active, customer:customer_id(id, customer_type, full_name, company_name, npwp, created_at)')
    .eq('consultant_id', tommy.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  console.log(`\n[Tommy Lee] ${assignments?.length ?? 0} active customer(s):`);
  (assignments || []).forEach((a, i) => {
    const c = (a.customer as unknown as { customer_type: string; full_name: string; company_name: string | null; npwp: string | null }) || null;
    if (!c) return;
    const label = c.company_name || c.full_name;
    const type = c.customer_type === 'COMPANY' ? '법인' : '개인';
    console.log(`   ${(i + 1).toString().padStart(2)}. ${type} · ${(label || '').padEnd(28)} NPWP=${c.npwp || '-'}`);
  });

  // 2) 미배정 큐 실 카운트
  const { data: assignedRows } = await admin
    .from('customer_consultant')
    .select('customer_id')
    .eq('is_active', true);
  const assignedIds = new Set((assignedRows || []).map(r => r.customer_id));
  const { data: allCustomers } = await admin
    .from('customer')
    .select('id');
  const unassignedCount = (allCustomers || []).filter(c => !assignedIds.has(c.id)).length;
  console.log(`\n[unassigned queue] count = ${unassignedCount}`);

  // 3) tax_filing.tax_partner_id backfill 검증 (P4)
  const { count: filingsTotal } = await admin
    .from('tax_filing')
    .select('*', { count: 'exact', head: true });
  const { count: filingsWithPartner } = await admin
    .from('tax_filing')
    .select('*', { count: 'exact', head: true })
    .not('tax_partner_id', 'is', null);
  console.log(`\n[P4 backfill] tax_filing rows with tax_partner_id = ${filingsWithPartner}/${filingsTotal}`);

  // 4) Consultant 별 workload 분포 (JTC only)
  const { data: jtcPartner } = await admin
    .from('tax_partner')
    .select('id')
    .eq('partner_type', 'JTC')
    .maybeSingle();
  const { data: jtcConsultants } = await admin
    .from('consultant')
    .select('id, full_name, email')
    .eq('tax_partner_id', jtcPartner!.id)
    .eq('is_active', true);

  console.log(`\n[JTC workload distribution]`);
  for (const c of (jtcConsultants || [])) {
    const { count } = await admin
      .from('customer_consultant')
      .select('*', { count: 'exact', head: true })
      .eq('consultant_id', c.id)
      .eq('is_active', true);
    console.log(`   ${(c.full_name || '').padEnd(30)} load=${count}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
