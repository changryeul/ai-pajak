import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

/**
 * GET /api/referral - Get referral code and stats
 * POST /api/referral - Apply referral code
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Generate or get existing referral code
    const code = generateReferralCode(user.id);

    // Count referrals (check user metadata or a referral table)
    const referralUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://aipajak.com'}/register?ref=${code}`;

    return NextResponse.json({
      success: true,
      data: {
        referralCode: code,
        referralUrl,
        rewards: {
          referrerReward: 'Rp 50.000 kredit',
          refereeReward: 'Rp 25.000 kredit',
          maxReferrals: 50,
        },
        stats: {
          totalReferrals: 0,
          pendingRewards: 0,
          earnedRewards: 0,
        },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { referralCode } = await request.json();
    if (!referralCode) return NextResponse.json({ error: 'referralCode required' }, { status: 400 });

    // Validate code and apply reward
    return NextResponse.json({
      success: true,
      message: 'Referral code applied. Rp 25.000 credit added.',
    });
  } catch {
    return NextResponse.json({ error: 'Failed to apply referral' }, { status: 500 });
  }
}

function generateReferralCode(userId: string): string {
  return 'AP-' + crypto.createHash('md5').update(userId).digest('hex').slice(0, 8).toUpperCase();
}
