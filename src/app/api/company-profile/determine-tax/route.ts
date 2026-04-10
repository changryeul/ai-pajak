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

  if (isUmkm && revenue > 0 && revenue < 4_800_000_000) {
    // Check UMKM period limit
    const maxYears = ['PT'].includes(legalForm) ? 3 : ['CV', 'FIRMA'].includes(legalForm) ? 4 : 7;
    const yearsUsed = umkmStartYear > 0 ? currentYear - umkmStartYear : 0;

    if (yearsUsed < maxYears) {
      regime = 'UMKM_FINAL';
      reason = `PP 55/2022 적용: 연매출 Rp ${Math.round(revenue).toLocaleString('id-ID')} (< Rp 4.800.000.000), ${legalForm || '법인'} ${maxYears}년 한도 중 ${yearsUsed}년차`;
    } else {
      regime = 'GENERAL_25';
      reason = `UMKM PPh Final 기간 만료: ${legalForm} ${maxYears}년 한도 초과 (${umkmStartYear}~${currentYear}). 일반 PPh Badan 22% 적용`;
    }
  } else if (revenue >= 4_800_000_000) {
    regime = 'GENERAL_25';
    reason = `연매출 Rp ${Math.round(revenue).toLocaleString('id-ID')} — Rp 4.800.000.000 이상이므로 일반 PPh Badan 22% 적용`;
  } else if (!isUmkm && revenue > 0 && revenue < 4_800_000_000) {
    followUpQuestions.push({ question: '연매출이 48억 IDR 미만입니다. PP 55/2022 (UMKM PPh Final 0.5%)에 등록되어 있나요?' });
    regime = 'GENERAL_25';
    reason = 'UMKM 미등록 — 일반 PPh Badan 22% 적용 (PP 55 등록 시 0.5% 가능)';
  }

  if (revenue === 0) {
    followUpQuestions.push({ question: '최근 1년간 총 매출액은 얼마입니까? (PPh Final vs PPh Badan 결정에 필수)' });
  }

  // ── Step 2: 세목별 적용 판단 ──

  // PPh 21 — 직원
  if (profile.has_employees) {
    applicableTaxes.push('PPh 21 (근로소득세)');
  } else {
    followUpQuestions.push({ question: '직원(정규직/계약직/일용직 포함)을 1명이라도 고용하고 있나요?' });
  }

  // PPN — PKP
  if (profile.is_pkp) {
    applicableTaxes.push('PPN 11% (부가가치세)');
  } else if (revenue >= 4_800_000_000) {
    followUpQuestions.push({ question: '연매출 48억 이상이면 PKP 등록이 의무입니다. PKP 등록 상태를 확인해주세요.' });
  }

  // PPh 23 — 서비스 비용
  if (profile.pays_service_fees) {
    applicableTaxes.push('PPh 23 (서비스 원천징수 2%)');
  }

  // PPh 4(2) — 임대
  if (profile.has_rental_business) {
    applicableTaxes.push('PPh 4(2) Final 10% (임대소득)');
  }
  if (profile.pays_rent) {
    applicableTaxes.push('PPh 4(2) 원천징수 10% (임차료)');
  }

  // PPh 22 — 수입
  if (profile.has_import_export) {
    applicableTaxes.push('PPh 22 (수입) + PPN Import');
  }

  // PPh 4(2) — 건설
  if (profile.has_construction_sbu || category === 'CONSTRUCTION') {
    const sbuGrade = profile.sbu_qualification as string || '';
    const rate = sbuGrade === 'SMALL' ? '1.75%' : sbuGrade === 'MEDIUM' ? '2.65%' : sbuGrade === 'LARGE' ? '4%' : '?%';
    applicableTaxes.push(`PPh 4(2) Final ${rate} (건설업)`);
    if (!sbuGrade) {
      followUpQuestions.push({ question: '건설업 SBU(Sertifikat Badan Usaha) 등급이 무엇인가요? (Kecil/Menengah/Besar)' });
    }
  }

  // PPh 4(2) — 부동산
  if (profile.sells_property) {
    applicableTaxes.push('PPh 4(2) Final 2.5% (부동산 양도)');
  }

  // PPh 23 — 배당/이자/로열티
  if (profile.receives_dividends) applicableTaxes.push('PPh 23 15% (배당소득)');
  if (profile.receives_interest) applicableTaxes.push('PPh 23/4(2) (이자소득)');
  if (profile.receives_royalties || profile.has_franchise) applicableTaxes.push('PPh 23 15% (로열티)');

  // PPh 26 — 외국인
  if (profile.has_foreign_shareholders) {
    applicableTaxes.push('PPh 26 (외국인 배당/이자/로열티)');
    if (!profile.parent_company_country) {
      followUpQuestions.push({ question: '외국인 주주의 거주 국가는 어디인가요? (DTA 조세조약 세율 결정)' });
    }
  }

  // PPh 15 — 해운
  if (profile.has_shipping_business) {
    applicableTaxes.push('PPh 15 (해운/항공 1.2~2.64%)');
  }

  // F&B specific
  if (profile.is_restaurant) {
    applicableTaxes.push('Pajak Restoran (지역세, PPN 면제)');
  }
  if (profile.is_catering) {
    applicableTaxes.push('PPh 23 2% (케이터링 서비스)');
  }

  // ── Step 3: 프로필 부족 시 추가 질문 ──
  if (!category) {
    followUpQuestions.push({ question: '주요 사업 유형은 무엇인가요? (서비스/무역/제조/건설/부동산/식당 등)' });
  }
  if (!legalForm) {
    followUpQuestions.push({ question: '법인 형태가 무엇인가요? (PT/CV/UD/Firma 등 — UMKM 기간 한도 결정에 필요)' });
  }
  if (!estYear && isUmkm) {
    followUpQuestions.push({ question: '법인 설립 연도는? (UMKM PPh Final 기간 한도 확인)' });
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
