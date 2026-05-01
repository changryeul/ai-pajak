import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RequestWithSession } from '@/types/auth';

async function handleDelete(
  req: RequestWithSession,
  sessionId: string,
  docId: string
): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  const { data: doc } = await sb
    .from('closing_document')
    .select('id, session_id, storage_path')
    .eq('id', docId)
    .single();
  if (!doc || doc.session_id !== sessionId) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  // Verify owner via session
  const { data: session } = await sb
    .from('tax_closing_session')
    .select('id, customer_id')
    .eq('id', sessionId)
    .single();
  if (!session || session.customer_id !== customerId) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await sb.storage.from('closing-documents').remove([doc.storage_path]);
  await sb.from('closing_document').delete().eq('id', docId);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_DOCUMENT_DELETE'))(
    request as RequestWithSession,
    (r) => handleDelete(r, id, docId)
  );
}
