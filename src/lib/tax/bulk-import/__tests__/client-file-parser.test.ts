/**
 * Unit tests for client-file-parser.
 *
 * Focus on the cell-cleaning regressions surfaced by the BINTANG JAYA real
 * file (2026-05-30):
 *   1. Date cells → ISO yyyy-mm-dd (was: locale-dependent M/D/YY → silent
 *      month/day swap when parseIndoDate interpreted them as D/M/Y).
 *   2. Number cells with float-precision artifacts → Math.round (was:
 *      3242750 round-tripped to 3242750.0000000005, then parseAmount stripped
 *      the dot and produced 32 quintillion).
 *   3. String cells → trim + strip surrounding quotes (preserved behavior).
 *   4. null/undefined → '' (preserved behavior).
 */

import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import { parseTabularFile, findBestHeaderRow, rowsToCsv } from '../client-file-parser';

// jsdom's File implementation lacks .arrayBuffer()/.text() in our vitest env,
// so we build a minimal File-like shim that the parser will accept.
function makeXlsxFile(aoa: unknown[][], name = 'test.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  // xlsx writes a Node Buffer with type:'buffer'; copy into a fresh Uint8Array
  // so its .buffer is a clean ArrayBuffer that XLSX.read(type:'array') groks.
  const nodeBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const u8 = Uint8Array.from(nodeBuf);
  return {
    name,
    arrayBuffer: async () => u8.buffer as ArrayBuffer,
    text: async () => '',
  } as unknown as File;
}

function makeCsvFile(csv: string, name = 'test.csv'): File {
  return {
    name,
    arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
    text: async () => csv,
  } as unknown as File;
}

describe('parseTabularFile / cleanCell', () => {
  it('Date cells emit ISO yyyy-mm-dd (no locale-dependent M/D vs D/M ambiguity)', async () => {
    const file = makeXlsxFile([
      ['name', 'invoice_date'],
      ['vendor A', new Date(2026, 0, 11)], // Jan 11 2026 — would be 1/11/26 in US, 11/1/26 in EU
      ['vendor B', new Date(2026, 11, 31)], // Dec 31 2026
    ]);
    const parsed = await parseTabularFile(file);
    expect(parsed.headers).toEqual(['name', 'invoice_date']);
    expect(parsed.dataRows[0][1]).toBe('2026-01-11');
    expect(parsed.dataRows[1][1]).toBe('2026-12-31');
  });

  it('number cells round Excel float-precision artifacts to integers', async () => {
    // 3242750 round-trips through Excel float as 3242750.0000000005 — without
    // Math.round, parseAmount's "." strip turned this into 32_427_500_000_000_004.
    const file = makeXlsxFile([
      ['name', 'amount'],
      ['integer', 3242750],
      ['float artifact', 3242750.0000000005],
      ['real decimal', 1234.99],
      ['zero', 0],
      ['large', 50000000000],
    ]);
    const parsed = await parseTabularFile(file);
    expect(parsed.dataRows[0][1]).toBe('3242750');
    expect(parsed.dataRows[1][1]).toBe('3242750');  // artifact rounded away
    expect(parsed.dataRows[2][1]).toBe('1235');     // 1234.99 → 1235 (IDR integer)
    expect(parsed.dataRows[3][1]).toBe('0');
    expect(parsed.dataRows[4][1]).toBe('50000000000');
  });

  it('string cells are trimmed and stripped of surrounding quotes', async () => {
    const file = makeXlsxFile([
      ['name', 'note'],
      ['  PT ABC  ', `"hello world"`],
      [`'single quotes'`, 'plain'],
    ]);
    const parsed = await parseTabularFile(file);
    expect(parsed.dataRows[0][0]).toBe('PT ABC');
    expect(parsed.dataRows[0][1]).toBe('hello world');
    expect(parsed.dataRows[1][0]).toBe('single quotes');
  });

  it('empty / null cells become empty strings (not "null" or undefined)', async () => {
    const file = makeXlsxFile([
      ['a', 'b', 'c'],
      ['x', null, 'z'],
      [null, '', undefined as unknown],
    ]);
    const parsed = await parseTabularFile(file);
    expect(parsed.dataRows[0]).toEqual(['x', '', 'z']);
    // Fully-empty rows are filtered by parseTabularFile; this second row has
    // only blanks → dropped. Verify by checking total data row count.
    expect(parsed.dataRows.length).toBe(1);
  });

  it('throws on empty file', async () => {
    const file = makeXlsxFile([]);
    await expect(parseTabularFile(file)).rejects.toThrow(/no.*sheets|no data rows/i);
  });

  it('parses CSV without xlsx (BOM stripped, comma split, trimming)', async () => {
    const csv = '﻿name,amount\nPT ABC,1000\n  vendor  ,  2000  \n';
    const file = makeCsvFile(csv);
    const parsed = await parseTabularFile(file);
    expect(parsed.headers).toEqual(['name', 'amount']);
    expect(parsed.dataRows).toEqual([
      ['PT ABC', '1000'],
      ['vendor', '2000'],
    ]);
  });
});

describe('findBestHeaderRow', () => {
  it('returns 0 when no row scores ≥2 hints', () => {
    const rows = [
      ['random', 'stuff'],
      ['more', 'random'],
    ];
    const hints = [/^name/i, /^amount/i];
    expect(findBestHeaderRow(rows, hints)).toBe(0);
  });

  it('finds header row past meta rows (lookahead 5 default)', () => {
    const rows = [
      ['YEAR', '2026'],
      ['CUSTOMER', 'PT ABC'],
      ['', ''],
      ['name', 'amount', 'date'],
      ['vendor A', '1000', '2026-01-11'],
    ];
    const hints = [/^name/i, /^amount/i, /^date/i];
    expect(findBestHeaderRow(rows, hints)).toBe(3);
  });

  it('respects custom lookahead', () => {
    const rows = Array.from({ length: 8 }, (_, i) => i === 6 ? ['name', 'amount'] : ['meta', String(i)]);
    const hints = [/^name/i, /^amount/i];
    expect(findBestHeaderRow(rows, hints, 5)).toBe(0); // lookahead too short
    expect(findBestHeaderRow(rows, hints, 8)).toBe(6); // wider lookahead finds it
  });
});

describe('rowsToCsv', () => {
  it('emits header + comma-joined rows', () => {
    const csv = rowsToCsv(['a', 'b'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('a,b\n1,2\n3,4');
  });

  it('quotes cells containing comma / quote / newline (RFC 4180)', () => {
    const csv = rowsToCsv(
      ['name', 'note'],
      [
        ['PT ABC', 'has, comma'],
        ['quoted "thing"', 'plain'],
      ],
    );
    // Pattern: "has, comma" → enclosed in quotes; "quoted ""thing""" → escaped quotes
    expect(csv).toContain('"has, comma"');
    expect(csv).toContain('"quoted ""thing"""');
  });
});
