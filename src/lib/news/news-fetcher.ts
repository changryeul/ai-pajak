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
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: AI_PROMPT,
      messages: [{
        role: 'user',
        content: `Title: ${article.title}\n\n${article.content && article.content !== article.title ? `Description: ${article.content.substring(0, 2000)}` : '(No additional content — generate summary based on the title and your tax knowledge)'}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Try to extract JSON from response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('No valid JSON in response');
    }

    return {
      source: article.source,
      sourceUrl: article.sourceUrl,
      originalTitle: article.title,
      originalContent: article.content.substring(0, 5000),
      summaryId: parsed.summary_id || article.title,
      summaryKo: parsed.summary_ko || '',
      summaryEn: parsed.summary_en || '',
      impactAnalysis: parsed.impact_analysis || '',
      category: parsed.category || 'GENERAL',
      tags: parsed.tags || [],
      regulationNumber: parsed.regulation_number || null,
      importance: parsed.importance || 'NORMAL',
      publishedAt: article.publishedAt || new Date().toISOString(),
    };
  } catch (error) {
    loggers.api.error({ err: error, title: article.title }, 'AI news processing failed');
    return {
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
    };
  }
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
