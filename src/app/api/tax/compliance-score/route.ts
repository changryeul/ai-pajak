import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/tax/compliance-score?customerId=xxx
 *
 * Calculate tax compliance score (0-100) based on:
 * - Filing timeliness (30%)
 * - Document completeness (20%)
 * - Payment accuracy (20%)
 * - Profile completeness (15%)
 * - Consistency (15%)
 */
async function handleComplianceScore(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const { role, userId } = req.session;
  let customerId = url.searchParams.get('customerId');

  if (!customerId && role === 'CUSTOMER') {
    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('id')
      .eq('user_id', userId)
      .single();
    customerId = customer?.id || null;
  }

  if (!customerId) {
    return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  }

  try {
    // 1. Filing timeliness (30 points)
    const { data: filings } = await getSupabaseAdmin()
      .from('tax_filing')
      .select('tax_year, status, filed_at, created_at')
      .eq('customer_id', customerId)
      .order('tax_year', { ascending: false })
      .limit(5);

    let timelinessScore = 30;
    if (filings && filings.length > 0) {
      const lateCount = filings.filter(f => {
        if (!f.filed_at) return true;
        const deadline = new Date(f.tax_year + 1, 2, 31);
        return new Date(f.filed_at) > deadline;
      }).length;
      timelinessScore = Math.max(0, 30 - (lateCount * 10));
    } else {
      timelinessScore = 0; // No filings = bad
    }

    // 2. Document completeness (20 points)
    const { count: docCount } = await getSupabaseAdmin()
      .from('document')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    const docScore = Math.min(20, (docCount || 0) * 5);

    // 3. Payment accuracy (20 points)
    const { data: payments } = await getSupabaseAdmin()
      .from('billing_transaction')
      .select('status')
      .eq('customer_id', customerId);

    const paidCount = payments?.filter(p => p.status === 'PAID').length || 0;
    const totalPayments = payments?.length || 0;
    const paymentScore = totalPayments > 0 ? Math.round((paidCount / totalPayments) * 20) : 15;

    // 4. Profile completeness (15 points)
    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('full_name, npwp, nik, address, phone, email')
      .eq('id', customerId)
      .single();

    let profileScore = 0;
    if (customer) {
      if (customer.full_name) profileScore += 3;
      if (customer.npwp) profileScore += 4;
      if (customer.nik) profileScore += 3;
      if (customer.address) profileScore += 2;
      if (customer.phone) profileScore += 1.5;
      if (customer.email) profileScore += 1.5;
    }
    profileScore = Math.min(15, profileScore);

    // 5. Consistency (15 points)
    let consistencyScore = 15;
    if (filings && filings.length >= 2) {
      const statuses = filings.map(f => f.status);
      const uniqueStatuses = new Set(statuses);
      if (uniqueStatuses.size > 2) consistencyScore -= 5;
    }

    const totalScore = Math.round(timelinessScore + docScore + paymentScore + profileScore + consistencyScore);
    const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 60 ? 'C' : totalScore >= 40 ? 'D' : 'F';

    const improvements: string[] = [];
    if (timelinessScore < 25) improvements.push('Laporkan SPT tepat waktu');
    if (docScore < 15) improvements.push('Upload lebih banyak dokumen pendukung');
    if (paymentScore < 15) improvements.push('Selesaikan pembayaran yang tertunda');
    if (profileScore < 12) improvements.push('Lengkapi profil (NPWP, NIK, alamat)');

    return NextResponse.json({
      success: true,
      data: {
        score: totalScore,
        grade,
        breakdown: {
          timeliness: { score: Math.round(timelinessScore), max: 30, label: 'Ketepatan Waktu' },
          documents: { score: Math.round(docScore), max: 20, label: 'Kelengkapan Dokumen' },
          payments: { score: Math.round(paymentScore), max: 20, label: 'Pembayaran' },
          profile: { score: Math.round(profileScore), max: 15, label: 'Profil' },
          consistency: { score: Math.round(consistencyScore), max: 15, label: 'Konsistensi' },
        },
        improvements,
        filingCount: filings?.length || 0,
        documentCount: docCount || 0,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to calculate compliance score' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleComplianceScore);
}
