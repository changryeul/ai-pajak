/**
 * Tax News Fetch Cron
 *
 * Fetches latest tax news from DJP + Kontan, processes with AI,
 * stores in database, sends WhatsApp for CRITICAL/HIGH items.
 *
 * Schedule: Every 6 hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchGoogleNewsRSS, fetchDJPNews, processArticlesBatch } from '@/lib/news/news-fetcher';
import type { RawArticle } from '@/lib/news/news-fetcher';
import { sendWhatsApp } from '@/lib/notifications/whatsapp-service';
import { loggers } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    loggers.api.info('Starting news fetch job');
    const startTime = Date.now();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch from sources (Google News RSS + DJP)
    const [googleArticles, djpArticles] = await Promise.all([
      fetchGoogleNewsRSS(),
      fetchDJPNews(),
    ]);

    const allArticles = [...googleArticles, ...djpArticles];
    let processed = 0;
    let skipped = 0;
    let waNotified = 0;
    const aiErrors: string[] = [];
    const sampleData: Array<{ title: string; summaryKo: string }> = [];

    // Filter out duplicates first
    const newArticles: RawArticle[] = [];
    for (const article of allArticles) {
      const { data: existing } = await supabase
        .from('tax_news')
        .select('id')
        .eq('original_title', article.title)
        .single();

      if (existing) {
        skipped++;
      } else {
        newArticles.push(article);
      }
    }

    // Batch process all new articles with AI in ONE call
    const results = await processArticlesBatch(newArticles);

    // Insert each result
    for (const result of results) {
      if (sampleData.length < 3) {
        sampleData.push({ title: result.originalTitle.substring(0, 60), summaryKo: result.summaryKo.substring(0, 80) });
      }
      if (!result.summaryKo) {
        aiErrors.push(`No KO: ${result.originalTitle.substring(0, 50)}`);
      }

      const { error: insertError } = await supabase.from('tax_news').insert({
        source: result.source,
        source_url: result.sourceUrl,
        original_title: result.originalTitle,
        original_content: result.originalContent,
        summary_id: result.summaryId,
        summary_ko: result.summaryKo,
        summary_en: result.summaryEn,
        impact_analysis: result.impactAnalysis,
        category: result.category,
        tags: result.tags,
        regulation_number: result.regulationNumber,
        importance: result.importance,
        published_at: result.publishedAt,
        is_active: true,
      });

      if (!insertError) {
        processed++;

        // WhatsApp notification for HIGH/CRITICAL
        if (result.importance === 'CRITICAL' || result.importance === 'HIGH') {
          try {
            // Get customers with WhatsApp enabled
            const { data: customers } = await supabase
              .from('customer')
              .select('phone_number, full_name, user_id')
              .not('phone_number', 'is', null);

            const { data: prefs } = await supabase
              .from('notification_preferences')
              .select('user_id, whatsapp_enabled')
              .eq('whatsapp_enabled', true);

            const waUsers = new Set((prefs || []).map(p => p.user_id));

            for (const customer of (customers || []).filter(c => waUsers.has(c.user_id))) {
              const emoji = result.importance === 'CRITICAL' ? '🚨' : '📢';
              await sendWhatsApp({
                to: customer.phone_number,
                text: `${emoji} *세금 뉴스 알림 - AI Pajak*\n\n*${result.originalTitle}*\n\n${result.summaryKo}\n\n${result.sourceUrl ? `원문: ${result.sourceUrl}` : ''}\n\n_자동 발송 by AI Pajak_`,
              });
              waNotified++;
            }
          } catch {
            // Best-effort
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    loggers.api.info({
      duration: `${duration}ms`,
      fetched: allArticles.length,
      processed,
      skipped,
      waNotified,
    }, 'News fetch completed');

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      fetched: allArticles.length,
      processed,
      skipped,
      waNotified,
      aiErrors: aiErrors.length > 0 ? aiErrors : undefined,
      sampleData: sampleData.length > 0 ? sampleData : undefined,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'News fetch cron failed');
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'news-fetch',
    configured: !!CRON_SECRET,
  });
}
