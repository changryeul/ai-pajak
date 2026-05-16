/**
 * Cross-tenant counterparty lookup helpers.
 *
 * Given a parsed withholding-invoice row, finds the master counterparty
 * by NPWP (or NIB fallback), returns the trust score and the recommended
 * PPh type / rate so the rule engine + suggested fields can be filled in.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface CounterpartyMatch {
  matched: boolean;
  counterpartyId: string | null;
  name: string | null;
  npwp: string | null;
  country: string | null;
  kbli: string | null;
  pkpStatus: string | null;
  suggestedPph: string | null;
  suggestedRate: number | null;
  overallTrust: number;
  evidenceSources: Record<string, unknown> | null;
  reason: string;
}

const EMPTY: CounterpartyMatch = {
  matched: false,
  counterpartyId: null,
  name: null,
  npwp: null,
  country: null,
  kbli: null,
  pkpStatus: null,
  suggestedPph: null,
  suggestedRate: null,
  overallTrust: 0,
  evidenceSources: null,
  reason: 'no match',
};

export async function matchByNpwp(npwp: string | null | undefined): Promise<CounterpartyMatch> {
  if (!npwp) return { ...EMPTY, reason: 'npwp is empty' };
  const cleaned = String(npwp).replace(/\s+/g, '').trim();
  if (cleaned.length < 8) return { ...EMPTY, reason: 'npwp too short' };
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('counterparty_master')
    .select(
      'id, name, npwp, country, kbli, pkp_status, suggested_pph_type, suggested_tax_rate, overall_trust, evidence_sources',
    )
    .eq('npwp', cleaned)
    .maybeSingle();
  if (!data) return { ...EMPTY, reason: 'no row for given npwp' };
  return {
    matched: true,
    counterpartyId: data.id,
    name: data.name,
    npwp: data.npwp,
    country: data.country,
    kbli: data.kbli,
    pkpStatus: data.pkp_status,
    suggestedPph: data.suggested_pph_type,
    suggestedRate: data.suggested_tax_rate !== null ? Number(data.suggested_tax_rate) : null,
    overallTrust: data.overall_trust ?? 50,
    evidenceSources: data.evidence_sources ?? null,
    reason: 'matched via NPWP exact',
  };
}

export type CounterpartySearchHit = {
  id: string;
  npwp: string | null;
  name: string;
  country: string;
  kbli: string | null;
  suggested_pph_type: string | null;
  suggested_tax_rate: number | null;
  overall_trust: number;
};

export async function searchCounterparties(opts: {
  q?: string | null;
  country?: string | null;
  limit?: number;
}): Promise<CounterpartySearchHit[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('counterparty_master')
    .select(
      'id, npwp, name, country, kbli, suggested_pph_type, suggested_tax_rate, overall_trust',
    )
    .order('updated_at', { ascending: false })
    .limit(opts.limit ?? 30);
  if (opts.q) {
    const term = opts.q.trim();
    if (term.length > 0) {
      query = query.or(`name.ilike.%${term}%,npwp.ilike.%${term}%,nib.ilike.%${term}%`);
    }
  }
  if (opts.country) query = query.eq('country', opts.country);
  const { data } = await query;
  return (data ?? []) as CounterpartySearchHit[];
}
