/**
 * Auto-Approval Engine
 *
 * Combines 5 scoring systems to determine if a queue item can be
 * automatically approved without supervisor review.
 *
 * Scores:
 * ① OCR Confidence (0-1.0) — document quality
 * ② Risk Score (0-100, lower=better) — anomaly detection
 * ③ Compliance Score (0-100) — customer filing history
 * ④ Validation Score (0-100) — tax data correctness
 * ⑤ Customer Trust Score (0-100) — historical trustworthiness
 *
 * All thresholds must be met for auto-approval.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { detectAnomalies, type AnomalyDetectionInput } from './anomaly-detector';
import { calculateCustomerTrustScore } from './customer-trust-score';

export interface AutoApprovalInput {
  queueItemId: string;
  customerId: string;
  taxType: string;
  taxYear: number;
  taxPeriodMonth: number;
  amount: number;
}

export interface AutoApprovalScores {
  ocrConfidence: number;
  riskScore: number;
  complianceScore: number;
  validationScore: number;
  trustScore: number;
}

export interface AutoApprovalResult {
  approved: boolean;
  combinedScore: number;
  scores: AutoApprovalScores;
  thresholds: {
    minOcrConfidence: number;
    maxRiskScore: number;
    minComplianceScore: number;
    minValidationScore: number;
    minTrustScore: number;
    maxAmount: number;
  };
  checks: Array<{ name: string; passed: boolean; actual: number; required: number }>;
  reasons: string[];
  reviewSummary: Record<string, unknown>;
}

interface ApprovalRule {
  min_ocr_confidence: number;
  max_risk_score: number;
  min_compliance_score: number;
  min_validation_score: number;
  min_trust_score: number;
  max_auto_approve_amount: number;
}

const DEFAULT_RULE: ApprovalRule = {
  min_ocr_confidence: 0.85,
  max_risk_score: 30,
  min_compliance_score: 75,
  min_validation_score: 85,
  min_trust_score: 70,
  max_auto_approve_amount: 10000000,
};

/**
 * Run auto-approval evaluation for a queue item.
 */
export async function evaluateAutoApproval(
  admin: SupabaseClient,
  input: AutoApprovalInput
): Promise<AutoApprovalResult> {
  // 1. Load active approval rule
  const { data: ruleData } = await admin
    .from('approval_rules')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const rule: ApprovalRule = ruleData || DEFAULT_RULE;

  // 2. Collect scores in parallel
  const [ocrConfidence, riskResult, complianceScore, validationScore, trustResult] = await Promise.all([
    getOcrConfidence(admin, input.customerId),
    getRiskScore(admin, input),
    getComplianceScore(admin, input.customerId),
    getValidationScore(admin, input.queueItemId),
    calculateCustomerTrustScore(admin, input.customerId),
  ]);

  const scores: AutoApprovalScores = {
    ocrConfidence,
    riskScore: riskResult.riskScore,
    complianceScore,
    validationScore,
    trustScore: trustResult.score,
  };

  // 3. Run threshold checks
  const checks = [
    {
      name: 'OCR Confidence',
      passed: scores.ocrConfidence >= rule.min_ocr_confidence,
      actual: scores.ocrConfidence,
      required: rule.min_ocr_confidence,
    },
    {
      name: 'Risk Score',
      passed: scores.riskScore <= rule.max_risk_score,
      actual: scores.riskScore,
      required: rule.max_risk_score,
    },
    {
      name: 'Compliance Score',
      passed: scores.complianceScore >= rule.min_compliance_score,
      actual: scores.complianceScore,
      required: rule.min_compliance_score,
    },
    {
      name: 'Validation Score',
      passed: scores.validationScore >= rule.min_validation_score,
      actual: scores.validationScore,
      required: rule.min_validation_score,
    },
    {
      name: 'Trust Score',
      passed: scores.trustScore >= rule.min_trust_score,
      actual: scores.trustScore,
      required: rule.min_trust_score,
    },
    {
      name: 'Amount Limit',
      passed: input.amount <= rule.max_auto_approve_amount,
      actual: input.amount,
      required: rule.max_auto_approve_amount,
    },
  ];

  const approved = checks.every(c => c.passed);

  // 4. Build reasons
  const reasons: string[] = [];
  for (const check of checks) {
    if (check.passed) {
      reasons.push(`✅ ${check.name}: ${check.actual} (threshold: ${check.required})`);
    } else {
      reasons.push(`❌ ${check.name}: ${check.actual} (required: ${check.required})`);
    }
  }

  // 5. Combined score (weighted average, risk inverted)
  const combinedScore = Math.round(
    (scores.ocrConfidence * 100) * 0.15 +
    (100 - scores.riskScore) * 0.25 +
    scores.complianceScore * 0.20 +
    scores.validationScore * 0.25 +
    scores.trustScore * 0.15
  );

  // 6. Build review summary
  const reviewSummary = {
    autoApproval: {
      evaluated: true,
      approved,
      combinedScore,
      evaluatedAt: new Date().toISOString(),
    },
    scores,
    checks: checks.map(c => ({ name: c.name, passed: c.passed, actual: c.actual, required: c.required })),
    trustDetails: trustResult.details,
    riskDetails: {
      overallRisk: riskResult.overallRisk,
      alertCount: riskResult.alerts?.length || 0,
      auditProbability: riskResult.auditProbability,
    },
  };

  return {
    approved,
    combinedScore,
    scores,
    thresholds: {
      minOcrConfidence: rule.min_ocr_confidence,
      maxRiskScore: rule.max_risk_score,
      minComplianceScore: rule.min_compliance_score,
      minValidationScore: rule.min_validation_score,
      minTrustScore: rule.min_trust_score,
      maxAmount: rule.max_auto_approve_amount,
    },
    checks,
    reasons,
    reviewSummary,
  };
}

