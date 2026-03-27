import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/messages?conversationWith=userId - Get messages
 * POST /api/messages - Send a message
 *
 * Customer ↔ Consultant real-time messaging
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const conversationWith = url.searchParams.get('conversationWith');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let query = getSupabaseAdmin()
      .from('consultation_message')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (conversationWith) {
      query = query.or(`sender_user_id.eq.${user.id},sender_user_id.eq.${conversationWith}`)
        .or(`recipient_user_id.eq.${user.id},recipient_user_id.eq.${conversationWith}`);
    } else {
      query = query.or(`sender_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`);
    }

    const { data: messages, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: { messages: messages || [] } });
  } catch {
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { recipientUserId, message, attachmentUrl } = body;

    if (!recipientUserId || !message) {
      return NextResponse.json({ error: 'recipientUserId and message required' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('consultation_message')
      .insert({
        sender_user_id: user.id,
        recipient_user_id: recipientUserId,
        message_text: message,
        attachment_url: attachmentUrl || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
