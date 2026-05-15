'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getLandingContent } from '@/data/landing/translations';
import type { SupportedLocale } from '@/data/landing/types';

const SUPPORTED_LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
];

const REQUIRED_LABELS = new Set(['필수', 'Required', 'Wajib', '必填', '必須']);

type PersonaKey = 'personal' | 'corporate';

export default function LandingPage({ locale }: { locale: string }) {
  const router = useRouter();
  const content = getLandingContent(locale);
  const [persona, setPersona] = useState<PersonaKey>('personal');
  const [activeModule, setActiveModule] = useState(0);
  const [activePlan, setActivePlan] = useState('monthly-basic');
  const [activeFaq, setActiveFaq] = useState<number>(0);
  const [activeNav, setActiveNav] = useState('product');

  useEffect(() => {
    const sections = ['product', 'start', 'difference', 'faq'];
    const onScroll = () => {
      let current = 'product';
      sections.forEach((id) => {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 140) current = id;
      });
      setActiveNav(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const personaData = content.personas[persona];
  const moduleData = content.modules[activeModule] ?? content.modules[0];
  const selectedPlan = content.pricing.find((p) => p.id === activePlan) ?? content.pricing[0];
  const loginUrl = `/${locale}/billing`;

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goLogin = () => {
    router.push(loginUrl);
  };

  const onLangChange = (newLocale: string) => {
    router.push(`/${newLocale}`);
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_-10%,rgba(16,185,129,0.08),transparent_34rem)]" />

      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="AI Pajak"
            className="flex items-center"
          >
            <Image src="/logo.png" alt="AI Pajak" width={200} height={72} priority className="h-9 w-auto" />
          </button>
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            {(['product', 'start', 'difference', 'faq'] as const).map((id) => (
              <button
                key={id}
                onClick={() => goTo(id)}
                className={`relative py-2 transition hover:text-slate-950 ${activeNav === id ? 'text-emerald-600' : ''}`}
              >
                {content.nav[id]}
                {activeNav === id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600" />
                )}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => onLangChange(e.target.value)}
              aria-label="Language"
              className="rounded-full border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              onClick={goLogin}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {content.login}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-10 pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-12 lg:pt-20">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black tracking-tight text-slate-600">
                {content.chips}
              </span>
            </div>
            <h1 className="max-w-5xl text-4xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              <span>{content.heroTop}</span>
              <span className="mt-2 block bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                {content.heroMain}
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600">{content.heroDesc}</p>
            <div className="mt-5 flex max-w-2xl flex-wrap gap-2">
              {['PPh 21', 'PPh 23', 'PPh 4(2)', 'PPh 26', 'PPh 25', 'PPN'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={goLogin}
                className="rounded-full bg-emerald-600 px-7 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
              >
                {content.login} →
              </button>
              <button
                onClick={() => goTo('pricing')}
                className="rounded-full border border-slate-200 bg-white px-7 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {content.viewPricing}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="rounded-[1.1rem] border border-slate-100 bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black tracking-tight text-slate-500">
                    Dashboard
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['personal', 'corporate'] as PersonaKey[]).map((key) => {
                    const item = content.personas[key];
                    const active = persona === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPersona(key)}
                        className={`rounded-xl border p-4 text-left transition ${
                          active
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-2xl">{item.icon}</p>
                        <p className="mt-2 font-black">{item.label}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-3xl">{personaData.icon}</p>
                      <h3 className="mt-3 text-xl font-black text-slate-950">{personaData.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{personaData.subtitle}</p>
                    </div>
                    <div className="min-w-[88px] rounded-2xl bg-slate-950 p-4 text-center text-white">
                      <p className="text-xs text-slate-300">{content.readiness}</p>
                      <p className="mt-1 text-3xl font-black">{personaData.readiness}%</p>
                    </div>
                  </div>
                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${personaData.readiness}%` }}
                    />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-amber-50 p-4">
                      <p className="text-xs font-black text-amber-700">{content.missing}</p>
                      <ul className="mt-2 space-y-1 text-sm font-bold text-slate-700">
                        {personaData.missing.map((m) => (
                          <li key={m}>• {m}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-black text-emerald-700">{content.next}</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{personaData.next}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-14 lg:px-8">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {content.cards.map(([title, desc]) => (
                <div key={title} className="rounded-2xl bg-slate-50 p-5">
                  <p className="font-black text-slate-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 lg:p-6">
              <div className="grid gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white">
                  🔒
                </div>
                <div>
                  <p className="text-base font-black text-slate-950">{content.trustTitle}</p>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{content.trustDesc}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
                  {content.trustItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white px-3 py-2 text-[11px] font-black leading-none text-emerald-700 shadow-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-7 text-white">
              <span className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-black tracking-tight text-emerald-200">
                {content.coreDiff}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{content.taxTitle}</h2>
              <p className="mt-4 text-base leading-7 text-slate-300">{content.taxDesc}</p>
              <div className="mt-6 rounded-2xl bg-white p-4 text-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-slate-500">AI Code Decision Example</p>
                    <p className="mt-1 text-lg font-black">PPh 23 · Jasa Teknik</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    411124-104
                  </span>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {content.taxCards.map(([title, desc]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-black text-emerald-300">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-7">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black tracking-tight text-emerald-700">
                {content.advisoryKicker}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {content.advisoryTitle}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-700">{content.advisoryDesc}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {content.advisoryCards.map(([title, desc]) => (
                  <div key={title} className="rounded-2xl border border-emerald-100 bg-white p-4">
                    <p className="font-black text-slate-950">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black tracking-tight text-emerald-700">
              {content.serviceFlow}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {content.productTitle}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">{content.productDesc}</p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="grid gap-2 self-start rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
              {content.modules.map((m, i) => {
                const on = activeModule === i;
                return (
                  <button
                    key={m.mark}
                    onClick={() => setActiveModule(i)}
                    className={`flex gap-4 rounded-2xl p-4 text-left transition ${
                      on ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        on ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {m.mark}
                    </span>
                    <span>
                      <span className="block font-black text-slate-950">{m.title}</span>
                      <span className="mt-1 block text-sm leading-5 text-slate-500">{m.short}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="grid gap-6 border-b border-slate-100 pb-6 lg:grid-cols-[1fr_210px] lg:items-start">
                <div>
                  <p className="text-sm font-black text-emerald-600">
                    {content.moduleStep} · {moduleData.mark}
                  </p>
                  <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    {moduleData.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">{moduleData.detail}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-xs font-black text-emerald-700">{moduleData.primaryLabel}</p>
                  <p className="mt-2 text-2xl font-black text-emerald-700">{moduleData.primaryMetric}</p>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-600">{moduleData.statusText}</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-black text-emerald-600">{content.coreGuide}</p>
                <p className="mt-2 text-base font-bold leading-7 text-slate-800">{moduleData.customerPromise}</p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {moduleData.previewCards.map(([title, desc]) => (
                  <div key={title} className="rounded-2xl bg-slate-50 p-5">
                    <p className="font-black text-slate-950">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <p className="text-xs font-black text-slate-500">{content.customerView}</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {moduleData.customerView.map((item) => (
                      <li key={item}>✓ {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <p className="text-xs font-black text-slate-500">{content.outputs}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {moduleData.outputs.map((o) => (
                      <span key={o} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-600">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {moduleData.process.map(([no, title, desc]) => (
                  <div key={no} className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-xs font-black text-emerald-600">{no}</p>
                    <h4 className="mt-2 font-black text-slate-950">{title}</h4>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{desc}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => goTo('start')}
                className="mt-7 rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
              >
                {content.requiredDocs} →
              </button>
            </div>
          </div>
        </section>

        <section id="start" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black tracking-tight text-emerald-700">
                {content.startKicker}
              </span>
              <h2 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                {content.startTitle}
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">{content.startDesc}</p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setPersona('personal')}
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    persona === 'personal'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-slate-200 bg-white text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  {content.personalBtn}
                </button>
                <button
                  onClick={() => setPersona('corporate')}
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    persona === 'corporate'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-slate-200 bg-white text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  {content.corporateBtn}
                </button>
              </div>
              <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5">
                <h3 className="text-xl font-black text-slate-950">{content.methodTitle}</h3>
                <div className="mt-4 grid gap-3">
                  {content.methods.map((m, i) => (
                    <div key={m} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                        {i + 1}
                      </span>
                      <span className="font-bold text-slate-700">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-emerald-600">{personaData.label}</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">{content.requiredDocs}</h3>
                </div>
                <div className="text-4xl">{personaData.icon}</div>
              </div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
                {content.requirements[persona].map(([status, item], idx, arr) => {
                  const required = REQUIRED_LABELS.has(status);
                  return (
                    <div
                      key={`${status}-${item}`}
                      className={`grid grid-cols-[90px_1fr] ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div
                        className={`p-4 text-xs font-black ${
                          required ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        {status}
                      </div>
                      <div className="p-4 text-sm font-bold leading-6 text-slate-700">{item}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 rounded-3xl bg-emerald-50 p-5">
                <p className="text-sm font-black text-emerald-700">{content.guide}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{content.startNote}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="difference" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black tracking-tight text-emerald-700">
              {content.compKicker}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {content.compTitle}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">{content.compDesc}</p>
          </div>
          <div className="mt-6 flex justify-end text-xs font-black text-slate-400 sm:hidden">Swipe table →</div>
          <div className="relative mt-4 overflow-x-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/5 sm:mt-12">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-4 bg-slate-950 text-sm font-black text-white">
                {content.columns.map((c, i) => (
                  <div key={c} className={`p-4 ${i === 3 ? 'text-emerald-300' : ''}`}>
                    {c}
                  </div>
                ))}
              </div>
              {content.rows.map((row, rIdx) => (
                <div key={`row-${rIdx}`} className="grid grid-cols-4 border-t border-slate-100 text-sm">
                  <div className="p-4 font-black text-slate-950">{row[0]}</div>
                  <div className="p-4 leading-6 text-slate-500">{row[1]}</div>
                  <div className="p-4 leading-6 text-slate-500">{row[2]}</div>
                  <div className="bg-emerald-50/70 p-4 font-bold leading-6 text-emerald-800">{row[3]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black tracking-tight text-emerald-700">
              {content.pricingKicker}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {content.pricingTitle}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">{content.pricingDesc}</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/5">
              <div className="mb-5">
                <p className="text-sm font-black text-emerald-700">{content.pricingListTitle}</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">{content.chooseService}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{content.pricingListDesc}</p>
              </div>
              <div>
                {content.groups.map((group) => (
                  <div key={group} className="mb-5 last:mb-0">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{group}</p>
                      <span className="ml-3 h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="grid gap-2">
                      {content.pricing
                        .filter((p) => p.group === group)
                        .map((plan) => {
                          const on = activePlan === plan.id;
                          return (
                            <button
                              key={plan.id}
                              onClick={() => setActivePlan(plan.id)}
                              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                                on
                                  ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-900/5 ring-2 ring-emerald-100'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-black text-slate-950">{plan.typeLabel}</p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">{plan.description}</p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                                    on ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {plan.badge}
                                </span>
                              </div>
                              <p className="mt-3 text-xl font-black text-emerald-700">{plan.price}</p>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-7 text-white shadow-2xl shadow-slate-900/10">
              <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-emerald-300">{content.selectedPlan}</p>
                  <h3 className="mt-3 text-4xl font-black tracking-tight">{selectedPlan.typeLabel}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{selectedPlan.description}</p>
                </div>
                <div className="min-w-[190px] rounded-3xl bg-white p-5 text-right text-slate-950">
                  <p className="text-xs font-black text-slate-500">{selectedPlan.badge}</p>
                  <p className="mt-1 text-3xl font-black text-emerald-600">{selectedPlan.price}</p>
                  {selectedPlan.vat && <p className="mt-1 text-xs font-bold text-slate-500">{selectedPlan.vat}</p>}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {selectedPlan.meta.map((m) => (
                  <span key={m} className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-slate-200">
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div className="rounded-3xl bg-white/5 p-5">
                  <p className="font-black text-emerald-300">{content.included}</p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-200">
                    {selectedPlan.items.map((item) => (
                      <li key={item}>✓ {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl bg-white/5 p-5">
                  <p className="font-black text-emerald-300">{content.criteria}</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {selectedPlan.criteria.map((c) => (
                      <li key={c}>· {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-7 rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                <p className="text-xs font-black text-emerald-300">{content.guide}</p>
                <p className="mt-2 text-sm leading-6 text-slate-100">{content.pricingInfo}</p>
              </div>
              <button
                onClick={() => goTo('start')}
                className="mt-7 rounded-full border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
              >
                {content.pricingButton}
              </button>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[2rem] bg-gradient-to-br from-emerald-600 to-cyan-500 p-8 text-white shadow-2xl shadow-emerald-900/20">
              <h2 className="text-4xl font-black tracking-tight">FAQ</h2>
              <p className="mt-4 leading-7 text-emerald-50">{content.guide}</p>
            </div>
            <div className="space-y-3">
              {content.faqs.map(([q, a], i) => {
                const open = activeFaq === i;
                return (
                  <div
                    key={q}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      onClick={() => setActiveFaq(open ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left font-black text-slate-950"
                    >
                      <span>{q}</span>
                      <span>{open ? '−' : '+'}</span>
                    </button>
                    {open && (
                      <p className="border-t border-slate-100 p-5 text-sm leading-7 text-slate-600">{a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-5 pb-12 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-900/20 lg:p-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-4xl font-black tracking-tight sm:text-5xl">{content.finalTitle}</h2>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{content.finalDesc}</p>
              </div>
              <button
                onClick={goLogin}
                className="rounded-full bg-emerald-600 px-8 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
              >
                {content.finalButton}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-left font-bold hover:text-slate-950"
          >
            © 2026 AI Pajak. Built for upload-based tax automation.
          </button>
          <div className="flex flex-wrap gap-4 font-bold">
            <button onClick={() => goTo('difference')} className="hover:text-slate-950">
              {content.footerCompare}
            </button>
            <button onClick={() => goTo('pricing')} className="hover:text-slate-950">
              {content.footerPricing}
            </button>
            <button onClick={() => goTo('start')} className="hover:text-slate-950">
              {content.footerDocs}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
