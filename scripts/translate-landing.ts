/**
 * scripts/translate-landing.ts
 *
 * landing 데이터 (modules + pricing + text)를 한국어 → en/id/zh/ja 4개 언어로
 * Anthropic SDK 일괄 번역하고 src/data/landing/auto-translated.json 으로 저장.
 *
 * 실행:
 *   npx tsx scripts/translate-landing.ts
 *
 * 필요 env: ANTHROPIC_API_KEY (.env.local)
 */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { modulesKO } from '../src/data/landing/modules';
import { pricingKO } from '../src/data/landing/pricing';

config({ path: path.resolve(__dirname, '../.env.local') });

const client = new Anthropic();

// 텍스트 필드 (modules/pricing 제외)
const koText = {
  nav: { product: '서비스', start: '자료 제출', difference: '경쟁비교', faq: 'FAQ' },
  login: '로그인',
  viewPricing: '요금제 확인하기',
  chips: 'Personal · Corporate only',
  heroTop: '양식 맞추느라 시간 쓰지 마세요.',
  heroMain: 'AI가 신고 데이터, 세금코드, 세무 리스크까지 진단합니다',
  heroDesc:
    'AI Pajak은 고객이 사용하던 인보이스, Faktur Pajak, 영수증, 급여자료, 원천징수 자료를 그대로 제출하면 AI가 필요한 데이터를 읽고 분류합니다. 원천세 자료는 거래 성격을 분석해 ID Billing에 필요한 PPh 유형과 세금코드를 자동 판정하고, 제출 데이터와 신고 데이터를 근거로 법인세 납부 방식, PKP 신청 시기, 자산 증가 리스크, Tax Treaty 적용 가능성까지 안내합니다.',
  readiness: '준비도',
  missing: '누락자료',
  next: '다음 액션',
  personas: {
    personal: {
      label: '개인고객',
      icon: '👤',
      title: 'Personal Annual Filing',
      subtitle: 'A1/A2, 영수증, 소득자료를 다시 입력하지 않고 그대로 제출하는 개인 연간 신고',
      readiness: 72,
      missing: ['A1/A2 원천징수증', '12월 31일 기준 자산·부채 잔액', '기타 소득자료'],
      next: '소득·공제·자산 변동을 확인하고, 납부 또는 환급 가능성을 안내합니다.',
    },
    corporate: {
      label: '법인고객',
      icon: '🏢',
      title: 'Corporate Monthly & Annual Filing',
      subtitle: '인보이스, Faktur Pajak, 영수증, payroll, 계약서를 다시 정리하지 않고 제출하는 법인 세무 대시보드',
      readiness: 58,
      missing: ['PPN 매입 Faktur', '일부 원천세 계약서', 'PPh21 payroll template'],
      next: '올린 invoice와 계약서의 거래 성격을 분석해 원천세 유형과 세금코드 선택을 안내합니다.',
    },
  },
  cards: [
    ['AI 원천세 세금코드 판정', '거래 성격을 분석해 ID Billing에 필요한 PPh 유형과 세금코드를 자동 판정'],
    ['개인·법인 전용 흐름', '고객 유형별로 필요한 자료와 신고 절차를 분리'],
    ['AI 세무 인사이트', '제출 데이터와 신고 데이터를 근거로 세무 리스크와 다음 액션 안내'],
    ['그대로 올리는 자료 제출', '템플릿 작성 없이 기존 양식·사진·PDF에서 AI가 데이터 파싱'],
  ],
  trustTitle: '민감한 세무자료는 암호화 보관됩니다',
  trustDesc:
    'NPWP, NIK, 급여자료, Faktur Pajak, 계약서 등 민감자료는 암호화 보관을 전제로 설계합니다. 자료는 신고 준비와 고객별 세무 인사이트 제공 목적에 한해 사용됩니다.',
  trustItems: ['Encrypted data storage', 'Access-controlled workflow', 'Audit-ready filing evidence'],
  coreDiff: '핵심 차별화',
  advisoryKicker: 'AI Tax Advisory',
  taxTitle: 'ID Billing의 정확도는 원천세 세금코드에서 결정됩니다.',
  taxDesc:
    '기존 온라인 세무 플랫폼은 e-Billing 발행 기능은 제공하지만, 어떤 거래에 어떤 PPh 유형과 세금코드를 넣어야 하는지는 사용자가 직접 판단해야 하는 경우가 많습니다. AI Pajak은 invoice, 계약서, 거래처 정보, 서비스 내용을 분석해 ID Billing에 필요한 원천세 세금코드를 판정합니다.',
  taxCards: [
    ['거래 성격 분석', '서비스, 임대, 이자, 배당, 로열티, 건설 등 지급 성격을 분류'],
    ['PPh 유형 판정', 'PPh 4(2), 15, 22, 23, 26 등 적용 가능 유형을 구분'],
    ['세금코드 매칭', 'ID Billing 발행에 필요한 tax type / deposit type 값을 정리'],
    ['확인 필요 분리', '불명확한 거래는 별도 표시해 잘못된 코드 입력 리스크 감소'],
  ],
  advisoryTitle: '신고 데이터가 쌓일수록, AI가 필요한 세무 액션을 먼저 알려줍니다.',
  advisoryDesc:
    'AI Pajak은 고객이 제출한 자료와 신고 이력을 바탕으로 단순 계산을 넘어 세무 의사결정을 지원합니다. 법인세 납부 방식 변경, PKP 신청 시기, 수입 대비 자산 취득 이상, 해외거래와 Tax Treaty 검토 필요성을 고객별로 안내합니다.',
  advisoryCards: [
    ['법인세 납부 방식', 'UMKM Final Tax에서 PPh25로 전환해야 할 시점과 조건 안내'],
    ['PKP 신청 알림', '매출 추이를 기준으로 PKP 신청 필요 시기를 사전에 안내'],
    ['자산 증가 이상 감지', '신고 소득 대비 자산 취득이 과도한 경우 리스크 신호 표시'],
    ['Tax Treaty 체크', '해외거래, PPh26, DGT Form, 조세조약 적용 가능성 안내'],
  ],
  serviceFlow: '서비스 흐름',
  productTitle: '그냥 올리면, AI가 신고 데이터를 정리합니다',
  productDesc:
    '별도 템플릿에 맞춰 다시 입력할 필요가 없습니다. 인보이스, Faktur Pajak, 영수증, 급여자료를 쓰던 형태 그대로 제출하거나 촬영하면 AI가 필요한 데이터를 읽고 신고 준비 데이터로 정리합니다.',
  moduleStep: '서비스 단계',
  coreGuide: '핵심 안내',
  customerView: '고객이 확인하는 내용',
  outputs: '제공되는 결과',
  requiredDocs: '제출 가능한 자료',
  startKicker: 'Upload-ready documents',
  startTitle: '세무 신고용 자료를 새로 만들 필요가 없습니다.',
  startDesc:
    '쓰던 인보이스, Faktur Pajak, 영수증, 급여자료, 원천징수 자료를 그대로 제출하세요. 종이 영수증이나 세금계산서는 촬영해서 제출할 수 있고, AI가 필요한 데이터를 읽어 신고 준비 데이터로 정리합니다.',
  personalBtn: '개인 필수자료',
  corporateBtn: '법인 필수자료',
  methodTitle: '자료 제출 방식',
  methods: [
    '기존 양식 그대로 제출',
    '인보이스·Faktur·영수증 촬영',
    'AI 데이터 파싱',
    '확인 필요 항목만 체크',
    '신고 준비 데이터 자동 정리',
  ],
  guide: '안내',
  startNote:
    '자료를 별도 템플릿에 맞춰 재작성하지 않아도 됩니다. 원천세 대상 거래는 ID Billing에 필요한 세금코드 선택까지 이어지도록 안내합니다.',
  requirements: {
    personal: [
      ['필수', 'NIK/NPWP, 이름, 주소, 연락처'],
      ['필수', 'A1/A2 또는 원천징수 증빙'],
      ['필수', '12월 31일 기준 자산·부채 잔액'],
      ['해당 시', '프리랜스/사업/임대/이자/배당 소득자료'],
      ['해당 시', '가족관계 및 공제 관련 자료'],
    ],
    corporate: [
      ['필수', 'NPWP, KBLI, PKP 여부, 사업유형'],
      ['필수', '월별 매출·매입자료 및 Faktur Pajak'],
      ['필수', 'Payroll template 및 직원별 PPh21 자료'],
      ['해당 시', '원천세 대상 계약서·invoice'],
      ['해당 시', '은행거래 내역, 전년도 SPT Badan, PPh25 자료'],
    ],
  },
  compKicker: 'Competitive Comparison',
  compTitle: '기존 세무서비스, 온라인 세무 플랫폼과 무엇이 다른가',
  compDesc:
    'AI Pajak의 핵심 차별점은 원천세 거래의 성격을 분석해 ID Billing에 필요한 PPh 유형과 세금코드를 판정한다는 점입니다.',
  columns: ['비교 기준', '기존 세무사무소', '기존 온라인 세무 플랫폼', 'AI Pajak'],
  rows: [
    [
      '핵심 포지션',
      '전문가에게 자료를 보내고 결과를 기다리는 세무대행',
      'e-Filing, e-Billing, e-Faktur, e-Bupot 등 신고·납부·세금문서 처리 중심 플랫폼',
      '고객이 쓰던 자료를 그대로 올리면 AI가 필요한 데이터를 읽고 신고 준비까지 연결하는 자동화 플랫폼',
    ],
    [
      '고객 경험',
      'WhatsApp, 이메일, 엑셀로 자료를 전달하고 진행상황은 별도 문의',
      '사용자가 직접 세금문서·신고·납부 기능을 조작하는 방식',
      '고객은 별도 템플릿 없이 기존 자료나 촬영본을 제출하고, AI가 정리한 결과와 진행상태를 확인',
    ],
    [
      '원천세 세금코드',
      '담당자가 거래 내용을 보고 수작업으로 판단하는 경우가 많음',
      '사용자가 직접 세금 유형과 납부 코드를 선택해야 하는 구조가 많음',
      'invoice·계약서·거래처 정보를 분석해 ID Billing에 필요한 PPh 유형과 세금코드를 자동 판정',
    ],
    [
      'AI 세무 인사이트',
      '담당자 경험에 따라 안내 수준이 달라질 수 있음',
      '신고·납부 기능은 제공하지만 고객별 세무 의사결정 안내는 제한적',
      '납부 방식 전환, PKP 신청, 자산 증가 리스크, Tax Treaty 검토 필요성을 안내',
    ],
    [
      '차별화 포인트',
      '전문가의 설명과 세무대행 경험',
      '전자신고·납부 처리 편의성, 단 세금코드 판단은 사용자의 입력과 이해에 의존',
      '자료 파싱, 원천세 세금코드 판정, AI 세무 인사이트, 신고 준비도, 증빙관리',
    ],
  ],
  pricingKicker: '요금 안내',
  pricingTitle: '요금제를 선택하면 상세 범위를 바로 확인할 수 있습니다',
  pricingDesc:
    '개인 신고는 양식명이 아니라 신고 복잡도 기준으로 안내합니다. 개인 세무, 법인 월관리, 법인 연결산 중 필요한 상품을 클릭하면 가격·적용 기준·포함 내용을 자세히 볼 수 있습니다.',
  pricingListTitle: '요금제 종류',
  chooseService: '필요한 서비스를 선택하세요',
  pricingListDesc: '클릭하면 오른쪽에 상세 내용이 표시됩니다.',
  selectedPlan: '선택한 요금제',
  included: '포함 내용',
  criteria: '적용 기준',
  pricingInfo:
    '표시된 금액은 기본 요금입니다. 실제 신고 범위는 제출 자료, 거래량, 해외거래·특수관계 여부 등에 따라 최종 확인됩니다.',
  pricingButton: '제출 가능 자료 보기 →',
  groups: ['개인 세무', '법인 월관리', '법인 연결산'],
  faqs: [
    [
      '신고 준비를 시작하려면 어떤 자료가 필요한가요?',
      '개인고객은 NIK/NPWP, A1/A2, 가족정보, 자산·부채 자료가 기본입니다. 법인고객은 NPWP, KBLI, PKP 여부, 매출·매입자료, PPh21 급여자료, 원천세 관련 invoice/계약서, PPN 자료 등이 필요합니다.',
    ],
    [
      'OnlinePajak, Klikpajak 같은 플랫폼과 정면 경쟁인가요?',
      '완전히 같은 포지션은 아닙니다. 기존 온라인 세무 플랫폼은 e-Filing, e-Billing, e-Faktur, e-Bupot 등 신고·납부·전자세금문서 기능이 강점입니다. AI Pajak의 핵심 차별점은 invoice와 계약서의 거래 성격을 분석해 원천세 유형과 ID Billing 세금코드를 자동 판정한다는 점입니다.',
    ],
    [
      '개인 신고 요금은 1770SS/1770S/1770 기준인가요?',
      '아니요. 개인 연간 신고는 통합된 흐름을 기준으로 안내합니다. AI Pajak의 개인 요금은 양식명이 아니라 소득 유형, 원천징수 자료 수, 자산·부채 복잡도, 사업/프리랜스 소득 여부를 기준으로 구분합니다.',
    ],
    [
      'AI 세무 인사이트는 어떤 내용을 알려주나요?',
      '제출자료와 신고 데이터를 근거로 법인세 납부 방식 변경 가능성, PKP 신청 시기, 수입 대비 자산 취득 이상, 해외거래와 Tax Treaty 검토 필요성 등을 안내합니다.',
    ],
  ],
  finalTitle: 'AI Pajak은 자료 준비부터 신고완료 증빙까지 함께 관리합니다.',
  finalDesc: '개인과 법인 고객이 필요한 자료를 준비하면, AI Pajak이 신고 준비 상태와 다음 액션을 명확하게 안내합니다.',
  finalButton: '로그인 후 신고 시작하기 →',
  footerCompare: 'Comparison',
  footerPricing: 'Pricing detail',
  footerDocs: 'Required documents',
};

