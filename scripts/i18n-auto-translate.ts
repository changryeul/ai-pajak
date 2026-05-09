/**
 * scripts/i18n-auto-translate.ts
 *
 * pph25Closing 등 지정 namespace 에서 한국어가 4 locale (en/id/ja/zh) 에 그대로
 * 남은 키들을 Anthropic SDK 로 일괄 번역.
 *
 * 사용:
 *   ANTHROPIC_API_KEY=sk-ant-xxx npx tsx scripts/i18n-auto-translate.ts \
 *     --namespace=pph25Closing            # 기본
 *     --batch=25                           # 한 번에 처리할 키 수 (기본 25)
 *     --dry-run                            # 첫 batch만 실행 + 결과 출력 (JSON 변경 X)
 *     --apply                              # 전체 실행 + JSON 파일 변경
 *
 * 안전장치:
 *   - dry-run 기본. --apply 명시 안 하면 파일 변경 안 함
 *   - 실 키 없으면 친화적 에러
 *   - JSON 파싱 실패한 batch 는 skip + 로그 (다른 batch 진행)
 *   - 번역 결과의 한글 비율이 일정 이상이면 의심 → 그 행만 skip
 */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(__dirname, '..');
const I18N_DIR = path.join(ROOT, 'src/i18n/messages');
const TARGET_LOCALES = ['en', 'id', 'ja', 'zh'] as const;
type Locale = (typeof TARGET_LOCALES)[number];

const NAMESPACE_HINTS: Record<string, string> = {
  pph25Closing: '인도네시아 법인 PPh 25 연간 결산(SPT Tahunan Badan) wizard 라벨. KAP/KJS/Koreksi Fiskal/Kredit Pajak 등 인도네시아 세무 용어는 음역 또는 원어 유지.',
  umkmClosing: '인도네시아 UMKM(소상공인) 결산 wizard 라벨. PPh Final 0.5%.',
};

interface Args {
  namespace: string;
  batch: number;
  dryRun: boolean;
  apply: boolean;
}

function parseArgs(): Args {
  const args: Args = { namespace: 'pph25Closing', batch: 25, dryRun: true, apply: false };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--namespace=')) args.namespace = a.slice('--namespace='.length);
    else if (a.startsWith('--batch=')) args.batch = parseInt(a.slice('--batch='.length), 10);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--apply') { args.apply = true; args.dryRun = false; }
  }
  return args;
}

function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
      else if (typeof v === 'string') out[key] = v;
    }
  }
  return out;
}

function setIn(obj: Record<string, unknown>, dotted: string, val: string) {
  const segs = dotted.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (!cur[seg] || typeof cur[seg] !== 'object') cur[seg] = {};
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]] = val;
}

function hasKorean(s: string): boolean {
  return /[가-힯]/.test(s);
}

function buildPrompt(namespace: string, items: Array<{ key: string; ko: string }>): string {
  const hint = NAMESPACE_HINTS[namespace] ?? '';
  const lines = items.map((it) => `  "${it.key}": ${JSON.stringify(it.ko)}`);
  return `당신은 인도네시아 세무 SaaS 다국어 번역가입니다. 아래 한국어 라벨을 영어(en), 인도네시아어(id), 일본어(ja), 중국어 간체(zh) 4 언어로 번역하세요.

컨텍스트: ${hint || '인도네시아 세무 SaaS UI 라벨.'}

번역 원칙:
- next-intl 형식 — {placeholder} 자리표시자는 그대로 보존.
- HTML 태그(<br/>, <strong>) 도 그대로 보존.
- 인도네시아 세법 고유명사 (NPWP, KAP, KJS, Koreksi Fiskal, Kredit Pajak, Bukti Potong, NTPN, BPE, SPT, PPh) 는 그대로 또는 음역.
- UI 라벨이라 간결하게 — 버튼은 명령형, 카드 제목은 명사형.
- 자연스럽지 않은 직역 금지.

입력 (한국어):
{
${lines.join(',\n')}
}

응답 형식: 위 키 그대로 사용한 단일 JSON 객체만. 코드펜스 없이 순수 JSON.
{
  "<키 이름>": { "en": "...", "id": "...", "ja": "...", "zh": "..." },
  ...
}`;
}

interface ParsedTranslation {
  [key: string]: {
    en?: string;
    id?: string;
    ja?: string;
    zh?: string;
  };
}

