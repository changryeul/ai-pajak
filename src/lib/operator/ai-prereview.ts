import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';

const MODEL = 'claude-sonnet-4-6';

export interface PreReviewRow {
  flags: { level: 'red' | 'amber' | 'green'; label: string };
  [k: string]: unknown;
}
export interface PreReviewInput {
  taxView: string;
  period: string;
  summary: Record<string, number>;
  rows: PreReviewRow[];
}
export interface PreReviewResult {
  riskLevel: 'low' | 'medium' | 'high';
  headline: string;
  findings: string[];
  recommendation: string;
  mode: 'ai' | 'rule';
}

const RECOMMENDATION: Record<PreReviewResult['riskLevel'], string> = {
  low: '이상 항목이 없습니다. 요약을 확인한 뒤 승인 요청하세요.',
  medium: '확인이 필요한 항목이 있습니다. 해당 행을 검토하고 필요 시 고객에게 요청하세요.',
  high: '확인 필요 항목이 과반입니다. 고객에게 자료 보완을 일괄 요청한 뒤 재검토하세요.',
};

/** flags 집계 기반 결정론적 사전검토 (Claude 미가용 시 fallback). 순수. */
export function ruleBasedPreReview(input: PreReviewInput): PreReviewResult {
  const rows = input.rows ?? [];
  const total = rows.length;
  const redRows = rows.filter(r => r.flags?.level === 'red');
  const red = redRows.length;

  const riskLevel: PreReviewResult['riskLevel'] =
    red === 0 ? 'low' : red / Math.max(total, 1) > 0.5 ? 'high' : 'medium';

  // red flag.label 별 카운트 → 내림차순 상위 5
  const byLabel = new Map<string, number>();
  for (const r of redRows) {
    const label = r.flags?.label ?? '확인 필요';
    byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
  }
  const findings = [...byLabel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, n]) => `${label}: ${n}건`);

  const headline = total === 0
    ? '검토할 항목이 없습니다.'
    : `${total}건 중 ${red}건 확인 필요`;

  return { riskLevel, headline, findings, recommendation: RECOMMENDATION[riskLevel], mode: 'rule' };
}

const RISK_SET = new Set(['low', 'medium', 'high']);

/**
 * 상세 rows(flags 포함)를 Claude 로 요약해 사전검토를 생성.
 * ANTHROPIC_API_KEY 없거나 오류/파싱 실패 시 ruleBasedPreReview 로 graceful degrade.
 * never-throw.
 */
export async function generateQueuePreReview(input: PreReviewInput): Promise<PreReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return ruleBasedPreReview(input);

  try {
    const rows = (input.rows ?? []).slice(0, 200);
    // flags.label 분포 요약 (토큰 절약) + 상위 몇 행 원본
    const labelCounts = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.flags?.level ?? '?'}:${r.flags?.label ?? ''}`;
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
    }
    const distribution = [...labelCounts.entries()].map(([k, n]) => `${k} × ${n}`).join('\n');
    const sample = JSON.stringify(rows.slice(0, 15));

    const prompt = `당신은 인도네시아 세무 신고를 검토하는 시니어 상담원입니다. 아래는 한 고객의 "${input.taxView}" 세목 ${input.period} 귀속분 검토 데이터입니다.

요약 지표: ${JSON.stringify(input.summary)}
이슈 플래그 분포:
${distribution}

상위 표본 행(JSON):
${sample}

이 데이터를 근거로 상담원이 먼저 봐야 할 사전검토를 작성하세요. 반드시 아래 JSON 스키마로만 응답하세요(설명 문장 없이):
{"riskLevel":"low|medium|high","headline":"한 문장 요약(한국어)","findings":["핵심 이슈 3~5개(한국어, 각 20자 내외)"],"recommendation":"상담원 다음 조치 한 문장(한국어)"}`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) return ruleBasedPreReview(input);
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    const riskLevel = RISK_SET.has(parsed.riskLevel) ? parsed.riskLevel : ruleBasedPreReview(input).riskLevel;
    const findings = Array.isArray(parsed.findings) ? parsed.findings.filter((f: unknown) => typeof f === 'string').slice(0, 5) : [];
    const headline = typeof parsed.headline === 'string' && parsed.headline ? parsed.headline : ruleBasedPreReview(input).headline;
    const recommendation = typeof parsed.recommendation === 'string' && parsed.recommendation
      ? parsed.recommendation : RECOMMENDATION[riskLevel as PreReviewResult['riskLevel']];

    return { riskLevel, headline, findings, recommendation, mode: 'ai' };
  } catch (e) {
    loggers.api.warn({ err: e instanceof Error ? e.message : 'unknown', taxView: input.taxView }, 'generateQueuePreReview failed — rule fallback');
    return ruleBasedPreReview(input);
  }
}
