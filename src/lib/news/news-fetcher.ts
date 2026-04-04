/**
 * Tax News Fetcher & AI Summarizer
 *
 * Sources:
 * 1. Google News RSS — "pajak indonesia" search
 * 2. DJP (pajak.go.id) — official site
 *
 * AI Processing:
 * - Korean summary (always generated)
 * - Indonesian summary
 * - English summary
 * - Impact analysis in Korean
 * - Category classification
 */

import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';

export interface RawArticle {
  source: string;
  sourceUrl: string;
  title: string;
  content: string;
  publishedAt: string;
}

export interface ProcessedArticle {
  source: string;
  sourceUrl: string;
  originalTitle: string;
  originalContent: string;
  summaryId: string;
  summaryKo: string;
  summaryEn: string;
  impactAnalysis: string;
  category: string;
  tags: string[];
  regulationNumber: string | null;
  importance: string;
  publishedAt: string;
}

const AI_PROMPT = `You are an Indonesian tax news analyst. You MUST respond in valid JSON format.

Given the article title (and description if available), generate:

{
  "summary_id": "2-3 sentence summary in Indonesian (Bahasa Indonesia). Explain what this news means for Indonesian taxpayers.",
  "summary_ko": "2-3 sentence summary in Korean (한국어). ALWAYS write in Korean. Explain what this news means.",
  "summary_en": "2-3 sentence summary in English.",
  "impact_analysis": "1-2 sentences in Korean (한국어) about how this affects businesses/individuals in Indonesia. Start with the specific impact.",
  "category": "one of: PPh21, PPh23, PPN, UMKM, TP, SPT, REGULATION, GENERAL",
  "tags": ["3-5 relevant keywords in Indonesian"],
  "regulation_number": "PMK/PP/UU number if mentioned (e.g. PMK 123/PMK.03/2026), or null",
  "importance": "CRITICAL if new law/major change, HIGH if new regulation, NORMAL for regular news, LOW for commentary"
}

CRITICAL RULES:
- summary_ko MUST be written in Korean (한국어), never in Indonesian or English
- impact_analysis MUST be written in Korean (한국어)
- Even if input is just a title, generate meaningful summaries based on your tax knowledge
- Respond ONLY with the JSON object, no markdown`;

/**
 * Process multiple articles in a single AI call (batch mode)
 * This avoids timeout issues on serverless functions
 */
export async function processArticlesBatch(articles: RawArticle[]): Promise<ProcessedArticle[]> {
  if (articles.length === 0) return [];

  const client = new Anthropic();
  const titleList = articles.map((a, i) => `${i + 1}. ${a.title}${a.content !== a.title ? ` — ${a.content.substring(0, 200)}` : ''}`).join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are an Indonesian tax news analyst. Process ALL articles below and return a JSON ARRAY.
For EACH article, create an object with:
- summary_ko: 2-3 sentence summary in KOREAN (한국어). MUST be Korean.
- summary_id: 2-3 sentence summary in Indonesian
- summary_en: 2-3 sentence summary in English
- impact_ko: 1 sentence impact analysis in KOREAN (한국어)
- category: PPh21, PPh23, PPN, UMKM, TP, SPT, REGULATION, or GENERAL
- importance: CRITICAL, HIGH, NORMAL, or LOW
- tags: 2-3 keywords

Return ONLY a valid JSON array. No markdown.`,
      messages: [{
        role: 'user',
        content: `Process these ${articles.length} Indonesian tax news articles:\n\n${titleList}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    loggers.api.info({ responseLength: text.length, preview: text.substring(0, 300) }, 'Batch AI response');

    let parsed: Array<Record<string, unknown>>;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else parsed = [];
    }

    return articles.map((article, i) => {
      const ai = parsed[i] || {};
      return {
        source: article.source,
        sourceUrl: article.sourceUrl,
        originalTitle: article.title,
        originalContent: article.content.substring(0, 5000),
        summaryId: (ai.summary_id as string) || article.title,
        summaryKo: (ai.summary_ko as string) || '',
        summaryEn: (ai.summary_en as string) || '',
        impactAnalysis: (ai.impact_ko as string) || (ai.summary_ko as string) || '',
        category: (ai.category as string) || 'GENERAL',
        tags: (ai.tags as string[]) || [],
        regulationNumber: null,
        importance: (ai.importance as string) || 'NORMAL',
        publishedAt: article.publishedAt || new Date().toISOString(),
      };
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Batch AI processing failed');
    // Return articles without AI processing
    return articles.map(article => ({
      source: article.source,
      sourceUrl: article.sourceUrl,
      originalTitle: article.title,
      originalContent: article.content.substring(0, 5000),
      summaryId: article.title,
      summaryKo: '',
      summaryEn: '',
      impactAnalysis: '',
      category: 'GENERAL',
      tags: [],
      regulationNumber: null,
      importance: 'NORMAL',
      publishedAt: article.publishedAt || new Date().toISOString(),
    }));
  }
}

/** Single article processing (kept for compatibility) */
export async function processArticleWithAI(article: RawArticle): Promise<ProcessedArticle> {
  const results = await processArticlesBatch([article]);
  return results[0];
}

/**
 * Fetch tax news from Google News RSS (most reliable source)
 */
export async function fetchGoogleNewsRSS(): Promise<RawArticle[]> {
  try {
    const query = encodeURIComponent('pajak indonesia perpajakan');
    const response = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`,
      {
        headers: { 'User-Agent': 'AI-Pajak-NewsBot/1.0' },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) return [];

    const xml = await response.text();
    const articles: RawArticle[] = [];

    // Parse RSS XML — extract <item> elements
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      if (articles.length >= 10) break;
      const item = match[1];

      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/);
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);

      const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
      if (!title || title.length < 10) continue;

      // Clean HTML from description
      const rawDesc = (descMatch?.[1] || descMatch?.[2] || '').replace(/<[^>]*>/g, '').trim();

      articles.push({
        source: (sourceMatch?.[1] || 'Google News').trim(),
        sourceUrl: (linkMatch?.[1] || '').trim(),
        title,
        content: rawDesc || title,
        publishedAt: pubDateMatch?.[1] ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
      });
    }

    return articles;
  } catch (error) {
    loggers.api.error({ err: error }, 'Google News RSS fetch failed');
    return [];
  }
}

/**
 * Fetch DJP official news
 */
export async function fetchDJPNews(): Promise<RawArticle[]> {
  try {
    const response = await fetch('https://pajak.go.id/id/siaran-pers', {
      headers: { 'User-Agent': 'AI-Pajak-NewsBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const articles: RawArticle[] = [];

    // Try multiple patterns
    const patterns = [
      /<a[^>]*href="([^"]*)"[^>]*title="([^"]{15,})"/g,
      /<h[23][^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]{15,})<\/a>/g,
    ];

    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (articles.length >= 5) break;
        const url = match[1].startsWith('http') ? match[1] : `https://pajak.go.id${match[1]}`;
        const title = match[2].trim();
        if (title.length < 15 || articles.some(a => a.title === title)) continue;
        articles.push({
          source: 'DJP',
          sourceUrl: url,
          title,
          content: title,
          publishedAt: new Date().toISOString(),
        });
      }
      if (articles.length >= 5) break;
    }

    return articles;
  } catch (error) {
    loggers.api.error({ err: error }, 'DJP news fetch failed');
    return [];
  }
}
