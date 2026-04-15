import { notFound } from 'next/navigation';
import Link from 'next/link';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

const MANUAL_FILES: Record<string, { file: string; titleKey: string }> = {
  corporate: { file: '01-corporate-customer.md', titleKey: 'corporateManual' },
  external: { file: '02-external-consultant.md', titleKey: 'externalManual' },
  individual: { file: '03-individual-customer.md', titleKey: 'individualManual' },
  operator: { file: '04-tax-operator.md', titleKey: 'operatorManual' },
  jtc: { file: '05-jtc-consultant.md', titleKey: 'jtcManual' },
  admin: { file: '06-platform-admin.md', titleKey: 'adminManual' },
  glossary: { file: 'README.md', titleKey: 'glossary' },
};

export function generateStaticParams() {
  return Object.keys(MANUAL_FILES).map((role) => ({ role }));
}

async function loadManual(role: string): Promise<string | null> {
  const entry = MANUAL_FILES[role];
  if (!entry) return null;
  const filePath = path.join(process.cwd(), 'docs', 'manuals', entry.file);
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export default async function ManualPage({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}) {
  const { locale, role } = await params;
  const entry = MANUAL_FILES[role];
  if (!entry) notFound();

  const t = await getTranslations('manualDetail');
  const content = await loadManual(role);
  if (!content) notFound();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/${locale}/help/manuals`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
      </div>

      <article className="prose prose-slate max-w-none prose-headings:tracking-tight prose-h1:text-3xl prose-h1:font-bold prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-table:text-sm prose-th:bg-gray-50 prose-th:font-semibold prose-td:py-2 prose-td:px-3 prose-blockquote:border-l-4 prose-blockquote:border-blue-200 prose-blockquote:bg-blue-50/50 prose-blockquote:py-2 prose-blockquote:pl-4 prose-blockquote:not-italic prose-blockquote:text-gray-700 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </div>
  );
}
