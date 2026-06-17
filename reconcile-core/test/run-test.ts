import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { reconcile, ReconciliationConfig, ReconciliationResult } from '../src/index';
import { exportToCsv } from '../src/export/csvExport';

const SAMPLE_DIR = path.join(__dirname, 'sample-data');

const defaultConfig: ReconciliationConfig = {
  dateToleranceDays: 3,
  amountTolerance: { type: 'absolute', value: 5 },
  nameMatchMode: 'fuzzy',
};

function printResult(label: string, result: ReconciliationResult): void {
  console.log(`\n=== ${label} Results ===`);
  console.log(`Match rate:   ${result.summary.matchRate}%`);
  console.log(`Matched:      ${result.summary.matched}`);
  console.log(`Partial:      ${result.summary.partial}`);
  console.log(`Exceptions:   ${result.summary.exceptions}`);
  console.log(`Narrative:    ${result.summary.narrative}`);

  const exceptions = result.rows.filter((r) => r.status === 'EXCEPTION');
  if (exceptions.length > 0) {
    console.log('\nFirst 3 exception notes:');
    exceptions.slice(0, 3).forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.identifier}: ${r.note}`);
    });
  }

  console.log('\nFirst 3 row details:');
  result.rows.slice(0, 3).forEach((r, i) => {
    console.log(
      `  [${i + 1}] ${r.identifier} | status=${r.status} | amountA=${r.amountA} | amountB=${r.amountB} | diff=${r.difference} | confidence=${r.confidence.toFixed(2)}`
    );
  });

  const csv = exportToCsv(result);
  const csvLines = csv.split('\n').length;
  console.log(`\nCSV export: ${csvLines} line(s) (including header)`);
}

async function main(): Promise<void> {
  console.log('ReconcileAI Core Engine — Test Runner');
  console.log('======================================');

  // --- Clean pair ---
  const setAClean = fs.readFileSync(path.join(SAMPLE_DIR, 'setA-clean.csv'), 'utf-8');
  const setBClean = fs.readFileSync(path.join(SAMPLE_DIR, 'setB-clean.csv'), 'utf-8');

  console.log('\nRunning reconciliation on CLEAN pair...');
  const cleanResult = await reconcile(setAClean, setBClean, defaultConfig);
  printResult('Clean Pair', cleanResult);

  // --- Messy pair ---
  const setAMessy = fs.readFileSync(path.join(SAMPLE_DIR, 'setA-messy.txt'), 'utf-8');
  const setBMessy = fs.readFileSync(path.join(SAMPLE_DIR, 'setB-messy.txt'), 'utf-8');

  console.log('\nRunning reconciliation on MESSY pair...');
  const messyResult = await reconcile(setAMessy, setBMessy, defaultConfig);
  printResult('Messy Pair', messyResult);

  console.log('\n======================================');
  console.log('All tests completed successfully.');
}

main().catch((err: unknown) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