const PRESERVE = [
  'AI Pajak',
  'PPh',
  'PPN',
  'NPWP',
  'NIK',
  'KBLI',
  'PKP',
  'Faktur Pajak',
  'ID Billing',
  'SPT',
  'SPT Badan',
  'UMKM',
  'Tax Treaty',
  'DGT Form',
  'PPh21',
  'PPh22',
  'PPh23',
  'PPh25',
  'PPh26',
  'PPh 4(2)',
  'PPh15',
  'PPh29',
  'e-Billing',
  'e-Filing',
  'e-Faktur',
  'e-Bupot',
  'NTPN',
  'BPE',
  '1721 A1',
  '1770',
  '1770S',
  '1770SS',
  '1771',
  'A1',
  'A2',
  'A1/A2',
  'OnlinePajak',
  'Klikpajak',
  'payroll',
  'invoice',
  'Rp',
];

const PROMPT_BASE = `You are translating landing-page copy for "AI Pajak", an Indonesian tax-filing automation SaaS for individuals (개인) and corporations (법인).

Rules:
- Output a valid JSON value that EXACTLY mirrors the input structure (same keys, same nesting, same array shapes, same array lengths, same tuple lengths).
- Keep these terms verbatim: ${PRESERVE.join(', ')}
- Keep numeric values, dates, "Rp" currency strings, percentages, emoji, arrows (→, •, ✓, ·) unchanged.
- Translate "양식 맞추느라 시간 쓰지 마세요" naturally for a punchy marketing headline, not literal.
- "건당 결제" → per-filing badge. "월 선납" → monthly prepaid badge. "1회 선납" → one-time prepaid badge.
- "필수" → required label (short, e.g. "Required"/"Wajib"/"必填"/"必須").
- "해당 시" → if-applicable label (short).
- Use double-quote ("") for strings. Properly escape any embedded quotes as \\". Strings must be on a single line (no raw newlines inside string values).
- Your output will be parsed with JSON.parse(). If it is not valid JSON, it will be rejected.
- Output ONLY the JSON value. No markdown code fences, no commentary, no \`\`\`.`;

