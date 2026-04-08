import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * GET /api/tax/employees/mapping?customerId=xxx&fingerprint=yyy
 *   → Returns saved mapping if exists (auto-map without confirmation)
 *
 * POST /api/tax/employees/mapping
 *   body: { customerId, headers, mappings, sourceName? }
 *   → Saves confirmed mapping for future auto-use
 */
function hashHeaders(headers: string[]): string {
  // Simple hash: sort + lowercase + join → djb2 hash → hex
  const normalized = headers.map(h => h.toLowerCase().trim()).sort().join('|');
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const p = new URL(request.url).searchParams;
    const customerId = p.get('customerId');
    const fingerprint = p.get('fingerprint');
    const headers = p.get('headers'); // JSON array of headers for fingerprint generation

    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // If fingerprint provided, exact lookup
    let fp = fingerprint;
    if (!fp && headers) {
      try { fp = hashHeaders(JSON.parse(headers)); } catch { /* */ }
    }

    if (fp) {
      const { data } = await admin.from('column_mapping_memory')
        .select('*')
        .eq('customer_id', customerId)
        .eq('header_fingerprint', fp)
        .maybeSingle();

      if (data) {
        // Bump usage count
        await admin.from('column_mapping_memory')
          .update({ used_count: (data.used_count || 0) + 1, last_used_at: new Date().toISOString() })
          .eq('id', data.id);

        return NextResponse.json({ success: true, data, remembered: true });
      }
      return NextResponse.json({ success: true, data: null, remembered: false });
    }

    // List all mappings for customer
    const { data: all } = await admin.from('column_mapping_memory')
      .select('*')
      .eq('customer_id', customerId)
      .order('last_used_at', { ascending: false });

    return NextResponse.json({ success: true, data: all || [] });
  } catch (error) {
    loggers.api.error({ err: error }, 'Mapping memory GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { customerId, headers, mappings, sourceName } = body as {
      customerId: string;
      headers: string[];
      mappings: Array<{ sourceColumn: string; targetField: string }>;
      sourceName?: string;
    };

    if (!customerId || !headers?.length || !mappings?.length) {
      return NextResponse.json({ error: 'customerId, headers, mappings required' }, { status: 400 });
    }

    const fingerprint = hashHeaders(headers);
    const admin = getSupabaseAdmin();

    const { data, error } = await admin.from('column_mapping_memory').upsert({
      customer_id: customerId,
      header_fingerprint: fingerprint,
      source_name: sourceName || null,
      source_headers: headers,
      mappings: mappings.filter(m => m.targetField),
      used_count: 1,
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'customer_id,header_fingerprint' }).select().single();

    if (error) {
      loggers.api.error({ err: error }, 'Mapping save error');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    loggers.api.info({ customerId, fingerprint, mappingCount: mappings.length }, 'Column mapping saved');

    return NextResponse.json({
      success: true,
      data,
      message: '매핑이 저장되었습니다. 다음에 같은 형식의 Excel을 올리면 자동으로 매핑됩니다.',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Mapping save error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
