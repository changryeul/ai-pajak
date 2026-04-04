'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Newspaper, ExternalLink, Loader2, Filter, AlertTriangle,
  Sparkles, Clock, Tag, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewsArticle {
  id: string;
  source: string;
  source_url: string;
  original_title: string;
  summary_id: string;
  summary_ko: string;
  summary_en: string;
  impact_analysis: string;
  category: string;
  tags: string[];
  regulation_number: string | null;
  importance: string;
  published_at: string;
}

const CATEGORIES = [
  { key: '', label: 'all' },
  { key: 'PPh21', label: 'PPh 21' },
  { key: 'PPh23', label: 'PPh 23' },
  { key: 'PPN', label: 'PPN' },
  { key: 'UMKM', label: 'UMKM' },
  { key: 'REGULATION', label: 'regulation' },
  { key: 'GENERAL', label: 'general' },
];

const IMPORTANCE_STYLES: Record<string, { bg: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-100 text-red-700', label: 'critical' },
  HIGH: { bg: 'bg-orange-100 text-orange-700', label: 'high' },
  NORMAL: { bg: 'bg-blue-100 text-blue-700', label: 'normal' },
  LOW: { bg: 'bg-gray-100 text-gray-500', label: 'low' },
};

const SOURCE_STYLES: Record<string, string> = {
  DJP: 'bg-green-100 text-green-700',
  KONTAN: 'bg-purple-100 text-purple-700',
  BISNIS_INDONESIA: 'bg-blue-100 text-blue-700',
  MANUAL: 'bg-gray-100 text-gray-600',
};

export default function NewsPage() {
  const t = useTranslations('killer');
  const params = useParams();
  const locale = params.locale as string;
  const { session, isLoading: sessionLoading } = useSession();

  // Get localized summary based on current locale
  const getSummary = (article: NewsArticle) => {
    if (locale === 'ko') return article.summary_ko || article.summary_en || article.summary_id;
    if (locale === 'en') return article.summary_en || article.summary_id;
    if (locale === 'ja' || locale === 'zh') return article.summary_en || article.summary_ko || article.summary_id;
    return article.summary_id || article.summary_en; // Indonesian default
  };
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isLoading = sessionLoading || dataLoading;

  const loadNews = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (category) params.set('category', category);
      const res = await fetch(`/api/news?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.success) setArticles(data.data || []);
    } catch (err) { console.error(err); }
    finally { setDataLoading(false); }
  }, [session, category]);

  useEffect(() => { loadNews(); }, [loadNews]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (diffH < 1) return t('news.justNow');
    if (diffH < 24) return t('news.hoursAgo', { count: diffH });
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return t('news.daysAgo', { count: diffD });
    return d.toLocaleDateString();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-blue-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Newspaper className="h-4 w-4" />{t('news.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('news.title')}</h1>
          <p className="text-slate-400 mt-2 text-sm">{t('news.subtitle')}</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              category === cat.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {cat.key || t('news.allCategories')}
          </button>
        ))}
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
      ) : articles.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center text-gray-400">
            <Newspaper className="h-10 w-10 mx-auto mb-3" />
            <p className="text-sm">{t('news.empty')}</p>
            <p className="text-xs mt-1">{t('news.emptyDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map(article => {
            const imp = IMPORTANCE_STYLES[article.importance] || IMPORTANCE_STYLES.NORMAL;
            const isExpanded = expandedId === article.id;

            return (
              <Card key={article.id} className={cn(
                'border-0 shadow-sm transition-all hover:shadow-md',
                article.importance === 'CRITICAL' && 'border-l-4 border-l-red-500',
                article.importance === 'HIGH' && 'border-l-4 border-l-orange-400',
              )}>
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge className={cn('text-[10px]', SOURCE_STYLES[article.source] || 'bg-gray-100')}>
                          {article.source}
                        </Badge>
                        <Badge className={cn('text-[10px]', imp.bg)}>
                          {t(`news.importance${article.importance.charAt(0) + article.importance.slice(1).toLowerCase()}`)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{article.category}</Badge>
                        {article.regulation_number && (
                          <Badge className="text-[10px] bg-yellow-100 text-yellow-700">{article.regulation_number}</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 leading-snug">
                        {article.original_title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />{formatDate(article.published_at)}
                      </p>
                    </div>
                    {article.source_url && (
                      <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500 flex-shrink-0">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="mt-3 bg-blue-50/50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {getSummary(article)}
                    </p>
                  </div>

                  {/* Expand for impact analysis */}
                  {article.impact_analysis && (
                    <>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : article.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 mt-2 hover:text-blue-800"
                      >
                        <Sparkles className="h-3 w-3" />
                        {t('news.impactAnalysis')}
                        <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                      </button>
                      {isExpanded && (
                        <div className="mt-2 p-3 bg-amber-50 rounded-lg text-xs text-gray-700 leading-relaxed">
                          <p className="font-medium text-amber-800 mb-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />{t('news.customerImpact')}
                          </p>
                          {article.impact_analysis}
                        </div>
                      )}
                    </>
                  )}

                  {/* Tags */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Tag className="h-3 w-3 text-gray-300" />
                      {article.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-50 text-gray-400 rounded px-1.5 py-0.5">{tag}</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
