#!/usr/bin/env node
import fs from 'node:fs';

// Skip dashboard (has 5 helper-function returns — needs manual patch).
const targets = [
  { file: 'src/app/[locale]/(dashboard)/filings/page.tsx',    title: 'Pelaporan Pajak' },
  { file: 'src/app/[locale]/(dashboard)/customers/page.tsx',  title: 'Pelanggan' },
  { file: 'src/app/[locale]/(dashboard)/settings/page.tsx',   title: 'Pengaturan' },
  { file: 'src/app/[locale]/(dashboard)/documents/page.tsx',  title: 'Dokumen' },
  { file: 'src/app/[locale]/(dashboard)/reports/page.tsx',    title: 'Laporan' },
  { file: 'src/app/[locale]/(dashboard)/billing/page.tsx',    title: 'Tagihan' },
];

const IMPORT_LINE = `import { PageTitle } from '@/components/layout/PageTitle';`;

for (const t of targets) {
  let src = fs.readFileSync(t.file, 'utf-8');
  if (src.includes('PageTitle')) {
    console.log(`skip (already has PageTitle): ${t.file}`);
    continue;
  }
  const lines = src.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import .+ from /.test(lines[i]) || /^import ['"]/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx === -1) { console.log(`!! no imports: ${t.file}`); continue; }
  lines.splice(lastImportIdx + 1, 0, IMPORT_LINE);

  const patched = lines.join('\n');
  // Match the FIRST top-level main-page return: "  return (" followed by a <div
  // that looks like a page wrapper (container or full-screen).
  // Anchor to lines that match container / p-* / min-h-screen so we avoid helper-component returns.
  const m = patched.match(/(  return \(\s*\n\s*<div[^>]*(?:container|p-\d|min-h-screen|space-y-6|max-w-)[^>]*>)/);
  if (!m) {
    console.log(`!! no matching container return in ${t.file}`);
    continue;
  }
  const insertion = `\n      <PageTitle title="${t.title}" />`;
  fs.writeFileSync(t.file, patched.replace(m[1], m[1] + insertion));
  console.log(`patched: ${t.file} with title="${t.title}"`);
}
