import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/users?search=xxx&role=CUSTOMER&page=1&limit=20
 * PUT /api/admin/users - Update user (role, active status)
 * POST /api/admin/users - Actions: reset-password, deactivate, activate
 */

async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
  return data?.role === 'PLATFORM_ADMIN';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const roleFilter = url.searchParams.get('role') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Get auth users
    let authUsers: Array<{ id: string; email?: string; created_at: string; last_sign_in_at?: string; email_confirmed_at?: string; user_metadata?: Record<string, unknown> }> = [];
    try {
      const { data: authData } = await getSupabaseAdmin().auth.admin.listUsers({ page, perPage: limit });
      authUsers = authData?.users || [];
    } catch (err) {
      console.error('Failed to list auth users:', err);
      // Fall back to user_roles table
    }

    // Get roles
    const { data: roles } = await getSupabaseAdmin()
      .from('user_roles')
      .select('user_id, role, is_active');

    const roleMap = new Map((roles || []).map(r => [r.user_id, r]));

    // Get customer info
    const { data: customers } = await getSupabaseAdmin()
      .from('customer')
      .select('user_id, full_name, npwp, customer_type');

    const customerMap = new Map((customers || []).map(c => [c.user_id, c]));

    // Build user list
    let users;
    if (authUsers.length > 0) {
      users = authUsers.map(u => {
        const role = roleMap.get(u.id);
        const customer = customerMap.get(u.id);
        return {
          id: u.id,
          email: u.email || '',
          fullName: customer?.full_name || (u.user_metadata?.full_name as string) || '',
          npwp: customer?.npwp || '',
          role: role?.role || 'UNKNOWN',
          isActive: role?.is_active ?? true,
          customerType: customer?.customer_type || null,
          createdAt: u.created_at || '',
          lastSignIn: u.last_sign_in_at || null,
          emailConfirmed: !!u.email_confirmed_at,
        };
      });
    } else {
      // Fallback: build from user_roles
      users = (roles || []).map(r => {
        const customer = customerMap.get(r.user_id);
        return {
          id: r.user_id,
          email: customer?.full_name || r.user_id.slice(0, 8),
          fullName: customer?.full_name || '',
          npwp: customer?.npwp || '',
          role: r.role || 'UNKNOWN',
          isActive: r.is_active ?? true,
          customerType: customer?.customer_type || null,
          createdAt: '',
          lastSignIn: null,
          emailConfirmed: false,
        };
      });
    }

    // Apply filters
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u =>
        u.email.toLowerCase().includes(s) ||
        u.fullName.toLowerCase().includes(s) ||
        u.npwp.includes(s)
      );
    }
    if (roleFilter) {
      users = users.filter(u => u.role === roleFilter);
    }

    // Stats
    const stats = {
      total: users.length,
      byRole: {
        CUSTOMER: users.filter(u => u.role === 'CUSTOMER').length,
        CONSULTANT_JTC: users.filter(u => u.role === 'CONSULTANT_JTC').length,
        TAX_ADVISOR_JTC: users.filter(u => u.role === 'TAX_ADVISOR_JTC').length,
        PLATFORM_ADMIN: users.filter(u => u.role === 'PLATFORM_ADMIN').length,
      },
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
    };

    return NextResponse.json({ success: true, data: { users, stats, page, limit } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await request.json();
    const { userId, role, isActive } = body;

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { error } = await getSupabaseAdmin()
      .from('user_roles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'User updated' });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await request.json();
    const { action, userId } = body;

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    switch (action) {
      case 'reset-password': {
        // Generate password reset link
        const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
          type: 'recovery',
          email: body.email,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: 'Password reset link generated', link: data.properties?.action_link });
      }

      case 'deactivate': {
        await getSupabaseAdmin().from('user_roles').update({ is_active: false }).eq('user_id', userId);
        return NextResponse.json({ success: true, message: 'User deactivated' });
      }

      case 'activate': {
        await getSupabaseAdmin().from('user_roles').update({ is_active: true }).eq('user_id', userId);
        return NextResponse.json({ success: true, message: 'User activated' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
