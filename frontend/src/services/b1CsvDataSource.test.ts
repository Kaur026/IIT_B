import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  B1_CHILD_HEADERS,
  B1_SOURCE_UNAVAILABLE_MESSAGE,
  B1CsvUnauthorizedError,
  b1CsvDataSource,
  createB1CsvDataSource,
  filterB1Children,
  parseB1ChildrenCsv,
  parseCsvRecords,
} from './b1CsvDataSource.ts';
import { MockDemoDataSource } from './mockDemoDataSource.ts';

const sourceCsv = readFileSync(fileURLToPath(new URL('../../../B1/children.csv', import.meta.url)), 'utf8');

test('B1 parser accepts the exact source schema and all 1,000 unique IDs', () => {
  const rows = parseB1ChildrenCsv(sourceCsv);
  assert.equal(B1_CHILD_HEADERS.length, 19);
  assert.equal(rows.length, 1000);
  assert.equal(new Set(rows.map((row) => row.child_id)).size, 1000);
  assert.equal(rows[0].child_id, 'C0001');
  assert.equal(rows.at(-1)?.child_id, 'C1000');
});

test('B1 parser preserves present values, normalizes numeric fields, and retains permitted blanks as null', () => {
  const rows = parseB1ChildrenCsv(sourceCsv);
  const first = rows[0];
  assert.equal(first.sex, 'F');
  assert.equal(first.age_months, 14);
  assert.equal(first.weight_kg, 6.71);
  assert.equal(first.height_cm, 74.0);
  assert.equal(first.measurement_valid, true);
  assert.equal(first.enrolled, true);
  assert.equal(first.oedema, 'no');
  assert.equal(first.assigned_worker_id, 'W07');
  assert.equal(typeof first.measurement_date, 'string');
  assert.ok(rows.some((row) => row.muac_mm === null));
  assert.ok(rows.some((row) => row.weight_kg === null));
  assert.ok(rows.some((row) => row.weight_prev1_kg === null || row.weight_prev2_kg === null));
  assert.ok(rows.some((row) => row.enrolment_date === null || row.last_visit_date === null || row.referral_date === null));
});

test('CSV tokenizer supports escaped quotes, commas, CRLF, and quoted newlines', () => {
  assert.deepEqual(parseCsvRecords('a,b\r\n"value, one","line 1\nline 2 with ""quote"""'), [
    ['a', 'b'], ['value, one', 'line 1\nline 2 with "quote"'],
  ]);
  assert.throws(() => parseCsvRecords('a,"unclosed'), /not closed/);
  assert.throws(() => parseCsvRecords('a,b\n"bad"tail,x'), /after a quoted/);
});

test('B1 validation rejects wrong headers, malformed row widths, invalid values, and duplicate IDs', () => {
  const lines = sourceCsv.trimEnd().split(/\r?\n/);
  const wrongHeader = [...lines];
  wrongHeader[0] = wrongHeader[0].replace('child_id', 'beneficiary_id');
  assert.throws(() => parseB1ChildrenCsv(wrongHeader.join('\n')), /header/);

  const malformedRow = [...lines];
  malformedRow[1] += ',unexpected';
  assert.throws(() => parseB1ChildrenCsv(malformedRow.join('\n')), /expected 19 columns/);

  const invalidNumber = [...lines];
  invalidNumber[1] = invalidNumber[1].replace(',14,', ',age,');
  assert.throws(() => parseB1ChildrenCsv(invalidNumber.join('\n')), /age_months must be numeric/);

  const duplicateId = [...lines];
  duplicateId[2] = duplicateId[2].replace(/^C0002,/, 'C0001,');
  assert.throws(() => parseB1ChildrenCsv(duplicateId.join('\n')), /duplicate child IDs/);

  assert.throws(() => parseB1ChildrenCsv(lines.slice(0, -1).join('\n')), /exactly 1,000/);
});

test('B1 explorer filters only on fields present in the dataset', () => {
  const rows = parseB1ChildrenCsv(sourceCsv);
  assert.deepEqual(filterB1Children(rows, { search: 'C0001' }).map((row) => row.child_id), ['C0001']);
  assert.ok(filterB1Children(rows, { sex: 'F' }).every((row) => row.sex === 'F'));
  assert.ok(filterB1Children(rows, { referralStatus: 'issued' }).every((row) => row.referral_status === 'issued'));
  assert.ok(filterB1Children(rows, { taskStatus: 'new', enrolled: true }).every((row) => row.task_status === 'new' && row.enrolled));
});

