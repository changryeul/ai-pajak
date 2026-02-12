import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/client';

/**
 * AI-Powered Tax Law Analyzer
 *
 * 인도네시아 세법 문서(PMK, PP, UU)를 Claude AI로 자동 분석하여
 * 데이터베이스 업데이트 제안을 생성합니다.
 *
 * 기능:
 * 1. 법령 문서 자동 파싱 (PDF/텍스트)
 * 2. 변경사항 식별 및 추출
 * 3. SQL 마이그레이션 스크립트 자동 생성
 * 4. 영향 분석 (affected calculators)
 */

export type LawType = 'UU' | 'PP' | 'PMK' | 'PERATURAN_DJP';

export type ChangeType =
  | 'RATE_CHANGE'          // 세율 변경 (PPN 11% → 12%)
  | 'PTKP_CHANGE'          // PTKP 금액 변경
  | 'BRACKET_CHANGE'       // 세금 구간 변경
  | 'NEW_REGULATION'       // 새로운 규정 추가
  | 'EXEMPTION_CHANGE'     // 면세/감면 조건 변경
  | 'CLASSIFICATION_CHANGE' // 분류 기준 변경 (사치품 목록 등)
  | 'DEADLINE_CHANGE';     // 신고 기한 변경

export interface TaxLawAnalysisResult {
  law_type: LawType;
  law_number: string;
  law_title: string;
  effective_date: string;
  change_type: ChangeType[];
  summary: string;
  detailed_changes: DetailedChange[];
  affected_systems: string[];
  suggested_migrations: string[];
  confidence_score: number; // 0-100, AI 분석 신뢰도
  requires_human_review: boolean;
}

export interface DetailedChange {
  section: string; // 조항 (Pasal X ayat Y)
  change_description: string;
  before_value?: string | number | boolean | null;
  after_value?: string | number | boolean | null;
  legal_basis: string;
  implementation_notes?: string;
}

export class TaxLawAnalyzer {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * 법령 문서를 AI로 분석
   *
   * @param documentText - 법령 전문 (PDF → 텍스트 변환 후)
   * @param documentMetadata - 문서 메타데이터 (번호, 제목 등)
   */
  async analyzeLawDocument(
    documentText: string,
    documentMetadata?: {
      law_number?: string;
      law_title?: string;
      published_date?: string;
    }
  ): Promise<TaxLawAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(documentText, documentMetadata);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      temperature: 0, // 정확한 분석을 위해 temperature 0
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Claude 응답을 구조화된 JSON으로 파싱
    const analysis = this.parseClaudeResponse(responseText);

    // 데이터베이스에 분석 결과 저장
    await this.saveAnalysisResult(analysis, documentText);

