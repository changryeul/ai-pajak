#!/usr/bin/env node
// Scan for broken template literal patterns like `' + t('...') + '` that
// should have been `${t('...')}`.

import fs from 'node:fs';
import path from 'node:path';

const root = 'src';
const suspects = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(p);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      scan(p);
    }
  }
}

function scan(file) {
  const txt = fs.readFileSync(file, 'utf-8');
  const lines = txt.split('\n');
  // Match backtick-delimited single-line template literals containing '+ ' or ' +t(
  // Simpler heuristic: a line containing ` and containing one of:
  //   "' + t("    or    ") + '"    or    "+ t("    (between literal text, not ${})
  lines.forEach((line, i) => {
    if (!line.includes('`')) return;
    // Extract backtick string portion(s)
    const btStart = line.indexOf('`');
    const btEnd = line.lastIndexOf('`');
    if (btStart === -1 || btEnd === -1 || btStart === btEnd) return;
    const inner = line.slice(btStart + 1, btEnd);
    // Suspicious substrings — literal concat leftovers
    const patterns = [
      /'\s*\+\s*t\(/,           // ' + t(
      /\)\s*\+\s*'/,            // ) + '
      /`'\s*\+/,                // `' +
      /\+\s*'\s*`/,             // + '`
    ];
    // Check inner excluding ${...} spans (rough)
    const strippedInner = inner.replace(/\$\{[^}]*\}/g, '');
    if (patterns.some(p => p.test(strippedInner))) {
      suspects.push({ file, line: i + 1, text: line.trim().slice(0, 180) });
    }
  });
}

walk(root);
console.log(`Found ${suspects.length} suspects:\n`);
for (const s of suspects) {
  console.log(`${s.file}:${s.line}`);
  console.log(`  ${s.text}`);
  console.log();
}
