import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQueuePreReview, type PreReviewRow } from '@/lib/operator/ai-prereview';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  await params; // queueId not needed server-side; the panel sends its already-loaded detail.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { taxView, period, summary, rows } = body as {
    taxView?: string; period?: string; summary?: Record<string, number>; rows?: PreReviewRow[];
  };
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
  }

  const result = await generateQueuePreReview({
    taxView: taxView ?? 'unknown',
    period: period ?? '',
    summary: summary ?? {},
    rows: rows.slice(0, 200),
  });

  return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
}
