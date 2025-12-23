import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { TaxLawAnalyzer } from '@/lib/ai/tax-law-analyzer';

/**
 * AI 기반 세법 문서 자동 분석 API
 *
 * RBAC: TAX_ADVISOR_JTC만 접근 가능
 *
 * 기능:
 * 1. 법령 문서(텍스트)를 Claude AI로 분석
 * 2. 변경사항 자동 추출
 * 3. SQL 마이그레이션 스크립트 자동 생성
 * 4. 세무사 검토 대기열에 추가
 *
 * @route POST /api/admin/tax-law/analyze
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 인증 확인
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 권한 확인 (TAX_ADVISOR_JTC만 가능)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!userRole || userRole.role !== 'TAX_ADVISOR_JTC') {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only licensed tax advisors (TAX_ADVISOR_JTC) can analyze tax laws',
        },
        { status: 403 }
      );
    }

    // 3. 요청 파싱
    const body = await req.json();
    const { document_text, metadata } = body;

    if (!document_text || document_text.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Missing document_text',
          message: 'Please provide the full text of the tax law document',
        },
        { status: 400 }
      );
    }

    // 4. Claude AI로 분석
    console.info('[TAX_LAW_ANALYZE] Starting AI analysis', {
      metadata,
      documentLength: document_text.length,
      userId: session.user.id,
    });

    const analyzer = new TaxLawAnalyzer();
    const analysisResult = await analyzer.analyzeLawDocument(document_text, metadata);

    console.info('[TAX_LAW_ANALYZE] Analysis completed', {
      lawNumber: analysisResult.law_number,
      changeTypes: analysisResult.change_type,
      confidenceScore: analysisResult.confidence_score,
      requiresReview: analysisResult.requires_human_review,
    });

    // 5. 감사 로그
    await supabase.from('audit_log').insert({
      actor_user_id: session.user.id,
      actor_role: userRole.role,
      activity_type: 'TAX_LAW_ANALYZE',
      activity_details: {
        law_number: analysisResult.law_number,
        law_type: analysisResult.law_type,
        confidence_score: analysisResult.confidence_score,
        change_type: analysisResult.change_type,
      },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });

    // 6. 응답
    return NextResponse.json({
      success: true,
      analysis: {
        id: analysisResult.law_number, // Temporary, actual ID from DB
        law_number: analysisResult.law_number,
        law_title: analysisResult.law_title,
        effective_date: analysisResult.effective_date,
        summary: analysisResult.summary,
        change_type: analysisResult.change_type,
        affected_systems: analysisResult.affected_systems,
        confidence_score: analysisResult.confidence_score,
        requires_human_review: analysisResult.requires_human_review,
        detailed_changes: analysisResult.detailed_changes,
        suggested_migrations: analysisResult.suggested_migrations,
      },
      next_steps: analysisResult.requires_human_review
        ? 'This analysis requires human review before applying changes.'
        : 'Analysis is ready for automatic application.',
    });
  } catch (error: any) {
    console.error('[TAX_LAW_ANALYZE] Error:', error);

    // Anthropic API 오류 처리
    if (error.status === 401) {
      return NextResponse.json(
        {
          error: 'Anthropic API authentication failed',
          message: 'Please check ANTHROPIC_API_KEY environment variable',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Analysis failed',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/tax-law/analyze
 *
 * 대기 중인 분석 결과 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!userRole || userRole.role !== 'TAX_ADVISOR_JTC') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 대기 중인 분석 결과 조회
    const { data: analyses, error } = await supabase
      .from('tax_law_analyses')
      .select('*')
      .in('status', ['PENDING_REVIEW', 'APPROVED'])
      .order('analyzed_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      analyses: analyses || [],
      count: analyses?.length || 0,
    });
  } catch (error: any) {
    console.error('[TAX_LAW_ANALYZE] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analyses', message: error.message },
      { status: 500 }
    );
  }
}