// --- Score collection helpers ---

async function getOcrConfidence(admin: SupabaseClient, customerId: string): Promise<number> {
  // Get average OCR confidence from customer's recent documents
  const { data: docs } = await admin
    .from('document')
    .select('ocr_confidence')
    .eq('customer_id', customerId)
    .not('ocr_confidence', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!docs || docs.length === 0) return 0.5; // No OCR data = neutral

  const avg = docs.reduce((sum, d) => sum + (d.ocr_confidence || 0), 0) / docs.length;
  return Math.round(avg * 100) / 100;
}

async function getRiskScore(admin: SupabaseClient, input: AutoApprovalInput) {
  // Get customer data for anomaly detection
  const { data: customer } = await admin
    .from('customer')
    .select('customer_name, npwp')
    .eq('id', input.customerId)
    .single();

  // Get filing data if available
  const { data: filing } = await admin
    .from('tax_filing')
    .select('tax_data')
    .eq('customer_id', input.customerId)
    .eq('tax_year', input.taxYear)
    .maybeSingle();

  const taxData = filing?.tax_data || {};

  try {
    const anomalyInput: AnomalyDetectionInput = {
      customerId: input.customerId,
      customerName: customer?.customer_name || 'Unknown',
      taxYear: input.taxYear,
      currentData: {
        grossIncome: taxData.grossIncome || input.amount,
        netIncome: taxData.netIncome || input.amount,
        deductions: taxData.deductions || 0,
        taxDue: taxData.taxDue || input.amount,
        taxWithheld: taxData.taxWithheld || 0,
        effectiveRate: taxData.effectiveRate || 0,
        employerCount: taxData.employerCount || 1,
        ptkpStatus: taxData.ptkpStatus || 'TK/0',
      },
    };

    const result = await detectAnomalies(anomalyInput);
    return {
      riskScore: result.riskScore,
      overallRisk: result.overallRisk,
      alerts: result.alerts,
      auditProbability: result.auditProbability,
    };
  } catch {
    // If anomaly detection fails, return moderate risk
    return { riskScore: 50, overallRisk: 'MEDIUM' as const, alerts: [], auditProbability: 'Unknown' };
  }
}

async function getComplianceScore(admin: SupabaseClient, customerId: string): Promise<number> {
  // Simplified compliance score calculation (mirrors /api/tax/compliance-score)
  const { data: filings } = await admin
    .from('tax_filing')
    .select('tax_year, status, filed_at')
    .eq('customer_id', customerId)
    .order('tax_year', { ascending: false })
    .limit(5);

  // Timeliness (30)
  let timeliness = 30;
  if (filings && filings.length > 0) {
    const lateCount = filings.filter(f => {
      if (!f.filed_at) return true;
      const deadline = new Date(f.tax_year + 1, 2, 31);
      return new Date(f.filed_at) > deadline;
    }).length;
    timeliness = Math.max(0, 30 - (lateCount * 10));
  } else {
    timeliness = 0;
  }

  // Documents (20)
  const { count: docCount } = await admin
    .from('document')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);
  const documents = Math.min(20, (docCount || 0) * 5);

  // Profile (15)
  const { data: customer } = await admin
    .from('customer')
    .select('full_name, npwp, nik, address, phone, email')
    .eq('id', customerId)
    .maybeSingle();

  let profile = 0;
  if (customer) {
    if (customer.full_name) profile += 3;
    if (customer.npwp) profile += 4;
    if (customer.nik) profile += 3;
    if (customer.address) profile += 2;
    if (customer.phone) profile += 1.5;
    if (customer.email) profile += 1.5;
  }

  // Payments (20) + Consistency (15) simplified
  const payments = 15; // Default neutral
  const consistency = 15;

  return Math.round(Math.min(100, timeliness + documents + profile + payments + consistency));
}

async function getValidationScore(admin: SupabaseClient, queueItemId: string): Promise<number> {
  // Check if there's a tax_filing linked to this queue item with validation data
  // For now, if no validation data exists, return neutral score
  const { data: item } = await admin
    .from('djp_submission_queue')
    .select('customer_id, tax_type, tax_period_year')
    .eq('id', queueItemId)
    .single();

  if (!item) return 50;

  // Check for recent filing with validation
  const { data: filing } = await admin
    .from('tax_filing')
    .select('tax_data')
    .eq('customer_id', item.customer_id)
    .eq('tax_year', item.tax_period_year)
    .maybeSingle();

  if (!filing?.tax_data) return 70; // No filing data = moderate score

  // Basic validation: check if key fields are present
  const td = filing.tax_data;
  let score = 100;
  if (!td.grossIncome && td.grossIncome !== 0) score -= 20;
  if (!td.taxDue && td.taxDue !== 0) score -= 20;
  if (!td.npwp) score -= 10;

  return Math.max(0, score);
}
