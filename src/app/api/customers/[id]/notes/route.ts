import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession, UserRole } from '@/types/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customers/[id]/notes — List customer notes
 */
async function handleGetNotes(req: RequestWithSession, customerId: string): Promise<Response> {
  const admin = getSupabaseAdmin();

  const { data: notes, error } = await admin
    .from('customer_note')
    .select('id, content, is_pinned, author_user_id, author_role, created_at, updated_at')
    .eq('customer_id', customerId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    loggers.api.error({ err: error }, 'Failed to fetch customer notes');
    return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: notes || [] });
}

/**
 * POST /api/customers/[id]/notes — Create a note
 */
async function handleCreateNote(req: RequestWithSession, customerId: string): Promise<Response> {
  const body = await req.json();
  const { content } = body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: note, error } = await admin
    .from('customer_note')
    .insert({
      customer_id: customerId,
      author_user_id: req.session.userId,
      author_role: req.session.role,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    loggers.api.error({ err: error }, 'Failed to create customer note');
    return NextResponse.json({ success: false, error: 'Failed to create note' }, { status: 500 });
  }

  loggers.api.info({ noteId: note.id, customerId }, 'Customer note created');
  return NextResponse.json({ success: true, data: note }, { status: 201 });
}

/**
 * PATCH /api/customers/[id]/notes — Update a note (pin/unpin or edit content)
 */
async function handleUpdateNote(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { noteId, content, is_pinned } = body;

  if (!noteId) {
    return NextResponse.json({ success: false, error: 'noteId is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (content !== undefined) updateData.content = content.trim();
  if (is_pinned !== undefined) updateData.is_pinned = is_pinned;

  const { data: note, error } = await admin
    .from('customer_note')
    .update(updateData)
    .eq('id', noteId)
    .eq('author_user_id', req.session.userId)
    .select()
    .single();

  if (error) {
    loggers.api.error({ err: error }, 'Failed to update customer note');
    return NextResponse.json({ success: false, error: 'Failed to update note' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: note });
}

/**
 * DELETE /api/customers/[id]/notes — Delete a note
 */
async function handleDeleteNote(req: RequestWithSession): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get('noteId');

  if (!noteId) {
    return NextResponse.json({ success: false, error: 'noteId query parameter is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from('customer_note')
    .delete()
    .eq('id', noteId)
    .eq('author_user_id', req.session.userId);

  if (error) {
    loggers.api.error({ err: error }, 'Failed to delete customer note');
    return NextResponse.json({ success: false, error: 'Failed to delete note' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

const allowedRoles: UserRole[] = ['CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole, 'CUSTOMER' as UserRole];

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...allowedRoles)
  )(request as RequestWithSession, (req) => handleGetNotes(req, id));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole)
  )(request as RequestWithSession, (req) => handleCreateNote(req, id));
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole)
  )(request as RequestWithSession, handleUpdateNote);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  await params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole)
  )(request as RequestWithSession, handleDeleteNote);
}
