import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { invalidateRateCache } from '@/lib/tax/rate-provider';

/**
 * GET /api/admin/tax-rates?category=PPH21_BRACKET
 * PUT /api/admin/tax-rates - Update a rate (PLATFORM_ADMIN only)
 * POST /api/admin/tax-rates - Add a new rate (PLATFORM_ADMIN only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    let query = getSupabaseAdmin()
      .from('tax_rate_config')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('sort_order');

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by category
    const grouped: Record<string, typeof data> = {};
    for (const item of data || []) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    const categories = [
      { code: 'PPH21_BRACKET', label: 'PPh 21 - Tarif Progresif', icon: 'progressive' },
      { code: 'PPH21_TER_A', label: 'PPh 21 TER Kategori A (TK/0, TK/1, K/0)', icon: 'ter' },
      { code: 'PPH21_TER_B', label: 'PPh 21 TER Kategori B (TK/2, TK/3, K/1, K/2)', icon: 'ter' },
      { code: 'PPH21_TER_C', label: 'PPh 21 TER Kategori C (K/3)', icon: 'ter' },
      { code: 'PPH23', label: 'PPh 23 - Tarif Pemotongan', icon: 'withholding' },
      { code: 'PPH23_SERVICE', label: 'PPh 23 - Jasa Lain 62 Jenis (PMK 141/2015)', icon: 'service' },
      { code: 'PPH42_CONSTRUCTION', label: 'PPh 4(2) - Jasa Konstruksi (PP 9/2022)', icon: 'construction' },
      { code: 'PTKP', label: 'PTKP - Penghasilan Tidak Kena Pajak', icon: 'exemption' },
      { code: 'PPN', label: 'PPN - Pajak Pertambahan Nilai', icon: 'vat' },
      { code: 'PPH_FINAL', label: 'PPh Final', icon: 'final' },
      { code: 'CORPORATE', label: 'PPh Badan', icon: 'corporate' },
      { code: 'PPH22', label: 'PPh 22 - Impor', icon: 'import' },
      { code: 'NPWP_SURCHARGE', label: 'Kenaikan Tarif Tanpa NPWP', icon: 'surcharge' },
      { code: 'LIMITS', label: 'Batas & Limit', icon: 'limits' },
    ];

    return NextResponse.json({ success: true, data: { rates: data || [], grouped, categories } });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check admin role
    const { data: role } = await getSupabaseAdmin()
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!['PLATFORM_ADMIN', 'TAX_OPERATOR_MASTER'].includes(role?.role ?? '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, rateValue, amountValue, thresholdMin, thresholdMax, label, legalBasis, effectiveDate } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updateData: Record<string, unknown> = { updated_by_user_id: user.id };
    if (rateValue !== undefined) updateData.rate_value = rateValue;
    if (amountValue !== undefined) updateData.amount_value = amountValue;
    if (thresholdMin !== undefined) updateData.threshold_min = thresholdMin;
    if (thresholdMax !== undefined) updateData.threshold_max = thresholdMax;
    if (label) updateData.label = label;
    if (legalBasis) updateData.legal_basis = legalBasis;
    if (effectiveDate) updateData.effective_date = effectiveDate;

    const { error } = await getSupabaseAdmin()
      .from('tax_rate_config')
      .update(updateData)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Drop this instance's rate cache so PPh21 picks up the edit within ~60s
    // across all instances (immediately on this one).
    invalidateRateCache();
    return NextResponse.json({ success: true, message: 'Rate updated' });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: role } = await getSupabaseAdmin()
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!['PLATFORM_ADMIN', 'TAX_OPERATOR_MASTER'].includes(role?.role ?? '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { category, code, label, rateValue, amountValue, thresholdMin, thresholdMax, legalBasis, effectiveDate, sortOrder } = body;

    if (!category || !code || !label || !effectiveDate) {
      return NextResponse.json({ error: 'category, code, label, effectiveDate required' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('tax_rate_config')
      .insert({
        category, code, label,
        rate_value: rateValue, amount_value: amountValue,
        threshold_min: thresholdMin, threshold_max: thresholdMax,
        legal_basis: legalBasis, effective_date: effectiveDate,
        sort_order: sortOrder || 0,
        updated_by_user_id: user.id,
      })
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
