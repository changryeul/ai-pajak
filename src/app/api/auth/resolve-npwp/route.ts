import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/auth/resolve-npwp?npwp=15digits
 *
 * Public endpoint called from the login page to translate an NPWP (login
 * identifier for corporate customers) into the internal email used by
 * Supabase auth.
 *
 * Security notes:
 * - Rate-limited via middleware.ts (rate-limit rules apply to /api/*)
 * - Only returns email (not PII) — attacker gains email leak only if they
 *   already know a valid NPWP, which is printed on every invoice anyway.
 */
export async function GET(request: NextRequest) {
  try {
    const npwpRaw = new URL(request.url).searchParams.get('npwp') || '';
    const digits = npwpRaw.replace(/\D/g, '');

    if (digits.length !== 15) {
      return NextResponse.json(
        { success: false, error: 'Invalid NPWP format' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Try exact match on the formatted or digit-only NPWP
    const formatted = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12, 15)}`;

    const { data: customer } = await admin
      .from('customer')
      .select('email, user_id, customer_type')
      .or(`npwp.eq.${formatted},npwp.eq.${digits}`)
      .eq('customer_type', 'COMPANY')
      .maybeSingle();

    if (!customer || !customer.email) {
      return NextResponse.json(
        { success: false, error: 'No account found for this NPWP' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, email: customer.email });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
