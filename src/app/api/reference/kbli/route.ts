import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/reference/kbli?q=keyword
 *
 * Search KBLI codes by code prefix or description match.
 * Returns up to 20 results. Publicly accessible (reference data).
 */
export async function GET(request: NextRequest) {
  try {
    const q = new URL(request.url).searchParams.get('q')?.trim() || '';
    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const admin = getSupabaseAdmin();

    // Try code prefix first (numeric input), then description/category ilike
    const isNumeric = /^\d+$/.test(q);

    const orFilter = isNumeric
      ? `code.ilike.${q}%,description.ilike.%${q}%`
      : `code.ilike.${q}%,description.ilike.%${q}%,category.ilike.%${q}%`;

    const { data, error } = await admin
      .from('klu_codes')
      .select('code, description, category')
      .or(orFilter)
      .order('code')
      .limit(20);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
