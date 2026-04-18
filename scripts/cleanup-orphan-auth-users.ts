/**
 * Find and optionally delete orphan auth.users rows — auth users that have
 * no corresponding customer/consultant record. These are typically left
 * behind when the first signup attempt failed partway (e.g., the legacy
 * FK-violation bug). Without cleanup the user cannot re-register.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphan-auth-users.ts              # list only
 *   npx tsx scripts/cleanup-orphan-auth-users.ts --email=X    # check one email
 *   npx tsx scripts/cleanup-orphan-auth-users.ts --delete     # delete all orphans
 *   SEED_TARGET=prod npx tsx scripts/cleanup-orphan-auth-users.ts --delete
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

async function main() {
  // loadEnvConfig reads .env.local first; .env.production.local wins when
  // NODE_ENV=production. Let the caller set that via SEED_TARGET=prod.
  if (process.env.SEED_TARGET === 'prod') {
    (process.env as Record<string, string>).NODE_ENV = 'production';
  }
  loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key);
  console.log(`target: ${url}`);

  const argEmail = process.argv.find((a) => a.startsWith('--email='))?.split('=')[1];
  const shouldDelete = process.argv.includes('--delete');

  // Prod GoTrue `listUsers` is broken with per_page > 1; the direct REST
  // endpoint also 500s on bulk. But `?email=X` filter works for a single
  // email lookup. So we only support --email= mode in scripts that talk
  // to a broken-admin prod; bulk mode falls back to listUsers with
  // per_page=200 which works on local.
  let authUsers: { id: string; email: string | null; created_at: string | null }[] = [];
  if (argEmail) {
    const resp = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(argEmail)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = await resp.json();
    if (resp.ok && Array.isArray(body.users)) {
      authUsers = body.users.map((u: { id: string; email?: string; created_at?: string }) => ({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
      }));
    } else {
      console.error('admin/users by email error:', body);
    }
  } else {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      console.error('listUsers error (use --email=<addr> on prod):', error);
      return;
    }
    authUsers = (data?.users || []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at ?? null,
    }));
  }

  const orphans: { id: string; email: string | null; created_at: string | null }[] = [];
  for (const u of authUsers) {
    if (argEmail && u.email !== argEmail) continue;

    const [{ data: cust }, { data: cons }] = await Promise.all([
      admin.from('customer').select('id').eq('user_id', u.id).limit(1),
      admin.from('consultant').select('id').eq('user_id', u.id).limit(1),
    ]);
    const hasCustomer = (cust as { id: string }[] | null)?.length;
    const hasConsultant = (cons as { id: string }[] | null)?.length;

    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', u.id)
      .eq('is_active', true);
    const hasOperatorRole = (roles as { role: string }[] | null)?.some((r) =>
      ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER', 'PLATFORM_ADMIN', 'SYSTEM'].includes(r.role),
    );

    if (!hasCustomer && !hasConsultant && !hasOperatorRole) {
      orphans.push({ id: u.id, email: u.email, created_at: u.created_at });
    }
  }

  console.log(`\nFound ${orphans.length} orphan auth users`);
  orphans.forEach((o) => console.log(`  ${o.created_at}  ${o.id}  ${o.email}`));

  if (!shouldDelete) {
    console.log('\n(dry run — pass --delete to remove)');
    return;
  }

  console.log(`\nDeleting ${orphans.length} orphan users…`);
  let ok = 0;
  for (const o of orphans) {
    const { error } = await admin.auth.admin.deleteUser(o.id);
    if (error) console.log(`  ✗ ${o.email}: ${error.message}`);
    else { ok += 1; console.log(`  ✓ ${o.email}`); }
  }
  console.log(`\nDeleted ${ok} / ${orphans.length}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
