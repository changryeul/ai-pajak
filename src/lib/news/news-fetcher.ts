/**
 * Tax News Fetcher & AI Summarizer
 *
 * Sources:
 * 1. DJP (pajak.go.id) — official regulations
 * 2. Kontan — tax news
 * 3. Bisnis Indonesia — business/tax
 *
 * AI Processing:
 * - 3-line summary (Indonesian)
 * - Korean/English translation
 * - Impact analysis
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

const AI_PROMPT = `You are an Indonesian tax news analyst. Analyze the following tax article and respond in JSON format:

{
  "summary_id": "3-line summary in Indonesian (Bahasa Indonesia)",
  "summary_ko": "3-line summary in Korean",
  "summary_en": "3-line summary in English",
  "impact_analysis": "Brief analysis of how this affects Indonesian taxpayers, in Korean",
  "category": "one of: PPh21, PPh23, PPN, UMKM, TP, SPT, REGULATION, GENERAL",
  "tags": ["relevant", "tax", "keywords"],
  "regulation_number": "PMK/PP/UU number if mentioned, or null",
  "importance": "LOW, NORMAL, HIGH, or CRITICAL"
}

Rules:
- CRITICAL: New law or major regulation change
- HIGH: New PMK/PP affecting many taxpayers
- NORMAL: Regular tax news
- LOW: Commentary or opinion pieces
- Always include regulation number if mentioned (e.g., "PMK 123/PMK.03/2026")

Respond ONLY with JSON.`;

export async function processArticleWithAI(article: RawArticle): Promise<ProcessedArticle> {
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: AI_PROMPT,
      messages: [{
        role: 'user',
        content: `Title: ${article.title}\n\nContent: ${article.content.substring(0, 3000)}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);

    return {
      source: article.source,
      sourceUrl: article.sourceUrl,
      originalTitle: article.title,
      originalContent: article.content.substring(0, 5000),
      summaryId: parsed.summary_id || '',
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
    loggers.api.error({ err: error }, 'AI news processing failed');
    return {
      source: article.source,
      sourceUrl: article.sourceUrl,
      originalTitle: article.title,
      originalContent: article.content.substring(0, 5000),
      summaryId: article.title,
      summaryKo: article.title,
      summaryEn: article.title,
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
 * Fetch tax news from DJP RSS-like source
 */
export async function fetchDJPNews(): Promise<RawArticle[]> {
  try {
    const response = await fetch('https://pajak.go.id/id/siaran-pers', {
      headers: { 'User-Agent': 'AI-Pajak-NewsBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    // Extract article titles and links from HTML (simplified)
    const articles: RawArticle[] = [];
    const titleMatches = html.matchAll(/<h[23][^>]*><a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g);

    for (const match of titleMatches) {
      if (articles.length >= 5) break;
      articles.push({
        source: 'DJP',
        sourceUrl: match[1].startsWith('http') ? match[1] : `https://pajak.go.id${match[1]}`,
        title: match[2].trim(),
        content: match[2].trim(), // Will be enriched if needed
        publishedAt: new Date().toISOString(),
      });
    }

    return articles;
  } catch (error) {
    loggers.api.error({ err: error }, 'DJP news fetch failed');
    return [];
  }
}

/**
 * Fetch tax news from Kontan
 */
export async function fetchKontanNews(): Promise<RawArticle[]> {
  try {
    const response = await fetch('https://www.kontan.co.id/tag/pajak', {
      headers: { 'User-Agent': 'AI-Pajak-NewsBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const articles: RawArticle[] = [];
    const titleMatches = html.matchAll(/<h[12][^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g);

    for (const match of titleMatches) {
      if (articles.length >= 5) break;
      const title = match[2].trim();
      if (title.length < 10) continue;
      articles.push({
        source: 'KONTAN',
        sourceUrl: match[1].startsWith('http') ? match[1] : `https://www.kontan.co.id${match[1]}`,
        title,
        content: title,
        publishedAt: new Date().toISOString(),
      });
    }

    return articles;
  } catch (error) {
    loggers.api.error({ err: error }, 'Kontan news fetch failed');
    return [];
  }
}
