import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/entities - List all entities (PT/CV) managed by user
 * POST /api/entities - Add a new entity
 *
 * Multi-entity management for corporate users managing multiple companies.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all customer records for this user (each represents an entity)
    const { data: entities } = await getSupabaseAdmin()
      .from('customer')
      .select('id, full_name, company_name, npwp, customer_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    // Get filing counts per entity
    const entitiesWithStats = await Promise.all(
      (entities || []).map(async (entity) => {
        const { count: filingCount } = await getSupabaseAdmin()
          .from('tax_filing')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', entity.id);

        return {
          ...entity,
          filingCount: filingCount || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        entities: entitiesWithStats,
        totalEntities: entitiesWithStats.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list entities' }, { status: 500 });
  }
}
