import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { loggers } from '@/lib/logger';
import { generateBPNumber1721A1 } from '@/lib/tax/ebupot/pph21-bupot-service';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/tax/ebupot-pph21?customerId=xxx&period=YYYY-MM
 *   → List payslips with e-Bupot status for period
 *
 * POST /api/tax/ebupot-pph21
 *   body: { customerId, period }
 *   → Generate 1721-A1 Bukti Potong numbers for all payslips in period
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId');
    const period = url.searchParams.get('period');

    if (!customerId || !period) {
      return NextResponse.json({ error: 'customerId and period required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: payslips } = await admin
      .from('monthly_payslip')
      .select('id, employee_id, period, pph21_tax, total_gross, net_salary, status, employee:employee_id(employee_name, employee_npwp)')
      .eq('customer_id', customerId)
      .eq('period', period)
      .order('created_at');

    // Check which have BP numbers (stored in metadata or separate field — we'll use status convention)
    const total = (payslips || []).length;
    const withTax = (payslips || []).filter(p => Number(p.pph21_tax) > 0).length;

    return NextResponse.json({
      success: true,
      data: {
        period,
        totalEmployees: total,
        withTax,
        payslips: payslips || [],
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'e-Bupot PPh21 GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, period } = body;

    if (!customerId || !period) {
      return NextResponse.json({ error: 'customerId and period required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Get payslips with PPh 21 > 0
    const { data: payslips } = await admin
      .from('monthly_payslip')
      .select('id, pph21_tax, employee:employee_id(employee_name, employee_npwp)')
      .eq('customer_id', customerId)
      .eq('period', period)
      .gt('pph21_tax', 0)
      .order('created_at');

    if (!payslips || payslips.length === 0) {
      return NextResponse.json({
        success: true,
        data: { generated: 0 },
        message: 'No e-Bupot to generate (PPh 21 = 0)',
      });
    }

    // Generate BP numbers
    const generated: Array<{ employeeName: string; bpNumber: string; pph21: number }> = [];
    for (let i = 0; i < payslips.length; i++) {
      const ps = payslips[i];
      const bpNumber = generateBPNumber1721A1(period, i + 1);
      generated.push({
        employeeName: (ps.employee as unknown as { employee_name: string })?.employee_name || 'Unknown',
        bpNumber,
        pph21: Number(ps.pph21_tax),
      });
    }

    loggers.api.info({ customerId, period, count: generated.length }, 'e-Bupot 1721-A1 generated');

    return NextResponse.json({
      success: true,
      data: {
        generated: generated.length,
        period,
        buktiPotongs: generated,
      },
      message: `${generated.length} Bukti Potong 1721-A1 generated`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'e-Bupot PPh21 POST error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('EBUPOT_PPH21_GENERATE'))(request as RequestWithSession, handlePost);
}
