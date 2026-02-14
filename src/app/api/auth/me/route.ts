import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/auth/me
 * Get current authenticated user's profile information
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

    // Get user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Try to get customer info if role is CUSTOMER
    let customerInfo = null;
    if (userRole?.role === 'CUSTOMER') {
      const { data: customer } = await supabase
        .from('customer')
        .select('id, full_name, company_name, npwp, nik, phone, address, customer_type')
        .eq('user_id', user.id)
        .single();

      customerInfo = customer;
    }

    // Try to get consultant info if role is CONSULTANT_JTC or TAX_ADVISOR_JTC
    let consultantInfo = null;
    if (userRole?.role === 'CONSULTANT_JTC' || userRole?.role === 'TAX_ADVISOR_JTC') {
      const { data: consultant } = await supabase
        .from('consultant')
        .select('id, full_name, email, phone, license_number, is_active')
        .eq('user_id', user.id)
        .single();

      consultantInfo = consultant;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: userRole?.role || 'UNKNOWN',
        fullName: customerInfo?.full_name || consultantInfo?.full_name || user.user_metadata?.full_name || '',
        companyName: customerInfo?.company_name || null,
        npwp: customerInfo?.npwp || '',
        nik: customerInfo?.nik || '',
        phone: customerInfo?.phone || consultantInfo?.phone || '',
        address: customerInfo?.address || '',
        customerType: customerInfo?.customer_type || null,
        customerId: customerInfo?.id || null,
        consultantId: consultantInfo?.id || null,
        licenseNumber: consultantInfo?.license_number || null,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get user profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/me
 * Update current user's profile information
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

    const body = await request.json();
    const { fullName, phone, address, nik } = body;

    // Get user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Update based on role
    if (userRole?.role === 'CUSTOMER') {
      // Build update object, only include fields that are provided
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (fullName !== undefined) updateData.full_name = fullName;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (nik !== undefined) updateData.nik = nik;

      const { error: updateError } = await supabase
        .from('customer')
        .update(updateData)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Customer update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    } else if (userRole?.role === 'CONSULTANT_JTC' || userRole?.role === 'TAX_ADVISOR_JTC') {
      const { error: updateError } = await supabase
        .from('consultant')
        .update({
          full_name: fullName,
          phone,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Consultant update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    }

    // Also update auth metadata
    await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
