/**
 * 현재 프로덕션 계정을 역할·유형별로 표로 정리 (read-only).
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/report-accounts.ts
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
  // (1) tax_partner 목록
  const { data: partners } = await admin
    .from('tax_partner')
    .select('id, name, partner_type, is_default_filing_partner, is_active')
    .order('partner_type');
  console.log('=== TAX PARTNER 목록 ===');
  (partners || []).forEach(p => {
    console.log(`   [${p.partner_type}${p.is_default_filing_partner ? '·default' : ''}] ${p.name}  ${p.is_active ? '' : '(비활성)'}`);
  });

  // (2) user_roles 전체
  const { data: roles } = await admin
    .from('user_roles')
    .select('user_id, role, organization_id, organization_type, is_active')
    .eq('is_active', true);

  const roleGroups = new Map<string, typeof roles>();
  (roles || []).forEach(r => {
    if (!roleGroups.has(r.role)) roleGroups.set(r.role, []);
    roleGroups.get(r.role)!.push(r);
  });

  // (3) customer / consultant / auth 매핑 조회
  const { data: customers } = await admin
    .from('customer')
    .select('id, user_id, customer_type, full_name, company_name, email');
  const { data: consultants } = await admin
    .from('consultant')
    .select('id, user_id, full_name, email, tax_partner_id, is_active');

  const custByUser = new Map((customers || []).map(c => [c.user_id, c]));
  const consByUser = new Map((consultants || []).map(c => [c.user_id, c]));
  const partnerName = new Map((partners || []).map(p => [p.id, `${p.partner_type}·${p.name}`]));

  // (4) 배정된 customer 수 (컨설턴트별)
  const { data: allAssigned } = await admin
    .from('customer_consultant')
    .select('consultant_id')
    .eq('is_active', true);
  const loadByConsultantId = new Map<string, number>();
  (allAssigned || []).forEach(a => loadByConsultantId.set(a.consultant_id, (loadByConsultantId.get(a.consultant_id) || 0) + 1));

  // (5) 역할별 리포트
  const order = [
    'CUSTOMER',
    'CONSULTANT',
    'TAX_ADVISOR',
    'TAX_OPERATOR',
    'TAX_OPERATOR_LEAD',
    'TAX_OPERATOR_SUPERVISOR',
    'TAX_OPERATOR_MASTER',
    'PLATFORM_ADMIN',
    'SYSTEM',
  ];
  for (const role of order) {
    const rows = roleGroups.get(role) || [];
    if (rows.length === 0) continue;
    console.log(`\n=== ${role} (${rows.length}) ===`);
    for (const r of rows) {
      const cust = custByUser.get(r.user_id);
      const cons = consByUser.get(r.user_id);
      if (cust) {
        const type = cust.customer_type === 'COMPANY' ? '법인' : '개인';
        const label = cust.company_name || cust.full_name;
        console.log(`   ${type} · ${(label || '').padEnd(30)} <${cust.email}>`);
      } else if (cons) {
        const p = cons.tax_partner_id ? partnerName.get(cons.tax_partner_id) : '?';
        const load = loadByConsultantId.get(cons.id) || 0;
        console.log(`   ${(cons.full_name || '').padEnd(30)} <${cons.email}>  tenant=${p}  load=${load}`);
      } else {
        console.log(`   (auth uid=${r.user_id.slice(0, 8)}…, no customer/consultant row)`);
      }
    }
  }

  // (6) 전체 요약
  console.log(`\n=== 요약 ===`);
  console.log(`   tax_partner: ${partners?.length ?? 0} (JTC ${partners?.filter(p => p.partner_type === 'JTC').length ?? 0} / EXTERNAL ${partners?.filter(p => p.partner_type === 'EXTERNAL').length ?? 0})`);
  console.log(`   customer:    ${customers?.length ?? 0} (개인 ${customers?.filter(c => c.customer_type === 'INDIVIDUAL').length ?? 0} / 법인 ${customers?.filter(c => c.customer_type === 'COMPANY').length ?? 0})`);
  console.log(`   consultant:  ${consultants?.length ?? 0} 활성 ${consultants?.filter(c => c.is_active).length ?? 0}`);
  console.log(`   user_roles:  ${roles?.length ?? 0} 활성`);
}

main().catch(e => { console.error(e); process.exit(1); });
