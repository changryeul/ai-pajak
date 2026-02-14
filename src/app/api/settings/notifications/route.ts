import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface NotificationPreferences {
  email_enabled: boolean;
  in_app_enabled: boolean;
  deadline_reminders: boolean;
  filing_updates: boolean;
  payment_reminders: boolean;
  marketing_emails: boolean;
}

/**
 * GET /api/settings/notifications
 * Get user's notification preferences
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get notification preferences
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching notification preferences:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // Return default values if no preferences exist
    const defaultPreferences = {
      email_enabled: true,
      in_app_enabled: true,
      deadline_reminders: true,
      filing_updates: true,
      payment_reminders: true,
      marketing_emails: false,
    };

    return NextResponse.json({
      success: true,
      data: preferences || defaultPreferences,
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/notifications
 * Update user's notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<NotificationPreferences>;

    // Check if preferences exist
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const updateData = {
      email_enabled: body.email_enabled,
      in_app_enabled: body.in_app_enabled,
      deadline_reminders: body.deadline_reminders,
      filing_updates: body.filing_updates,
      payment_reminders: body.payment_reminders,
      marketing_emails: body.marketing_emails,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    let result;

    if (existing) {
      // Update existing preferences
      result = await supabase
        .from('notification_preferences')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();
    } else {
      // Insert new preferences
      result = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          ...updateData,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error updating notification preferences:', result.error);
      return NextResponse.json(
        { success: false, error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Notification preferences updated successfully',
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
