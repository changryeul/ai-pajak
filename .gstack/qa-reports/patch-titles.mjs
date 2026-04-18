#!/usr/bin/env node
import fs from 'node:fs';

const targets = [
  { file: 'src/app/[locale]/(dashboard)/tax/pph21/page.tsx', title: 'PPh 21' },
  { file: 'src/app/[locale]/(dashboard)/tax/pph23/page.tsx', title: 'PPh 23' },
  { file: 'src/app/[locale]/(dashboard)/tax/ppn/page.tsx',   title: 'PPN' },
  { file: 'src/app/[locale]/(dashboard)/tax/umkm/page.tsx',  title: 'UMKM (PPh Final)' },
  { file: 'src/app/[locale]/(dashboard)/tax/pph26/page.tsx', title: 'PPh 26' },
];

const IMPORT_LINE = `import { PageTitle } from '@/components/layout/PageTitle';`;

for (const t of targets) {
  let src = fs.readFileSync(t.file, 'utf-8');
  // Already patched?
  if (src.includes('PageTitle')) {
    console.log(`skip (already has PageTitle): ${t.file}`);
    continue;
  }

  // 1. Add import after the last existing import line
  const lines = src.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import .+ from /.test(lines[i]) || /^import ['"]/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx === -1) {
    console.log(`!! no import line found in ${t.file}, skipping`);
    continue;
  }
  lines.splice(lastImportIdx + 1, 0, IMPORT_LINE);

  // 2. Insert <PageTitle title="..." /> after the first top-level `return (` block's opening <div>
  // Find the first '  return (' and then the line with '<div ' that follows
  const patched = lines.join('\n');
  const m = patched.match(/(  return \(\s*\n\s*<div[^>]*>)/);
  if (!m) {
    console.log(`!! no top-level return( <div found in ${t.file}`);
    continue;
  }
  const insertion = `\n      <PageTitle title="${t.title}" />`;
  const newPatched = patched.replace(m[1], m[1] + insertion);
  fs.writeFileSync(t.file, newPatched);
  console.log(`patched: ${t.file} with title="${t.title}"`);
}
