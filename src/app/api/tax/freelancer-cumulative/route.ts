import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * GET /api/tax/freelancer-cumulative?customerId=xxx&employeeId=yyy&year=2025
 * PUT /api/tax/freelancer-cumulative — Update monthly entry
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const p = new URL(request.url).searchParams;
    const customerId = p.get('customerId');
    const employeeId = p.get('employeeId');
    const year = Number(p.get('year')) || new Date().getFullYear();

    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    let query = admin.from('freelancer_cumulative').select('*, employee:employee_id(employee_name)')
      .eq('customer_id', customerId).eq('tax_year', year);
    if (employeeId) query = query.eq('employee_id', employeeId);

    const { data } = await query;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    loggers.api.error({ err: error }, 'Freelancer cumulative GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { customerId, employeeId, taxYear, month, gross, expenses } = body;

    if (!customerId || !employeeId || !taxYear || !month) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const DPP_RATE = 0.5; // 50% DPP for freelancers

    // Upsert cumulative record
    const { data: existing } = await admin.from('freelancer_cumulative')
      .select('*').eq('employee_id', employeeId).eq('tax_year', taxYear).maybeSingle();

    const entries = existing?.monthly_entries || [];
    const monthKey = String(month).padStart(2, '0');
    const netIncome = (Number(gross) || 0) * DPP_RATE;
    const entryIdx = entries.findIndex((e: { month: string }) => e.month === monthKey);
    const entry = { month: monthKey, gross: Number(gross) || 0, expenses: Number(expenses) || 0, net: netIncome };

    if (entryIdx >= 0) entries[entryIdx] = entry;
    else entries.push(entry);
    entries.sort((a: { month: string }, b: { month: string }) => a.month.localeCompare(b.month));

    // Recalculate cumulative
    const cumGross = entries.reduce((s: number, e: { gross: number }) => s + e.gross, 0);
    const cumExpenses = entries.reduce((s: number, e: { expenses: number }) => s + e.expenses, 0);
    const cumNet = entries.reduce((s: number, e: { net: number }) => s + e.net, 0);

    const upsertData = {
      customer_id: customerId,
      employee_id: employeeId,
      tax_year: taxYear,
      monthly_entries: entries,
      cumulative_gross: cumGross,
      cumulative_expenses: cumExpenses,
      cumulative_net: cumNet,
    };

    if (existing) {
      await admin.from('freelancer_cumulative').update(upsertData).eq('id', existing.id);
    } else {
      await admin.from('freelancer_cumulative').insert(upsertData);
    }

    return NextResponse.json({ success: true, data: upsertData });
  } catch (error) {
    loggers.api.error({ err: error }, 'Freelancer cumulative PUT error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