function extractJson(text: string): ParsedTranslation | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const candidate = fence ? fence[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callAnthropic(prompt: string, anthropic: Anthropic): Promise<string> {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

async function main() {
  const args = parseArgs();
  console.log(`📦 namespace=${args.namespace} batch=${args.batch} mode=${args.apply ? 'APPLY' : 'DRY-RUN'}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-your-') || apiKey.length < 30) {
    console.error('\n✗ ANTHROPIC_API_KEY 가 설정되지 않았습니다.');
    console.error('  ANTHROPIC_API_KEY=sk-ant-xxx npx tsx scripts/i18n-auto-translate.ts ... 형태로 실행하세요.');
    process.exit(1);
  }
  const anthropic = new Anthropic({ apiKey });

  // ── 입력 분석 ────────────────────────────────────────────────────
  const data: Record<string, Record<string, unknown>> = {};
  for (const l of ['ko', ...TARGET_LOCALES]) {
    data[l] = JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${l}.json`), 'utf8'));
  }

  const koFlat = flatten(data.ko[args.namespace] ?? {});
  const flatByLocale: Record<Locale, Record<string, string>> = {
    en: flatten(data.en[args.namespace] ?? {}),
    id: flatten(data.id[args.namespace] ?? {}),
    ja: flatten(data.ja[args.namespace] ?? {}),
    zh: flatten(data.zh[args.namespace] ?? {}),
  };

  const targets: Array<{ key: string; ko: string }> = [];
  for (const [k, ko] of Object.entries(koFlat)) {
    let needed = false;
    for (const l of TARGET_LOCALES) {
      const v = flatByLocale[l][k];
      if (typeof v === 'string' && hasKorean(v)) { needed = true; break; }
    }
    if (needed) targets.push({ key: k, ko });
  }

  console.log(`\n→ 번역 대상: ${targets.length} 키`);
  if (targets.length === 0) {
    console.log('  (모두 이미 번역됨)');
    return;
  }

  // ── batch 단위로 처리 ────────────────────────────────────────────
  const batches: Array<Array<{ key: string; ko: string }>> = [];
  for (let i = 0; i < targets.length; i += args.batch) {
    batches.push(targets.slice(i, i + args.batch));
  }
  console.log(`  batches: ${batches.length} (size ${args.batch})`);

  if (args.dryRun) {
    console.log(`\n🔍 DRY-RUN: 첫 batch 만 실행, JSON 파일 변경 없음.`);
    batches.splice(1);
  }

  const allTranslations: ParsedTranslation = {};
  let successBatches = 0;
  let failedBatches = 0;

  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    process.stdout.write(`  batch ${i + 1}/${batches.length} (${b.length} keys) → `);
    try {
      const prompt = buildPrompt(args.namespace, b);
      const text = await callAnthropic(prompt, anthropic);
      const parsed = extractJson(text);
      if (!parsed) {
        console.log('JSON 파싱 실패');
        failedBatches++;
        continue;
      }
      let mergedCount = 0;
      for (const it of b) {
        const tr = parsed[it.key];
        if (tr && typeof tr === 'object') {
          // 한국어 잔류 의심 — 의심되면 skip
          let suspicious = false;
          for (const l of TARGET_LOCALES) {
            const v = tr[l];
            if (typeof v === 'string' && hasKorean(v) && l !== 'ja') {
              suspicious = true;
              break;
            }
          }
          if (suspicious) {
            console.log(`\n    ⚠ ${it.key} 한글 잔류, skip`);
            continue;
          }
          allTranslations[it.key] = tr;
          mergedCount++;
        }
      }
      console.log(`OK (${mergedCount}/${b.length} 머지)`);
      successBatches++;
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
      failedBatches++;
    }
  }

  console.log(`\n📊 batches: ${successBatches} OK / ${failedBatches} FAIL`);
  console.log(`   번역된 키: ${Object.keys(allTranslations).length}`);

  if (args.dryRun) {
    console.log('\n🔍 DRY-RUN sample (첫 5개):');
    for (const k of Object.keys(allTranslations).slice(0, 5)) {
      console.log(`  ${k}`);
      console.log(`    ko: ${koFlat[k]}`);
      for (const l of TARGET_LOCALES) {
        console.log(`    ${l}: ${allTranslations[k][l]}`);
      }
    }
    console.log('\n→ 실제 적용하려면 --apply 플래그로 다시 실행하세요.');
    return;
  }

  // ── apply: JSON 파일 업데이트 ────────────────────────────────────
  for (const l of TARGET_LOCALES) {
    let writes = 0;
    for (const [k, tr] of Object.entries(allTranslations)) {
      const v = tr[l];
      if (typeof v === 'string' && v.length > 0) {
        setIn(data[l][args.namespace] as Record<string, unknown>, k, v);
        writes++;
      }
    }
    fs.writeFileSync(
      path.join(I18N_DIR, `${l}.json`),
      JSON.stringify(data[l], null, 2) + '\n',
      'utf8',
    );
    console.log(`  ${l}.json: ${writes} keys updated`);
  }
  console.log(`\n✅ 완료. (${Object.keys(allTranslations).length} keys × ${TARGET_LOCALES.length} locales)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
