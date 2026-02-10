import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getUserNotifications,
  getUnreadCount,
  markAllAsRead,
} from '@/lib/notifications';

/**
 * GET /api/notifications
 *
 * Get user notifications
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const countOnly = searchParams.get('countOnly') === 'true';

  if (countOnly) {
    const count = await getUnreadCount(session.user.id);
    return NextResponse.json({
      success: true,
      data: { unreadCount: count },
    });
  }

  const notifications = await getUserNotifications(session.user.id, {
    unreadOnly,
    limit,
    offset,
  });

  const unreadCount = await getUnreadCount(session.user.id);

  return NextResponse.json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: {
      limit,
      offset,
      hasMore: notifications.length === limit,
    },
  });
}

/**
 * PATCH /api/notifications
 *
 * Mark all notifications as read
 */
export async function PATCH() {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const success = await markAllAsRead(session.user.id);

  if (!success) {
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'All notifications marked as read',
  });
}
