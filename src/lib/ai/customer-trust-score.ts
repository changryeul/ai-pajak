/**
 * Customer Trust Score
 *
 * Calculates a trust score (0-100) based on customer filing history.
 * Higher score = more trustworthy = better candidate for auto-approval.
 *
 * Scoring:
 * - Base: 50 (new customers start here)
 * - Past successful filings: +10 per filing (max 40)
 * - On-time filing rate: max 30 points
 * - Complaints: -10 per complaint
 * - Rejections: -5 per rejection
 * - Final: clamped to 0-100
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface CustomerTrustResult {
  score: number;
  factors: {
    baseLine: number;
    successfulFilings: number;
    onTimeBonus: number;
    complaintPenalty: number;
    rejectionPenalty: number;
  };
  details: {
    totalFilings: number;
    successfulCount: number;
    onTimeCount: number;
    complaintCount: number;
    rejectionCount: number;
    isNewCustomer: boolean;
  };
}

export async function calculateCustomerTrustScore(
  admin: SupabaseClient,
  customerId: string
): Promise<CustomerTrustResult> {
  // 1. Get filing history from tax_filing
  const { data: filings } = await admin
    .from('tax_filing')
    .select('id, status, filed_at, created_at, due_date')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(10);

  // 2. Get queue history (completed/failed)
  const { data: queueItems } = await admin
    .from('djp_submission_queue')
    .select('id, status, created_at, completed_at')
    .eq('customer_id', customerId)
    .in('status', ['COMPLETED', 'FAILED']);

  // 3. Get complaint count
  const { count: complaintCount } = await admin
    .from('customer_complaints')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  // 4. Count rejections from queue history
  const { count: rejectionCount } = await admin
    .from('djp_submission_queue')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .not('rejected_reason', 'is', null);

  // Calculate scores
  const allFilings = [...(filings || []), ...(queueItems || [])];
  const isNewCustomer = allFilings.length === 0;

  // Successful filings
  const successfulFromFiling = (filings || []).filter(f =>
    f.status === 'ACCEPTED' || f.status === 'SUBMITTED'
  ).length;
  const successfulFromQueue = (queueItems || []).filter(q =>
    q.status === 'COMPLETED'
  ).length;
  const successfulCount = successfulFromFiling + successfulFromQueue;
  const successfulFilingsScore = Math.min(40, successfulCount * 10);

  // On-time rate
  const filingsWithDeadline = (filings || []).filter(f => f.filed_at && f.due_date);
  const onTimeCount = filingsWithDeadline.filter(f =>
    new Date(f.filed_at) <= new Date(f.due_date)
  ).length;
  const onTimeRate = filingsWithDeadline.length > 0
    ? onTimeCount / filingsWithDeadline.length
    : (isNewCustomer ? 0.5 : 0); // new customers get neutral
  const onTimeBonus = Math.round(onTimeRate * 30);

  // Penalties
  const complaintPenalty = Math.min(30, (complaintCount || 0) * 10);
  const rejectionPenalty = Math.min(20, (rejectionCount || 0) * 5);

  // Base + bonuses - penalties
  const baseLine = 50;
  const rawScore = baseLine + successfulFilingsScore + onTimeBonus - complaintPenalty - rejectionPenalty;
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score,
    factors: {
      baseLine,
      successfulFilings: successfulFilingsScore,
      onTimeBonus,
      complaintPenalty: -complaintPenalty,
      rejectionPenalty: -rejectionPenalty,
    },
    details: {
      totalFilings: allFilings.length,
      successfulCount,
      onTimeCount,
      complaintCount: complaintCount || 0,
      rejectionCount: rejectionCount || 0,
      isNewCustomer,
    },
  };
}
