import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/counterparties/search?q=...&npwp=...
 *
 * Search the global counterparty_registry for auto-fill.
 *   - npwp param: exact match (priority)
 *   - q param: fuzzy name search via pg_trgm similarity
 *
 * Returns up to 10 matches so the client can auto-fill on selection.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const npwpParam = params.get('npwp');
    const qParam = params.get('q');

    const admin = getSupabaseAdmin();

    // Exact NPWP match first
    if (npwpParam) {
      const digits = npwpParam.replace(/\D/g, '');
      if (digits.length >= 15) {
        const { data } = await admin
          .from('counterparty_registry')
          .select('*')
          .eq('npwp', digits)
          .maybeSingle();
        return NextResponse.json({ success: true, data: data ? [data] : [] });
      }
    }

    // Fuzzy name search
    if (qParam && qParam.length >= 2) {
      const { data } = await admin
        .from('counterparty_registry')
        .select('*')
        .ilike('name', `%${qParam}%`)
        .order('usage_count', { ascending: false })
        .limit(10);
      return NextResponse.json({ success: true, data: data || [] });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