    return analysis;
  }

  /**
   * Claude 프롬프트 생성
   */
  private buildAnalysisPrompt(
    documentText: string,
    metadata?: { law_number?: string; law_title?: string; published_date?: string }
  ): string {
    return `당신은 인도네시아 세법 전문가입니다. 다음 세법 문서를 분석하여 변경사항을 추출하고,
시스템 업데이트에 필요한 정보를 구조화된 JSON으로 제공하세요.

# 문서 정보
${metadata ? `
- 법령 번호: ${metadata.law_number || '알 수 없음'}
- 법령 제목: ${metadata.law_title || '알 수 없음'}
- 공포일: ${metadata.published_date || '알 수 없음'}
` : ''}

# 법령 전문
${documentText}

---

# 분석 요구사항

다음 JSON 형식으로 응답하세요:

\`\`\`json
{
  "law_type": "UU | PP | PMK | PERATURAN_DJP",
  "law_number": "법령 번호 (예: PMK 131/2024)",
  "law_title": "법령 제목",
  "effective_date": "시행일 (YYYY-MM-DD)",
  "change_type": ["RATE_CHANGE", "PTKP_CHANGE", ...],
  "summary": "주요 변경사항 3-5문장 요약",
  "detailed_changes": [
    {
      "section": "Pasal X ayat Y",
      "change_description": "구체적 변경 내용",
      "before_value": "변경 전 값 (있다면)",
      "after_value": "변경 후 값",
      "legal_basis": "법적 근거",
      "implementation_notes": "구현 시 주의사항"
    }
  ],
  "affected_systems": [
    "ppn-calculator (PPN 세율 변경으로 영향)",
    "pph21-calculator (PTKP 변경으로 영향)",
    ...
  ],
  "suggested_migrations": [
    "-- SQL 마이그레이션 예시\\nUPDATE tax_rates SET ppn_statutory_rate = 0.12 WHERE year = 2025;",
    ...
  ],
  "confidence_score": 85,
  "requires_human_review": true
}
\`\`\`

# 특별 지침

1. **세율 변경** 감지:
   - PPN, PPh21, PPh23, PPh Final 등의 세율 변경
   - 변경 전후 값을 명확히 구분
   - 시행일 정확히 파싱

2. **PTKP 변경** 감지:
   - TK0, K0, KI0 등 12개 카테고리별 금액
   - 년도별로 구분

3. **사치품 분류** 변경:
   - PMK 131/2024 Lampiran A 등에서 사치품 목록 추출
   - HS Code와 함께 추출

4. **제외 업종** 변경:
   - PPh Final PP 23/2018 제외 업종 목록
   - KLU 코드와 함께 추출

5. **SQL 마이그레이션** 자동 생성:
   - INSERT/UPDATE 문 생성
   - effective_from 날짜 포함
   - legal_basis 포함

6. **신뢰도 점수**:
   - 명확한 숫자/날짜: 90-100점
   - 해석 필요한 부분: 60-89점
   - 모호한 표현: 0-59점

7. **Human Review 필요 조건**:
   - 신뢰도 < 80점
   - 기존 시스템과 충돌 가능성
   - 복잡한 조건부 로직

**중요**: 응답은 반드시 유효한 JSON이어야 하며, 추가 설명은 JSON 외부에 작성하지 마세요.`;
  }

  /**
   * Claude 응답을 파싱하여 구조화된 객체로 변환
   */
  private parseClaudeResponse(responseText: string): TaxLawAnalysisResult {
    // JSON 코드 블록 추출
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);

    if (!jsonMatch) {
      // JSON 블록이 없으면 전체를 JSON으로 시도
      try {
        return JSON.parse(responseText);
      } catch {
        throw new Error('Failed to parse Claude response as JSON');
      }
    }

    const jsonString = jsonMatch[1];

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('JSON parsing error:', error);
      throw new Error('Invalid JSON in Claude response');
    }
  }

  /**
   * 분석 결과를 데이터베이스에 저장
   */
  private async saveAnalysisResult(
    analysis: TaxLawAnalysisResult,
    originalDocument: string
  ): Promise<void> {
    const supabase = createClient();

    await supabase.from('tax_law_analyses').insert({
      law_type: analysis.law_type,
      law_number: analysis.law_number,
      law_title: analysis.law_title,
      effective_date: analysis.effective_date,
      change_type: analysis.change_type,
      summary: analysis.summary,
      detailed_changes: analysis.detailed_changes,
      affected_systems: analysis.affected_systems,
      suggested_migrations: analysis.suggested_migrations,
      confidence_score: analysis.confidence_score,
      requires_human_review: analysis.requires_human_review,
      original_document: originalDocument,
      status: analysis.requires_human_review ? 'PENDING_REVIEW' : 'APPROVED',
      analyzed_at: new Date().toISOString()
    });
  }

  /**
   * 승인된 변경사항을 자동으로 적용
   *
   * @param analysisId - 분석 결과 ID
   * @param approvedBy - 승인한 세무사 ID
   */
  async applyApprovedChanges(
    analysisId: string,
    approvedBy: string
  ): Promise<{ success: boolean; applied_migrations: string[] }> {
    const supabase = createClient();

    // 1. 분석 결과 조회
    const { data: analysis, error } = await supabase
      .from('tax_law_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error || !analysis) {
      throw new Error('Analysis not found');
    }

    if (analysis.status !== 'APPROVED') {
      throw new Error('Analysis must be approved before applying changes');
    }

    // 2. 제안된 마이그레이션 실행
    const appliedMigrations: string[] = [];

    for (const migration of analysis.suggested_migrations) {
      try {
        // SQL 실행 (주의: 프로덕션에서는 더 안전한 방식 필요)
        const { error: migrationError } = await supabase.rpc('execute_sql', {
          sql_query: migration
        });

        if (migrationError) {
          console.error('Migration failed:', migration, migrationError);
        } else {
          appliedMigrations.push(migration);
        }
      } catch (err) {
        console.error('Error executing migration:', err);
      }
    }

    // 3. 적용 기록 저장
    await supabase.from('tax_law_applications').insert({
      analysis_id: analysisId,
      applied_by: approvedBy,
      applied_migrations: appliedMigrations,
      applied_at: new Date().toISOString()
    });

    // 4. 상태 업데이트
    await supabase
      .from('tax_law_analyses')
      .update({ status: 'APPLIED' })
      .eq('id', analysisId);

    return {
      success: true,
      applied_migrations: appliedMigrations
    };
  }

  /**
   * 특정 법령 유형의 템플릿 프롬프트 생성
   */
  static getTemplatePrompt(lawType: LawType): string {
    const templates = {
      PMK: '재무부 규정 (Peraturan Menteri Keuangan) 분석 템플릿',
      PP: '정부 규정 (Peraturan Pemerintah) 분석 템플릿',
      UU: '법률 (Undang-Undang) 분석 템플릿',
      PERATURAN_DJP: 'DJP 규정 분석 템플릿'
    };

    return templates[lawType] || '일반 세법 문서 분석';
  }
}

/**
 * PDF를 텍스트로 변환하는 유틸리티
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
  const data = await pdfParse(pdfBuffer);
  return data.text;
}

/**
 * PDF 파일에서 메타데이터 추출
 */
export async function extractPDFMetadata(pdfBuffer: Buffer): Promise<{
  pages: number;
  info: Record<string, unknown>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
  const data = await pdfParse(pdfBuffer);
  return {
    pages: data.numpages,
    info: data.info || {}
  };
}
