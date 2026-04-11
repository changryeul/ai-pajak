import { notFound } from 'next/navigation';
import Link from 'next/link';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-static';

const MANUAL_FILES: Record<string, { file: string; title: string }> = {
  corporate: { file: '01-corporate-customer.md', title: '법인 납세자 매뉴얼' },
  external: { file: '02-external-consultant.md', title: '외부 세무 사무소 매뉴얼' },
  individual: { file: '03-individual-customer.md', title: '개인 납세자 매뉴얼' },
  operator: { file: '04-tax-operator.md', title: '운영팀 매뉴얼' },
  jtc: { file: '05-jtc-consultant.md', title: 'JTC 세무사 매뉴얼' },
  admin: { file: '06-platform-admin.md', title: '플랫폼 관리자 매뉴얼' },
  glossary: { file: 'README.md', title: '매뉴얼 인덱스 · 용어 사전' },
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
          매뉴얼 목록으로
        </Link>
      </div>

      <article className="prose prose-slate max-w-none prose-headings:tracking-tight prose-h1:text-3xl prose-h1:font-bold prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-table:text-sm prose-th:bg-gray-50 prose-th:font-semibold prose-td:py-2 prose-td:px-3 prose-blockquote:border-l-4 prose-blockquote:border-blue-200 prose-blockquote:bg-blue-50/50 prose-blockquote:py-2 prose-blockquote:pl-4 prose-blockquote:not-italic prose-blockquote:text-gray-700 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </div>
  );
}
