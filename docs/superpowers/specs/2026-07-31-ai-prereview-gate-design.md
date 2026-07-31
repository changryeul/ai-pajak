# AI 사전검토 게이트 설계

> 서브프로젝트 A(일부). 상담원이 고객 업무를 검토하기 전에, AI가 상세 데이터(이미 flags 포함)를 훑어 **위험도·핵심이슈·처리추천**을 요약해 준다. 온디맨드 버튼.

## 목표

각 세목 검토 패널(PPh21/원천세/PPN/선납법인세)에서 상담원이 "AI 검토 실행" 버튼을 누르면, 해당 큐 건의 상세 rows(플래그 포함)를 AI가 요약해 **위험도 badge + 헤드라인 + 핵심 findings + 처리 추천**을 박스로 보여준다. Claude 미가용 시 flags 기반 결정론적 요약으로 graceful degrade (항상 유용).

## 아키텍처 원칙

- **에페메랄**: 신규 테이블 0. 결과는 저장 안 함(버튼 누를 때마다 생성). 기존 customer-ai draft 패턴과 동일.
- **graceful**: `ANTHROPIC_API_KEY` 없거나 Claude 오류 시 `ruleBasedPreReview`(순수, flags 집계) 반환. never-throw.
- **입력 재사용**: 패널이 이미 로드한 detail(summary + rows)을 그대로 POST. 서버 재조회 없음. rows 는 200건 cap.
- **공용 컴포넌트** 1개를 4패널에 삽입.

## 데이터 흐름

```
[패널] "AI 검토 실행" 클릭
   → POST /api/operator/workqueue/[queueId]/ai-review
        body: { taxView, period, summary, rows(≤200, 각 flags 포함) }
   → generateQueuePreReview(input)
        - ANTHROPIC_API_KEY 있음 → Claude sonnet-4-6, JSON 파싱 성공 시 mode='ai'
        - 없음/파싱 실패/오류 → ruleBasedPreReview(input) mode='rule'
   → { riskLevel, headline, findings[], recommendation, mode }
[AiPreReviewBox] 위험도 badge + headline + findings + 추천 렌더
```

## 구성 단위

### 1. 헬퍼 — `src/lib/operator/ai-prereview.ts`
```ts
export interface PreReviewRow { flags: { level: 'red'|'amber'|'green'; label: string }; [k: string]: unknown; }
export interface PreReviewInput {
  taxView: string; period: string;
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
export function ruleBasedPreReview(input: PreReviewInput): PreReviewResult; // 순수
export async function generateQueuePreReview(input: PreReviewInput): Promise<PreReviewResult>; // Claude→rule fallback
```
- `ruleBasedPreReview` (순수, 유닛): red/전체 비율 → riskLevel(red 없음 low / red>0 medium / red 비율>0.5 high). headline "N건 중 M건 확인 필요". findings = flags.label 별 카운트 집계(내림차순, 상위 5). recommendation 은 riskLevel 별 고정 문구.
- `generateQueuePreReview`: key 있으면 Claude 호출(프롬프트에 taxView/period/summary + rows 의 flags.label 요약 + 첫 N행 JSON). 응답에서 `{riskLevel, headline, findings, recommendation}` JSON 파싱. 실패/무키/오류 → `ruleBasedPreReview`. never-throw.

### 2. 엔드포인트 — `POST /api/operator/workqueue/[queueId]/ai-review`
- operator 게이트(기존 route 동일).
- body: `{ taxView, period, summary, rows }`. rows 없거나 배열 아님 → 400.
- `rows.slice(0, 200)` 로 cap 후 `generateQueuePreReview` 호출.
- 응답 `{ success: true, data: PreReviewResult }`. 헬퍼가 never-throw 이므로 항상 200(rule fallback 포함).

### 3. UI — `src/components/operator/workqueue/AiPreReviewBox.tsx`
- props: `{ queueId, taxView, period, summary, rows }`.
- "AI 검토 실행" 버튼 → POST → 로딩 → 결과 렌더. 결과: 위험도 badge(low green/medium amber/high red) + headline(b) + findings(ul) + 추천(p) + mode 표기("AI" vs "규칙 기반"). 오류 시 재시도.
- 4패널(Pph21/Withholding/Ppn/Umkm ReviewPanel)의 요약 4카드 아래에 삽입. 각 패널은 자기 detail(summary+rows)을 그대로 전달(모든 row 타입에 `.flags` 존재).

### 4. smoke — `scripts/test-workqueue-ai-review.ts` + runner
- operator 토큰으로 POST(합성 payload: taxView='withholding', rows 몇 건 with flags) → 200 + `data.riskLevel ∈ {low,medium,high}` + `Array.isArray(data.findings)` + `data.mode ∈ {ai,rule}`.
- rows 누락 → 400.
- customer 토큰 → 403.
- (무키 환경이면 mode='rule' 허용 — 계약은 shape 만 검증.) runner non-optional step.

## 비범위

자동 실행·캐싱(테이블), 승인 반려 루프, 연신고, AI 결과 영속화, 직원 단위 AI(현 PPh21 패널의 정적 박스는 유지).

## 알려진 확인 지점 (구현 중)

1. Claude 모델 상수 재사용(`claude-sonnet-4-6`, draft.ts 와 동일).
2. 4패널에 박스 삽입 시 각 패널의 rows 변수명(rows/detail.rows) 일관성.
3. 프롬프트 토큰 bound (rows 200 cap + flags.label 요약 우선).