const LANG_LABEL: Record<string, string> = {
  en: 'English (marketing-grade, concise, natural)',
  id: 'Bahasa Indonesia (natural marketing tone)',
  zh: 'Simplified Chinese (Mainland China, marketing tone)',
  ja: 'Japanese (natural marketing tone, polite form)',
};

const CACHE_DIR = path.resolve(__dirname, '.translate-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

function cachePath(lang: string, label: string) {
  return path.join(CACHE_DIR, `${lang}-${label}.json`);
}

function sanitizeJson(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,(\s*[}\]])/g, '$1');
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) return fence[1];
  // Find first { or [ ... last } or ]
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  let start = -1;
  if (startObj < 0) start = startArr;
  else if (startArr < 0) start = startObj;
  else start = Math.min(startObj, startArr);
  if (start < 0) return text;
  // crude: take from start to end
  return text.slice(start).trim();
}

async function callOnce(targetLang: string, source: unknown): Promise<string> {
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 24000,
    messages: [
      {
        role: 'user',
        content: `${PROMPT_BASE}\n\nTranslate the JSON below from Korean to ${targetLang}.\n\n${JSON.stringify(
          source,
          null,
          2,
        )}`,
      },
    ],
  });
  const final = await stream.finalMessage();
  const block = final.content[0];
  if (block.type !== 'text') throw new Error('Non-text response');
  return block.text;
}

