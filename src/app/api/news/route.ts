import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';

/**
 * GET /api/news — List tax news articles
 * Query: category, importance, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const importance = url.searchParams.get('importance');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('tax_news')
      .select('id, source, source_url, original_title, summary_id, summary_ko, summary_en, impact_analysis, category, tags, regulation_number, importance, published_at, created_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (importance) query = query.eq('importance', importance);

    const { data: articles, error, count } = await query;

    if (error) {
      loggers.api.error({ err: error }, 'News fetch failed');
      return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: articles || [],
      total: count || (articles || []).length,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'News API error');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