test('B1 browser source is explicitly unavailable and does not fall back to mock, storage, or B2', async () => {
  let storageReads = 0;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { storageReads += 1; return null; } });
  try {
    const result = await b1CsvDataSource.loadChildren();
    assert.equal(result.status, 'unavailable');
    if (result.status === 'unavailable') assert.equal(result.message, B1_SOURCE_UNAVAILABLE_MESSAGE);
    assert.equal(storageReads, 0);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('future authenticated B1 transport reports ready data only after strict validation and reports load failures safely', async () => {
  const ready = await createB1CsvDataSource(async () => sourceCsv).loadChildren();
  assert.equal(ready.status, 'ready');
  if (ready.status === 'ready') assert.equal(ready.rows.length, 1000);

  const loadFailure = await createB1CsvDataSource(async () => { throw new Error('private transport detail'); }).loadChildren();
  assert.equal(loadFailure.status, 'error');
  if (loadFailure.status === 'error') {
    assert.match(loadFailure.message, /could not be reached/);
    assert.doesNotMatch(loadFailure.message, /private transport detail/);
  }

  const malformed = await createB1CsvDataSource(async () => 'wrong,header\n').loadChildren();
  assert.equal(malformed.status, 'error');
  if (malformed.status === 'error') assert.match(malformed.message, /malformed or unexpected/);

  const unauthorized = await createB1CsvDataSource(async () => { throw new B1CsvUnauthorizedError(); }).loadChildren();
  assert.equal(unauthorized.status, 'unauthorized');
  if (unauthorized.status === 'unauthorized') assert.match(unauthorized.message, /did not authorize/);
});

test('mock demo data source rejects access outside demo mode without touching its store', () => {
  let reads = 0;
  const source = new MockDemoDataSource({ getBeneficiaries: () => { reads += 1; return []; } }, { DEV: false });
  assert.throws(() => source.listBeneficiaries(), /mock demo is disabled/);
  assert.equal(reads, 0);
  assert.equal(source.source, 'mock-demo');
});

test('mock demo data source returns only its own store when demo mode is explicitly enabled', () => {
  let reads = 0;
  const source = new MockDemoDataSource({ getBeneficiaries: () => { reads += 1; return []; } }, { DEV: false, VITE_ENABLE_DEMO_MODE: 'true' });
  assert.deepEqual(source.listBeneficiaries(), []);
  assert.equal(reads, 1);
});

test('B1 source exploration is not connected to the active mock application', () => {
  const page = readFileSync(fileURLToPath(new URL('../pages/B1ChildExplorerPage.tsx', import.meta.url)), 'utf8');
  const source = readFileSync(fileURLToPath(new URL('./b1CsvDataSource.ts', import.meta.url)), 'utf8');
  const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
  const beneficiaries = readFileSync(fileURLToPath(new URL('../pages/BeneficiaryListPage.tsx', import.meta.url)), 'utf8');
  assert.match(page, /B1 Synthetic Screening Dataset/);
  assert.doesNotMatch(page, /import[^\n]*(mockStore|localStorage|b2Api)|(?:mockStore|localStorage)\.|createB2ApiClient|recordFirstMeasurement|applyTaskAction|createReferral/);
  assert.doesNotMatch(page, /to=\{`\/beneficiaries\/\$\{/);
  assert.doesNotMatch(source, /mockStore|localStorage|fetch\(/);
  for (const state of ['loading', 'ready', 'empty', 'error', 'unavailable', 'unauthorized']) assert.ok(page.includes(`status === '${state}'`), `Missing ${state} page state`);
  assert.doesNotMatch(app, /B1ChildExplorerPage|\/b1-explorer/);
  assert.doesNotMatch(beneficiaries, /B1ChildExplorerPage|\/b1-explorer|b1CsvDataSource/);
});

test('overview dashboard and beneficiary list are mock-store-only and omit the prepared overview', () => {
  const dashboard = readFileSync(fileURLToPath(new URL('../pages/DashboardPage.tsx', import.meta.url)), 'utf8');
  const mockDashboard = readFileSync(fileURLToPath(new URL('../pages/MockDashboardView.tsx', import.meta.url)), 'utf8');
  const beneficiaries = readFileSync(fileURLToPath(new URL('../pages/BeneficiaryListPage.tsx', import.meta.url)), 'utf8');
  assert.match(dashboard, /MockDashboardView as DashboardPage/);
  assert.match(mockDashboard, /mockStore\.getMetrics/);
  assert.match(beneficiaries, /mockStore\.getBeneficiaries/);
  assert.doesNotMatch(dashboard + mockDashboard + beneficiaries, /PreparedDatasetSummaryCard|Prepared Data Overview|getPreparedDatasetSummary/);
});