async function translatePart(targetLang: string, source: unknown, label: string, langCode: string) {
  const cp = cachePath(langCode, label);
  if (fs.existsSync(cp)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cp, 'utf8'));
      console.log(`  • ${label} (cached)`);
      return cached;
    } catch {
      // fall through to refetch
    }
  }
  console.log(`  • ${label}…`);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const text = await callOnce(targetLang, source);
      const jsonStr = extractJson(text);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = JSON.parse(sanitizeJson(jsonStr));
      }
      fs.writeFileSync(cp, JSON.stringify(parsed, null, 2));
      return parsed;
    } catch (e) {
      lastErr = e;
      const dumpPath = path.join(CACHE_DIR, `FAIL-${langCode}-${label}-attempt${attempt}.txt`);
      try {
        const text = await callOnce(targetLang, source);
        fs.writeFileSync(dumpPath, text);
      } catch {}
      console.warn(`  ! parse failed (attempt ${attempt}) for ${label}: ${(e as Error).message}`);
    }
  }
  throw lastErr;
}

async function main() {
  const langs = Object.keys(LANG_LABEL);
  const output: Record<string, { modules: unknown; pricing: unknown; text: unknown }> = {
    ko: { modules: modulesKO, pricing: pricingKO, text: koText },
  };

  for (const code of langs) {
    const label = LANG_LABEL[code];
    console.log(`\n=== ${code} (${label}) ===`);
    const [modules, pricing, text] = await Promise.all([
      translatePart(label, modulesKO, 'modules', code),
      translatePart(label, pricingKO, 'pricing', code),
      translatePart(label, koText, 'text', code),
    ]);
    output[code] = { modules, pricing, text };
  }

  const outPath = path.resolve(__dirname, '../src/data/landing/auto-translated.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Written: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
