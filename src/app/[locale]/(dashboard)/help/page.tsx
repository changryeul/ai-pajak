'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  HelpCircle, Search, ChevronDown, ChevronUp,
  FileSpreadsheet, Upload, Lightbulb, ShieldCheck, MessageCircle,
  Calendar, Users, CreditCard, Building2, Sparkles, BookOpen, ArrowRight,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export default function HelpPage() {
  const t = useTranslations('help');
  const params = useParams();
  const locale = params.locale as string;
  const [search, setSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const FAQ_DATA: FAQItem[] = [
    // Getting Started
    { category: t('cat_getting_started'), question: t('faq1_q'), answer: t('faq1_a') },
    { category: t('cat_getting_started'), question: t('faq2_q'), answer: t('faq2_a') },
    { category: t('cat_getting_started'), question: t('faq3_q'), answer: t('faq3_a') },

    // SPT Filing
    { category: t('cat_spt'), question: t('faq4_q'), answer: t('faq4_a') },
    { category: t('cat_spt'), question: t('faq5_q'), answer: t('faq5_a') },
    { category: t('cat_spt'), question: t('faq6_q'), answer: t('faq6_a') },
    { category: t('cat_spt'), question: t('faq7_q'), answer: t('faq7_a') },

    // AI Features
    { category: t('cat_ai'), question: t('faq8_q'), answer: t('faq8_a') },
    { category: t('cat_ai'), question: t('faq9_q'), answer: t('faq9_a') },
    { category: t('cat_ai'), question: t('faq10_q'), answer: t('faq10_a') },
    { category: t('cat_ai'), question: t('faq11_q'), answer: t('faq11_a') },

    // UMKM
    { category: t('cat_umkm'), question: t('faq12_q'), answer: t('faq12_a') },
    { category: t('cat_umkm'), question: t('faq13_q'), answer: t('faq13_a') },
    { category: t('cat_umkm'), question: t('faq14_q'), answer: t('faq14_a') },

    // Consultants
    { category: t('cat_consultant'), question: t('faq15_q'), answer: t('faq15_a') },
    { category: t('cat_consultant'), question: t('faq16_q'), answer: t('faq16_a') },
    { category: t('cat_consultant'), question: t('faq17_q'), answer: t('faq17_a') },

    // Payment
    { category: t('cat_payment'), question: t('faq18_q'), answer: t('faq18_a') },
    { category: t('cat_payment'), question: t('faq19_q'), answer: t('faq19_a') },

    // Technical
    { category: t('cat_technical'), question: t('faq20_q'), answer: t('faq20_a') },
    { category: t('cat_technical'), question: t('faq21_q'), answer: t('faq21_a') },
    { category: t('cat_technical'), question: t('faq22_q'), answer: t('faq22_a') },
  ];

  const CATEGORIES = [...new Set(FAQ_DATA.map(f => f.category))];

  const categoryIcons: Record<string, typeof HelpCircle> = {
    [t('cat_getting_started')]: Sparkles,
    [t('cat_spt')]: FileSpreadsheet,
    [t('cat_ai')]: Lightbulb,
    [t('cat_umkm')]: Building2,
    [t('cat_consultant')]: Users,
    [t('cat_payment')]: CreditCard,
    [t('cat_technical')]: ShieldCheck,
  };

  const GUIDES = [
    { title: t('guide1_title'), desc: t('guide1_desc'), icon: Sparkles, href: '/dashboard', gradient: 'from-blue-500 to-indigo-600' },
    { title: t('guide2_title'), desc: t('guide2_desc'), icon: Upload, href: '/documents', gradient: 'from-purple-500 to-violet-600' },
    { title: t('guide3_title'), desc: t('guide3_desc'), icon: FileSpreadsheet, href: '/tax/spt-tahunan/1770ss', gradient: 'from-green-500 to-emerald-600' },
    { title: t('guide4_title'), desc: t('guide4_desc'), icon: Lightbulb, href: '/tax/savings', gradient: 'from-amber-500 to-orange-500' },
    { title: t('guide5_title'), desc: t('guide5_desc'), icon: Calendar, href: '/tax/calendar', gradient: 'from-red-500 to-rose-500' },
    { title: t('guide6_title'), desc: t('guide6_desc'), icon: MessageCircle, href: '/dashboard', gradient: 'from-cyan-500 to-blue-500' },
  ];

  const toggle = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const filteredFAQ = FAQ_DATA.filter(f => {
    const matchSearch = !search || f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !activeCategory || f.category === activeCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
          <HelpCircle className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-12 h-12 rounded-xl text-base border-0 shadow-sm bg-white"
        />
      </div>

      {/* User Manuals — Role-based */}
      {!search && !activeCategory && (
        <Link
          href={`/${locale}/help/manuals`}
          className="group block mb-6"
        >
          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 via-blue-50 to-white hover:shadow-md transition-all group-hover:-translate-y-0.5">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base text-gray-900">
                      사용자 매뉴얼 (역할별 상세 가이드)
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">NEW</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    법인 · 개인 · 외부 세무사무소 · JTC 세무사 · 운영팀 · 플랫폼 관리자 — 역할별 시나리오형 매뉴얼
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Quick Guides */}
      {!search && !activeCategory && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {GUIDES.map(g => {
            const Icon = g.icon;
            return (
              <Link key={g.title} href={`/${locale}${g.href}`} className="group rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${g.gradient} shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{g.title}</p>
                    <p className="text-xs text-gray-500">{g.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!activeCategory ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          {t('allCategories')}
        </button>
        {CATEGORIES.map(cat => {
          const Icon = categoryIcons[cat] || HelpCircle;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat}
            </button>
          );
        })}
      </div>

      {/* FAQ List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 divide-y">
          {filteredFAQ.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('noResults')}</p>
            </div>
          ) : (
            filteredFAQ.map((faq, i) => {
              const isExpanded = expandedItems.has(i);
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{faq.category}</span>
                      </div>
                      <p className="font-medium text-sm text-gray-900">{faq.question}</p>
                      {isExpanded && (
                        <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{faq.answer}</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />}
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Still need help */}
      <Card className="mt-6 border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900">{t('stillNeedHelp')}</h3>
          <p className="text-sm text-gray-600 mt-1">{t('contactSupport')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
