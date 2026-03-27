import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/marketplace/consultants?specialization=PPh21&rating=4
 *
 * Search and browse tax consultants.
 * Customers can find, compare, and request consultants.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const specialization = url.searchParams.get('specialization');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let query = getSupabaseAdmin()
      .from('consultant')
      .select(`
        id, user_id, is_active,
        tax_partner:tax_partner_id (company_name),
        user:user_id (email)
      `)
      .eq('is_active', true)
      .range((page - 1) * limit, page * limit - 1);

    const { data: consultants } = await query;

    // Get tax advisors for license info
    const consultantIds = (consultants || []).map(c => c.id);
    const { data: advisors } = await getSupabaseAdmin()
      .from('tax_advisor')
      .select('consultant_id, license_number, specializations')
      .in('consultant_id', consultantIds.length > 0 ? consultantIds : ['none']);

    const advisorMap = new Map((advisors || []).map(a => [a.consultant_id, a]));

    // Get client counts
    const results = await Promise.all(
      (consultants || []).map(async (c) => {
        const { count } = await getSupabaseAdmin()
          .from('customer_consultant')
          .select('id', { count: 'exact', head: true })
          .eq('consultant_id', c.id)
          .eq('is_active', true);

        const advisor = advisorMap.get(c.id);
        const partnerRaw = c.tax_partner;
        const partner = (Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw) as { company_name: string } | null;

        return {
          id: c.id,
          firmName: partner?.company_name || 'Independent',
          isLicensed: !!advisor,
          licenseNumber: advisor?.license_number || null,
          specializations: advisor?.specializations || [],
          activeClients: count || 0,
          rating: 4.5, // Placeholder - would come from reviews
          reviewCount: 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        consultants: results,
        pagination: { page, limit, total: results.length },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to list consultants' }, { status: 500 });
  }
}
