/**
 * 자동배정 스코어링 엔진 (v13 수퍼바이저 스펙 §5, 트랙 4).
 *
 * 신규 고객/케이스를 tax_operator 에게 배정할 때 7개 기준 중 스키마에
 * 데이터가 있는 것만 가중 스코어로 반영하고, 없는 기준은 unappliedCriteria
 * 에 명시한다(v13 no-silent-caps 원칙 — "언어 미적용"을 로그로 남김).
 *
 * 순수 함수라 테스트/재사용이 쉽다. DB 접근은 호출부에서.
 */

export interface OperatorCandidate {
  id: string;
  maxClients: number;
  status: string;                 // 'active' 만 배정 대상
  workState: string | null;       // 'available' | 'busy' | 'break' | 'offline'
  autoAssignEnabled: boolean;
  approvalQualityScore: number | null; // 0..100
  accuracyPct: number | null;          // 0..100
  specialties: string[];
}

export interface ScoreContext {
  currentLoad: number;            // 진행 중 배정 건수
  stickyOperatorId: string | null; // 고객의 기존 담당 operator
  taxType: string | null;         // 배정 대상의 세목 (있으면 전문성 매칭)
}

export interface ScoredCandidate {
  operatorId: string;
  eligible: boolean;
  ineligibleReason: string | null;
  score: number;
  breakdown: Record<string, number>;
}

// 기준별 최대 가중치 (합 100 기준선). 언어/위험도는 현재 스키마에 데이터가
// 없어 스코어에 넣지 않고 unappliedCriteria 로 보고한다.
const WEIGHTS = {
  sticky: 40,       // 기존 상담이력 (§5 기준 1)
  headroom: 20,     // 팀/개인 업무량 여유 (§5 기준 5)
  quality: 25,      // 승인통과율·정확도 품질지표 (§5 기준 7)
  specialty: 15,    // 세목 전문성 (§5 기준 3)
} as const;

export const UNAPPLIED_CRITERIA = [
  'language',   // customer 언어 데이터 없음 (§5 기준 2)
  'risk',       // customer 위험도 데이터 없음 (§5 기준 4)
] as const;

function eligibility(op: OperatorCandidate, load: number): string | null {
  if (op.status !== 'active') return 'not-active';
  if (!op.autoAssignEnabled) return 'auto-assign-disabled';
  if (op.workState === 'offline') return 'offline';
  if (load >= op.maxClients) return 'at-capacity';
  return null;
}

export function scoreCandidate(
  op: OperatorCandidate,
  loadOf: (id: string) => number,
  ctx: ScoreContext,
): ScoredCandidate {
  const load = loadOf(op.id);
  const reason = eligibility(op, load);
  if (reason) {
    return { operatorId: op.id, eligible: false, ineligibleReason: reason, score: 0, breakdown: {} };
  }

  const breakdown: Record<string, number> = {};

  // 1. 기존 상담이력 (sticky)
  breakdown.sticky = ctx.stickyOperatorId === op.id ? WEIGHTS.sticky : 0;

  // 2. 업무량 여유 — (max - load)/max
  const headroomRatio = op.maxClients > 0 ? (op.maxClients - load) / op.maxClients : 0;
  breakdown.headroom = Math.round(headroomRatio * WEIGHTS.headroom * 100) / 100;

  // 3. 품질 — 승인통과율 60% + 정확도 40% 혼합
  const q = (op.approvalQualityScore ?? 0) / 100;
  const a = (op.accuracyPct ?? 0) / 100;
  breakdown.quality = Math.round((q * 0.6 + a * 0.4) * WEIGHTS.quality * 100) / 100;

  // 4. 세목 전문성 — 대상 세목이 전문 목록에 있으면 가점 (세목 미지정이면 0)
  breakdown.specialty =
    ctx.taxType && op.specialties.includes(ctx.taxType) ? WEIGHTS.specialty : 0;

  const score = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { operatorId: op.id, eligible: true, ineligibleReason: null, score: Math.round(score * 100) / 100, breakdown };
}

export interface RankResult {
  best: ScoredCandidate | null;
  ranked: ScoredCandidate[];
  method: 'sticky' | 'scored' | 'overflow';
  unappliedCriteria: string[];
}

/**
 * 후보군을 스코어링해 최적 operator 를 고른다.
 * eligible 이 하나도 없으면 method='overflow' (미배정 큐 fallback).
 */
export function rankOperators(
  operators: OperatorCandidate[],
  loadOf: (id: string) => number,
  ctx: ScoreContext,
): RankResult {
  const scored = operators
    .map((op) => scoreCandidate(op, loadOf, ctx))
    .sort((x, y) => y.score - x.score);
  const eligible = scored.filter((s) => s.eligible);
  const best = eligible[0] ?? null;
  const method: RankResult['method'] = !best
    ? 'overflow'
    : best.breakdown.sticky > 0
      ? 'sticky'
      : 'scored';
  return { best, ranked: scored, method, unappliedCriteria: [...UNAPPLIED_CRITERIA] };
}
