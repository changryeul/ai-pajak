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

export async function processArticleWithAI(article: RawArticle): Promise<ProcessedArticle> {
  const client = new Anthropic();

  // Step 1: Try structured analysis
  let summaryKo = '';
  let summaryId = '';
  let summaryEn = '';
  let impactAnalysis = '';
  let category = 'GENERAL';
  let tags: string[] = [];
  let regulationNumber: string | null = null;
  let importance = 'NORMAL';

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: AI_PROMPT,
      messages: [{
        role: 'user',
        content: `Title: ${article.title}\n\n${article.content && article.content !== article.title ? `Description: ${article.content.substring(0, 2000)}` : '(Generate based on title and your Indonesian tax knowledge)'}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    loggers.api.info({ title: article.title, aiResponse: text.substring(0, 200) }, 'AI news raw response');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    if (parsed) {
      summaryId = parsed.summary_id || parsed.summaryId || '';
      summaryKo = parsed.summary_ko || parsed.summaryKo || '';
      summaryEn = parsed.summary_en || parsed.summaryEn || '';
      impactAnalysis = parsed.impact_analysis || parsed.impactAnalysis || '';
      category = parsed.category || 'GENERAL';
      tags = parsed.tags || [];
      regulationNumber = parsed.regulation_number || parsed.regulationNumber || null;
      importance = parsed.importance || 'NORMAL';
    }
  } catch (error) {
    loggers.api.error({ err: error, title: article.title }, 'AI structured analysis failed');
  }

  // Step 2: If Korean summary is still empty, do a separate translation call
  if (!summaryKo) {
    try {
      const translateResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `다음 인도네시아 세금 뉴스 제목을 한국어로 2-3문장으로 요약해주세요. 제목만 보고 내용을 유추하여 설명해주세요.\n\n제목: ${article.title}\n${article.content !== article.title ? `설명: ${article.content.substring(0, 500)}` : ''}\n\n한국어 요약:`,
        }],
      });

      summaryKo = translateResponse.content[0].type === 'text' ? translateResponse.content[0].text.trim() : '';
      loggers.api.info({ title: article.title, summaryKo: summaryKo.substring(0, 50) }, 'Korean translation fallback');
    } catch (error) {
      loggers.api.error({ err: error }, 'Korean translation fallback failed');
      summaryKo = article.title; // Last resort: use original title
    }
  }

  // Step 3: If impact analysis is empty, generate it
  if (!impactAnalysis && summaryKo) {
    impactAnalysis = summaryKo;
  }

  return {
    source: article.source,
    sourceUrl: article.sourceUrl,
    originalTitle: article.title,
    originalContent: article.content.substring(0, 5000),
    summaryId: summaryId || article.title,
    summaryKo,
    summaryEn: summaryEn || article.title,
    impactAnalysis,
    category,
    tags,
    regulationNumber,
    importance,
    publishedAt: article.publishedAt || new Date().toISOString(),
  };
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
