import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/company-profile/determine-tax
 *
 * Rule-based tax regime determination + AI follow-up question generation.
 * Determines: UMKM_FINAL (0.5%) vs GENERAL_25 (22%) vs SPECIAL
 * Also generates follow-up questions for incomplete profiles.
 */

interface TaxDetermination {
  regime: string;
  reason: string;
  applicableTaxes: string[];
  followUpQuestions: Array<{ question: string }>;
}

function determineTaxRegime(profile: Record<string, unknown>): TaxDetermination {
  const revenue = Number(profile.annual_revenue || 0);
  const legalForm = profile.legal_form as string || '';
  const isUmkm = !!profile.is_umkm;
  const estYear = Number(profile.established_year || 0);
  const umkmStartYear = Number(profile.umkm_final_tax_start_year || 0);
  const currentYear = new Date().getFullYear();
  const category = profile.business_category as string || '';

  const applicableTaxes: string[] = [];
  const followUpQuestions: Array<{ question: string }> = [];

  // ── Step 1: PPh Final UMKM vs PPh Badan 일반 ──
  let regime = 'GENERAL_25';
  let reason = '';

  // All copy is English. Indonesian tax-law references (PP, PMK, SBU codes)
  // remain in their statutory form.
  if (isUmkm && revenue > 0 && revenue < 4_800_000_000) {
    // Check UMKM period limit
    const maxYears = ['PT'].includes(legalForm) ? 3 : ['CV', 'FIRMA'].includes(legalForm) ? 4 : 7;
    const yearsUsed = umkmStartYear > 0 ? currentYear - umkmStartYear : 0;

    if (yearsUsed < maxYears) {
      regime = 'UMKM_FINAL';
      reason = `PP 55/2022 applies: annual revenue Rp ${Math.round(revenue).toLocaleString('id-ID')} (< Rp 4,800,000,000); ${legalForm || 'entity'} — year ${yearsUsed} of ${maxYears}-year UMKM eligibility.`;
    } else {
      regime = 'GENERAL_25';
      reason = `UMKM PPh Final period expired: ${legalForm} exceeded the ${maxYears}-year limit (${umkmStartYear}~${currentYear}). Standard PPh Badan 22% applies.`;
    }
  } else if (revenue >= 4_800_000_000) {
    regime = 'GENERAL_25';
    reason = `Annual revenue Rp ${Math.round(revenue).toLocaleString('id-ID')} — at or above Rp 4,800,000,000, so standard PPh Badan 22% applies.`;
  } else if (!isUmkm && revenue > 0 && revenue < 4_800_000_000) {
    followUpQuestions.push({ question: 'Annual revenue is under Rp 4.8B. Are you registered under PP 55/2022 (UMKM PPh Final 0.5%)?' });
    regime = 'GENERAL_25';
    reason = 'Not registered as UMKM — standard PPh Badan 22% applies (0.5% available if PP 55 is registered).';
  }

  if (revenue === 0) {
    followUpQuestions.push({ question: 'What was your total revenue in the past 12 months? (Required to decide PPh Final vs PPh Badan)' });
  }

  // ── Step 2: per-tax applicability ──

  // PPh 21 — employees
  if (profile.has_employees) {
    applicableTaxes.push('PPh 21 (employment income tax)');
  } else {
    followUpQuestions.push({ question: 'Do you employ at least one person (full-time, contract, or daily)?' });
  }

  // PPN — PKP
  if (profile.is_pkp) {
    applicableTaxes.push('PPN 11% (VAT)');
  } else if (revenue >= 4_800_000_000) {
    followUpQuestions.push({ question: 'Annual revenue above Rp 4.8B requires PKP registration. Please confirm your PKP status.' });
  }

  // PPh 23 — services purchased
  if (profile.pays_service_fees) {
    applicableTaxes.push('PPh 23 (service withholding 2%)');
  }

  // PPh 4(2) — rental
  if (profile.has_rental_business) {
    applicableTaxes.push('PPh 4(2) Final 10% (rental income)');
  }
  if (profile.pays_rent) {
    applicableTaxes.push('PPh 4(2) 10% (rent withholding)');
  }

  // PPh 22 — import
  if (profile.has_import_export) {
    applicableTaxes.push('PPh 22 (import) + PPN Import');
  }

  // PPh 4(2) — construction
  if (profile.has_construction_sbu || category === 'CONSTRUCTION') {
    const sbuGrade = profile.sbu_qualification as string || '';
    const rate = sbuGrade === 'SMALL' ? '1.75%' : sbuGrade === 'MEDIUM' ? '2.65%' : sbuGrade === 'LARGE' ? '4%' : '?%';
    applicableTaxes.push(`PPh 4(2) Final ${rate} (construction)`);
    if (!sbuGrade) {
      followUpQuestions.push({ question: 'What is your construction SBU (Sertifikat Badan Usaha) grade? (Kecil/Menengah/Besar)' });
    }
  }

  // PPh 4(2) — property
  if (profile.sells_property) {
    applicableTaxes.push('PPh 4(2) Final 2.5% (property transfer)');
  }

  // PPh 23 — dividend/interest/royalty
  if (profile.receives_dividends) applicableTaxes.push('PPh 23 15% (dividend income)');
  if (profile.receives_interest) applicableTaxes.push('PPh 23/4(2) (interest income)');
  if (profile.receives_royalties || profile.has_franchise) applicableTaxes.push('PPh 23 15% (royalty)');

  // PPh 26 — non-resident
  if (profile.has_foreign_shareholders) {
    applicableTaxes.push('PPh 26 (foreign dividend/interest/royalty)');
    if (!profile.parent_company_country) {
      followUpQuestions.push({ question: 'Which country are your foreign shareholders resident in? (Required to determine DTA treaty rate)' });
    }
  }

  // PPh 15 — shipping/airline
  if (profile.has_shipping_business) {
    applicableTaxes.push('PPh 15 (shipping/airline 1.2~2.64%)');
  }

  // F&B specific
  if (profile.is_restaurant) {
    applicableTaxes.push('Pajak Restoran (local tax, PPN exempt)');
  }
  if (profile.is_catering) {
    applicableTaxes.push('PPh 23 2% (catering service)');
  }

  // ── Step 3: extra questions when profile is incomplete ──
  if (!category) {
    followUpQuestions.push({ question: 'What is your primary business category? (service / trade / manufacturing / construction / property / restaurant…)' });
  }
  if (!legalForm) {
    followUpQuestions.push({ question: 'What is your legal form? (PT/CV/UD/Firma — needed to decide the UMKM period limit)' });
  }
  if (!estYear && isUmkm) {
    followUpQuestions.push({ question: 'In which year was the company established? (To check the UMKM PPh Final period limit)' });
  }

  return { regime, reason, applicableTaxes, followUpQuestions };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const admin = getSupabaseAdmin();

    const customerId = body.id;
    if (!customerId) return NextResponse.json({ error: 'customer id required' }, { status: 400 });

    const result = determineTaxRegime(body);

    // Save determination + questions to DB
    const { data: updated, error: updateError } = await admin
      .from('customer')
      .update({
        tax_regime: result.regime,
        tax_regime_reason: result.reason,
        tax_regime_determined_at: new Date().toISOString(),
        ai_profile_questions: result.followUpQuestions,
      })
      .eq('id', customerId)
      .select()
      .single();

    if (updateError) {
      // No row for this id → PostgREST cannot coerce .single() (PGRST116).
      // That is a bad customer id, not a server fault — return 404.
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      loggers.api.error({ err: updateError }, 'Tax regime save failed');
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    loggers.api.info({ customerId, regime: result.regime, taxes: result.applicableTaxes.length }, 'Tax regime determined');

    return NextResponse.json({
      success: true,
      data: {
        regime: result.regime,
        reason: result.reason,
        applicableTaxes: result.applicableTaxes,
        followUpQuestions: result.followUpQuestions,
        profile: updated,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Tax determination error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
