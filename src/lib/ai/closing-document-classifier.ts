/**
 * 결산 wizard 업로드 문서(매출 리스트, 매입 비용 리스트, 은행 거래내역 등)를
 * Anthropic SDK 로 분류하고 합계/행수/샘플 행을 추출한다.
 *
 * 사용 위치: /api/tax/annual-closing/[id]/document/[docId]/ocr
 *
 * 키 미설정 → throw NotConfiguredError ; UI 는 친화적 메시지로 변환.
 */

import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';

export class ClosingClassifierNotConfigured extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY 미설정 — 결산 문서 자동 분류 사용 불가');
    this.name = 'ClosingClassifierNotConfigured';
  }
}

export type ClosingCategory =
  | 'SALES_LIST'
  | 'PURCHASE_LIST'
  | 'BANK_STATEMENT'
  | 'FINANCIAL_STATEMENT'
  | 'PAYROLL'
  | 'INVENTORY'
  | 'OTHER';

/** Per-employee row pulled from a PAYROLL document (used to prefill 1721 A1). */
export interface PayrollEmployeeRow {
  employeeName: string;
  npwp: string | null;
  nik: string | null;
  ptkpCode: string | null;
  grossSalary: number | null;
  jht: number | null;
  jp: number | null;
}

export interface ClosingClassificationResult {
  category: ClosingCategory;
  confidence: number;          // 0~1
  totalAmount: number | null;
  rowCount: number | null;
  lineItems: Array<{
    description: string;
    amount: number | null;
    date: string | null;
  }>;
  /**
   * When category=PAYROLL, the classifier additionally extracts one row per
   * employee. Used by /api/tax/annual-closing/[id]/ebupot-prefill to
   * auto-populate the 1721 A1 issuance form. Empty/absent for other
   * categories.
   */
  payrollRows?: PayrollEmployeeRow[];
  summary: string;
  rawText: string;
  model: string;
}

export interface ClassifyInput {
  data: ArrayBuffer;
  mimeType: string;
  /** 결산 wizard의 doc_type 힌트 (sales/purchase/bank 등). prompt 정확도 향상. */
  docTypeHint?: string;
}

const MODEL = 'claude-sonnet-4-20250514';
const MAX_LINE_ITEMS = 20;
const MAX_PAYROLL_ROWS = 200;
const VALID_PTKP = new Set([
  'TK0', 'TK1', 'TK2', 'TK3',
  'K0', 'K1', 'K2', 'K3',
  'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3',
]);

function isConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && !key.startsWith('sk-ant-your-');
}

const PROMPT = `당신은 인도네시아 법인 연간 결산 자료를 분류·요약하는 전문가입니다.

다음 카테고리 중 가장 적절한 하나를 고르고 JSON으로 응답하세요:
- SALES_LIST: 매출 리스트, 매출 장부, 인보이스 모음
- PURCHASE_LIST: 매입 비용 리스트, 매입 장부, 영수증 모음
- BANK_STATEMENT: 은행 거래내역서
- FINANCIAL_STATEMENT: 재무제표(손익계산서/대차대조표)
- PAYROLL: 급여 대장
- INVENTORY: 재고 명세
- OTHER: 위에 해당하지 않음

응답은 반드시 JSON 한 객체:
{
  "category": <위 카테고리 중 하나>,
  "confidence": 0.0 ~ 1.0,
  "totalAmount": 합계 금액 (IDR 정수, 알 수 없으면 null),
  "rowCount": 거래/행 수 (알 수 없으면 null),
  "lineItems": [
    { "description": "거래/품목 설명", "amount": IDR 숫자 또는 null, "date": "YYYY-MM-DD 또는 null" }
    // 최대 ${MAX_LINE_ITEMS}개. 매출/매입 리스트는 큰 항목 위주, 은행은 처음 ${MAX_LINE_ITEMS}개.
  ],
  "summary": "한국어 1~2문장 요약 (예: \\"2025년 매출 리스트, 총 8억 5천만 IDR, 47건\\")",
  "rawText": "문서에서 추출한 핵심 텍스트 (최대 2000자)",
  "payrollRows": [
    // category 가 PAYROLL 일 때만 채우세요. 그 외엔 빈 배열 또는 생략.
    // 직원별 1행. 최대 ${MAX_PAYROLL_ROWS}명. 1721 A1 양식 자동 채움에 사용.
    {
      "employeeName": "직원명 (있는 그대로)",
      "npwp": "직원 NPWP, 알 수 없으면 null",
      "nik": "직원 NIK, 알 수 없으면 null",
      "ptkpCode": "TK0|TK1|TK2|TK3|K0|K1|K2|K3 (또는 K/I/0 류), 알 수 없으면 null",
      "grossSalary": "연간 총급여 IDR 정수 (월급여 × 12 또는 자료에 명시된 연간 합계). 알 수 없으면 null",
      "jht": "직원 부담 JHT (BPJS Ketenagakerjaan 2%) IDR 정수, 알 수 없으면 null",
      "jp": "직원 부담 JP (Jaminan Pensiun 1%) IDR 정수, 알 수 없으면 null"
    }
  ]
}

규칙:
- 인도네시아 통화는 정수로 변환 ("Rp 1.000.000" → 1000000).
- 확실하지 않은 필드는 null. 추측하지 마세요.
- confidence 는 문서 명확도 + 카테고리 확신 정도.
- summary 와 description 은 한국어, 카테고리 영어 코드는 그대로.
- PAYROLL 이 아니면 payrollRows 는 빈 배열 [] 또는 생략하세요.
- 월급여만 있고 연간 합계가 없으면 month 수를 곱해 연간으로 환산하세요.`;

