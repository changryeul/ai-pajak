import { importPpnWholesaleFile } from '../src/lib/tax/bulk-import/ppn-wholesale-importer';
import * as fs from 'node:fs';

async function main() {
  const filePath = '/Users/winwaysystems/Downloads/ppn_template_Ai Pajak_sample.xlsx';
  const buf = fs.readFileSync(filePath);
  const file = new File([buf], 'sample.xlsx');
  const summary = await importPpnWholesaleFile(file);
  console.log('outImported:', summary.outImported);
  console.log('inImported:', summary.inImported);
  console.log('skippedByValidation:', summary.skippedByValidation);
  console.log('skippedFooters:', summary.skippedFooters);
  console.log('errors count:', summary.errors.length);
  console.log('\nfirst 10 errors:');
  for (const e of summary.errors.slice(0, 10)) {
    console.log(`  R${e.rowNumber} (${e.section}): ${e.reason}`);
  }
  console.log('\noutCsv lines:', summary.outCsv.split('\n').length);
  console.log('inCsv lines:', summary.inCsv.split('\n').length);
}
main().catch(e => { console.error(e); process.exit(1); });
