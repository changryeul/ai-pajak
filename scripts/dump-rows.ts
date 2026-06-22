import * as XLSX from 'xlsx';
import * as fs from 'node:fs';

async function main() {
  const filePath = '/Users/winwaysystems/Downloads/ppn_template_Ai Pajak_sample.xlsx';
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false }) as string[][];
  console.log(`Total rows: ${rows.length}`);
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = rows[i];
    const preview = r.map(c => String(c||'').slice(0, 25)).join(' | ');
    console.log(`R${i + 1}: ${preview}`);
  }
}
main();