interface ParsedJson {
  category?: string;
  confidence?: number;
  totalAmount?: number | null;
  rowCount?: number | null;
  lineItems?: Array<{ description?: string; amount?: number | null; date?: string | null }>;
  payrollRows?: Array<{
    employeeName?: string;
    npwp?: string | null;
    nik?: string | null;
    ptkpCode?: string | null;
    grossSalary?: number | null;
    jht?: number | null;
    jp?: number | null;
  }>;
  summary?: string;
  rawText?: string;
}

/** 안전한 JSON 추출. 응답이 코드펜스(```json ... ```) 형태인 경우도 처리. */
function extractJson(text: string): ParsedJson | null {
  const trimmed = text.trim();
  // 코드펜스 제거
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  // 첫 { ~ 마지막 } 추출 (모델이 보조 텍스트 추가했을 경우 대비)
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const VALID_CATEGORIES: ClosingCategory[] = [
  'SALES_LIST', 'PURCHASE_LIST', 'BANK_STATEMENT',
  'FINANCIAL_STATEMENT', 'PAYROLL', 'INVENTORY', 'OTHER',
];

export async function classifyClosingDocument(
  input: ClassifyInput
): Promise<ClosingClassificationResult> {
  if (!isConfigured()) {
    throw new ClosingClassifierNotConfigured();
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64 = Buffer.from(input.data).toString('base64');

  // PDF는 document, 이미지는 image 타입.
  const isPdf = input.mimeType === 'application/pdf';
  const isImage = input.mimeType.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error(`지원하지 않는 mime type: ${input.mimeType}`);
  }

  const docPart = isPdf
    ? {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: input.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64,
        },
      };

  const hintLine = input.docTypeHint
    ? `\n\n참고: 사용자가 업로드한 슬롯은 "${input.docTypeHint}" 입니다 — 이 컨텍스트와 다르면 OTHER 로 분류해 주세요.`
    : '';

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [docPart, { type: 'text', text: PROMPT + hintLine }],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const parsed = extractJson(text);
  if (!parsed) {
    loggers.ocr.error({ text: text.slice(0, 500) }, 'closing classifier: JSON 파싱 실패');
    throw new Error('AI 응답 JSON 파싱 실패');
  }

  const category: ClosingCategory = VALID_CATEGORIES.includes(parsed.category as ClosingCategory)
    ? (parsed.category as ClosingCategory)
    : 'OTHER';
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
  const lineItemsRaw = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
  const lineItems = lineItemsRaw.slice(0, MAX_LINE_ITEMS).map((it) => ({
    description: String(it.description ?? '').slice(0, 200),
    amount: typeof it.amount === 'number' ? it.amount : null,
    date: typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : null,
  }));

  let payrollRows: PayrollEmployeeRow[] | undefined;
  if (category === 'PAYROLL' && Array.isArray(parsed.payrollRows)) {
    payrollRows = parsed.payrollRows
      .slice(0, MAX_PAYROLL_ROWS)
      .map((p) => ({
        employeeName: String(p.employeeName ?? '').trim().slice(0, 200),
        npwp: typeof p.npwp === 'string' && p.npwp.trim() ? p.npwp.trim().slice(0, 30) : null,
        nik: typeof p.nik === 'string' && p.nik.trim() ? p.nik.trim().slice(0, 30) : null,
        ptkpCode:
          typeof p.ptkpCode === 'string' && VALID_PTKP.has(p.ptkpCode.trim())
            ? p.ptkpCode.trim()
            : null,
        grossSalary:
          typeof p.grossSalary === 'number' && Number.isFinite(p.grossSalary) && p.grossSalary >= 0
            ? Math.round(p.grossSalary)
            : null,
        jht:
          typeof p.jht === 'number' && Number.isFinite(p.jht) && p.jht >= 0
            ? Math.round(p.jht)
            : null,
        jp:
          typeof p.jp === 'number' && Number.isFinite(p.jp) && p.jp >= 0 ? Math.round(p.jp) : null,
      }))
      .filter((p) => p.employeeName);
  }

  return {
    category,
    confidence,
    totalAmount: typeof parsed.totalAmount === 'number' ? parsed.totalAmount : null,
    rowCount: typeof parsed.rowCount === 'number' ? parsed.rowCount : null,
    lineItems,
    payrollRows,
    summary: String(parsed.summary ?? '').slice(0, 500),
    rawText: String(parsed.rawText ?? '').slice(0, 2000),
    model: MODEL,
  };
}
