import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from('user_roles').select('role').eq('user_id', userId).single();
  return data?.role === 'PLATFORM_ADMIN';
}

/**
 * GET /api/admin/consultants - List all consultants with stats
 * PUT /api/admin/consultants - Update consultant/advisor info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    // Get consultants with user info
    const { data: consultants } = await getSupabaseAdmin()
      .from('consultant')
      .select(`id, user_id, is_active, tax_partner_id,
        tax_partner:tax_partner_id(id, company_name),
        user:user_id(email)`)
      .order('created_at', { ascending: false });

    // Get tax advisors
    const { data: advisors } = await getSupabaseAdmin()
      .from('tax_advisor')
      .select('id, consultant_id, license_number, specializations, is_active');

    const advisorMap = new Map((advisors || []).map(a => [a.consultant_id, a]));

    // Get client counts per consultant
    const { data: assignments } = await getSupabaseAdmin()
      .from('customer_consultant')
      .select('consultant_id, is_active');

    const clientCounts: Record<string, { active: number; total: number }> = {};
    for (const a of assignments || []) {
      if (!clientCounts[a.consultant_id]) clientCounts[a.consultant_id] = { active: 0, total: 0 };
      clientCounts[a.consultant_id].total++;
      if (a.is_active) clientCounts[a.consultant_id].active++;
    }

    // Get filing counts per consultant
    const { data: filings } = await getSupabaseAdmin()
      .from('tax_calculation')
      .select('consultant_id');

    const filingCounts: Record<string, number> = {};
    for (const f of filings || []) {
      filingCounts[f.consultant_id] = (filingCounts[f.consultant_id] || 0) + 1;
    }

    const result = (consultants || []).map(c => {
      const partner = Array.isArray(c.tax_partner) ? c.tax_partner[0] : c.tax_partner;
      const userInfo = Array.isArray(c.user) ? c.user[0] : c.user;
      const advisor = advisorMap.get(c.id);
      const clients = clientCounts[c.id] || { active: 0, total: 0 };

      return {
        id: c.id,
        userId: c.user_id,
        email: (userInfo as { email: string } | null)?.email || '',
        firmName: (partner as { company_name: string } | null)?.company_name || 'Independent',
        isActive: c.is_active,
        isAdvisor: !!advisor,
        licenseNumber: advisor?.license_number || null,
        specializations: advisor?.specializations || [],
        advisorActive: advisor?.is_active ?? false,
        activeClients: clients.active,
        totalClients: clients.total,
        filingCount: filingCounts[c.id] || 0,
      };
    });

    const stats = {
      totalConsultants: result.length,
      activeConsultants: result.filter(c => c.isActive).length,
      licensedAdvisors: result.filter(c => c.isAdvisor).length,
      totalClients: Object.values(clientCounts).reduce((s, c) => s + c.active, 0),
    };

    return NextResponse.json({ success: true, data: { consultants: result, stats } });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await request.json();
    const { consultantId, action } = body;
    if (!consultantId) return NextResponse.json({ error: 'consultantId required' }, { status: 400 });

    switch (action) {
      case 'activate':
        await getSupabaseAdmin().from('consultant').update({ is_active: true }).eq('id', consultantId);
        return NextResponse.json({ success: true, message: 'Activated' });
      case 'deactivate':
        await getSupabaseAdmin().from('consultant').update({ is_active: false }).eq('id', consultantId);
        return NextResponse.json({ success: true, message: 'Deactivated' });
      case 'update-license': {
        const { licenseNumber, specializations } = body;
        const { data: advisor } = await getSupabaseAdmin().from('tax_advisor').select('id').eq('consultant_id', consultantId).single();
        if (advisor) {
          await getSupabaseAdmin().from('tax_advisor').update({ license_number: licenseNumber, specializations }).eq('id', advisor.id);
        }
        return NextResponse.json({ success: true, message: 'License updated' });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
