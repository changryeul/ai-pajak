/**
 * POST /api/customers/bulk — CSV/JSON 일괄 고객 등록
 *
 * Body (JSON):
 *   { customers: Array<{
 *       full_name: string;
 *       company_name?: string;
 *       email?: string;
 *       phone?: string;
 *       npwp?: string;
 *       address?: string;
 *       customer_type: 'INDIVIDUAL' | 'COMPANY';
 *       business_category?: string;
 *       employee_count?: number;
 *       is_pkp?: boolean;
 *     }>
 *   }
 *
 * GET /api/customers/bulk/template — 다운로드 가능한 CSV 템플릿 (별도 라우트 불필요,
 *     프론트엔드에서 생성)
 *
 * Returns:
 *   { success, data: { total, created, skipped, errors: [{row, field, message}] } }
 *
 * Auth: CONSULTANT_JTC / TAX_ADVISOR_JTC only.
 * Each created customer is automatically linked to the caller's consultant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession, UserRole } from '@/types/auth';

interface BulkCustomerRow {
  full_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  npwp?: string;
  address?: string;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  business_category?: string;
  legal_form?: string;
  employee_count?: number;
  is_pkp?: boolean;
  is_umkm?: boolean;
  annual_revenue?: number;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

function validateRow(row: BulkCustomerRow, index: number): RowError[] {
  const errors: RowError[] = [];
  const r = index + 1; // 1-based for user display

  if (!row.full_name?.trim()) {
    errors.push({ row: r, field: 'full_name', message: 'Full name is required' });
  }

  if (!row.customer_type || !['INDIVIDUAL', 'COMPANY'].includes(row.customer_type)) {
    errors.push({ row: r, field: 'customer_type', message: 'customer_type must be INDIVIDUAL or COMPANY' });
  }

  if (row.customer_type === 'COMPANY' && !row.company_name?.trim()) {
    errors.push({ row: r, field: 'company_name', message: 'company_name is required for COMPANY' });
  }

  if (row.npwp && !/^\d{15,16}$/.test(row.npwp.replace(/[.\-\s]/g, ''))) {
    errors.push({ row: r, field: 'npwp', message: 'NPWP must be 15–16 digits' });
  }

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push({ row: r, field: 'email', message: 'Invalid email format' });
  }

  return errors;
}

async function handleBulkCreate(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const rows: BulkCustomerRow[] = body.customers;
    const { userId } = req.session;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'customers array is empty' },
        { status: 400 }
      );
    }

    if (rows.length > 200) {
      return NextResponse.json(
        { success: false, error: 'At most 200 rows per request' },
        { status: 400 }
      );
    }

    // Validate all rows first — fail fast on validation errors
    const allErrors: RowError[] = [];
    for (let i = 0; i < rows.length; i++) {
      allErrors.push(...validateRow(rows[i], i));
    }

    if (allErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `${allErrors.length} validation errors`,
        data: { total: rows.length, created: 0, skipped: rows.length, errors: allErrors },
      }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Look up caller's consultant
    const { data: consultant } = await admin
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!consultant) {
      return NextResponse.json(
        { success: false, error: 'No active consultant record' },
        { status: 403 }
      );
    }

    // Process rows one by one (for clear per-row error reporting).
    // Using upsert on NPWP to skip duplicates rather than failing.
    let created = 0;
    let skipped = 0;
    const insertErrors: RowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cleanNpwp = row.npwp?.replace(/[.\-\s]/g, '') || null;

      // Check duplicate NPWP within the same tax_partner scope
      if (cleanNpwp) {
        const { data: existing } = await admin
          .from('customer')
          .select('id')
          .eq('npwp', cleanNpwp)
          .maybeSingle();

        if (existing) {
          // Already exists — link to this consultant if not already linked,
          // but don't create a duplicate customer
          const { data: linkExists } = await admin
            .from('customer_consultant')
            .select('id')
            .eq('customer_id', existing.id)
            .eq('consultant_id', consultant.id)
            .maybeSingle();

          if (!linkExists) {
            await admin.from('customer_consultant').insert({
              customer_id: existing.id,
              consultant_id: consultant.id,
              is_active: true,
            });
          }

          skipped++;
          continue;
        }
      }

      // Insert customer
      const { data: customer, error: insertErr } = await admin
        .from('customer')
        .insert({
          full_name: row.full_name.trim(),
          company_name: row.company_name?.trim() || null,
          email: row.email?.trim() || '', // customer.email is NOT NULL in DB
          phone: row.phone?.trim() || null,
          npwp: cleanNpwp,
          address: row.address?.trim() || null,
          customer_type: row.customer_type,
          business_category: row.business_category || null,
          legal_form: row.legal_form || null,
          employee_count: row.employee_count ?? null,
          is_pkp: row.is_pkp ?? null,
          is_umkm: row.is_umkm ?? null,
          annual_revenue: row.annual_revenue ?? null,
        })
        .select('id')
        .single();

      if (insertErr || !customer) {
        insertErrors.push({
          row: i + 1,
          field: 'insert',
          message: insertErr?.message || 'Unknown insert error',
        });
        continue;
      }

      // Link to consultant
      const { error: linkErr } = await admin
        .from('customer_consultant')
        .insert({
          customer_id: customer.id,
          consultant_id: consultant.id,
          is_active: true,
        });

      if (linkErr) {
        // Rollback orphan
        await admin.from('customer').delete().eq('id', customer.id);
        insertErrors.push({
          row: i + 1,
          field: 'link',
          message: linkErr.message,
        });
        continue;
      }

      created++;
    }

    loggers.api.info(
      { total: rows.length, created, skipped, errors: insertErrors.length, consultantId: consultant.id },
      'Bulk customer import completed',
    );

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        created,
        skipped,
        errors: insertErrors,
      },
      message: `${created} created, ${skipped} skipped (existing NPWP), ${insertErrors.length} errors`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Bulk customer import error');
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('CUSTOMER_BULK_IMPORT')
  )(request as RequestWithSession, handleBulkCreate);
}
