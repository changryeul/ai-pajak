import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markAsRead, deleteNotification } from '@/lib/notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notifications/[id]
 *
 * Get a specific notification
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Fetch notification
  const { data, error } = await supabase
    .from('notification')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Notification not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      priority: data.priority,
      title: data.title,
      message: data.message,
      data: data.data,
      channels: data.channels,
      read: data.read,
      readAt: data.read_at,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    },
  });
}

/**
 * PATCH /api/notifications/[id]
 *
 * Update notification (mark as read)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  const { data: notification } = await supabase
    .from('notification')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!notification || notification.user_id !== session.user.id) {
    return NextResponse.json(
      { error: 'Notification not found' },
      { status: 404 }
    );
  }

  // Parse body
  const body = await request.json();

  if (body.read === true) {
    const success = await markAsRead(id);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to mark as read' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Notification updated',
  });
}

/**
 * DELETE /api/notifications/[id]
 *
 * Delete a notification
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  const { data: notification } = await supabase
    .from('notification')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!notification || notification.user_id !== session.user.id) {
    return NextResponse.json(
      { error: 'Notification not found' },
      { status: 404 }
    );
  }

  const success = await deleteNotification(id);
  if (!success) {
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Notification deleted',
  });
}
