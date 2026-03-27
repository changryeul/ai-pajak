import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { DEFAULT_BRANDING, type BrandingConfig } from '@/lib/branding/types';

/**
 * GET /api/settings/branding - Get branding config
 * PUT /api/settings/branding - Update branding config
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: consultant } = await getSupabaseAdmin()
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', user.id)
      .single();

    if (!consultant) {
      return NextResponse.json({ success: true, data: { ...DEFAULT_BRANDING, isActive: false } });
    }

    // Check for saved branding in tax_partner metadata or a dedicated store
    const { data: partner } = await getSupabaseAdmin()
      .from('tax_partner')
      .select('id, company_name, metadata')
      .eq('id', consultant.tax_partner_id)
      .single();

    const metadata = partner?.metadata as { branding?: Partial<BrandingConfig> } | null;
    const branding = {
      ...DEFAULT_BRANDING,
      companyName: partner?.company_name || DEFAULT_BRANDING.companyName,
      ...metadata?.branding,
      consultantId: consultant.id,
    };

    return NextResponse.json({ success: true, data: branding });
  } catch {
    return NextResponse.json({ error: 'Failed to get branding' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: consultant } = await getSupabaseAdmin()
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', user.id)
      .single();

    if (!consultant) {
      return NextResponse.json({ error: 'Only consultants can update branding' }, { status: 403 });
    }

    const body = await request.json();
    const { primaryColor, secondaryColor, accentColor, tagline, contactEmail, contactPhone, website, footerText, isActive } = body;

    // Get current metadata
    const { data: partner } = await getSupabaseAdmin()
      .from('tax_partner')
      .select('metadata')
      .eq('id', consultant.tax_partner_id)
      .single();

    const currentMetadata = (partner?.metadata || {}) as Record<string, unknown>;

    // Update branding in metadata
    const { error } = await getSupabaseAdmin()
      .from('tax_partner')
      .update({
        metadata: {
          ...currentMetadata,
          branding: {
            primaryColor,
            secondaryColor,
            accentColor,
            tagline,
            contactEmail,
            contactPhone,
            website,
            footerText,
            isActive,
            updatedAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', consultant.tax_partner_id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Branding updated' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 });
  }
}
