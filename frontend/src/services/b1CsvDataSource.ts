/**
 * Contract and parser for the frozen B1 screening CSV.
 *
 * The browser implementation intentionally does not fetch or embed the CSV:
 * B2 has no authorized route for it and the source must remain private. The
 * parser is used by repository tests and can be reused after an approved
 * authenticated transport is implemented.
 */

export const B1_CHILD_HEADERS = [
  'child_id', 'sex', 'age_months', 'measurement_date', 'weight_kg', 'height_cm',
  'muac_mm', 'oedema', 'measurement_valid', 'referral_status',
  'assigned_worker_id', 'task_status', 'enrolled', 'enrolment_date',
  'last_visit_date', 'referral_date', 'danger_sign', 'weight_prev1_kg',
  'weight_prev2_kg',
] as const;

export type B1YesNo = 'yes' | 'no';
export type B1ReferralStatus = 'attended' | 'issued' | 'none' | 'outcome_logged';
export type B1TaskStatus = 'new' | 'none';

/** Normalized, typed view of one source row. Empty permitted CSV cells are null. */
export interface B1ChildRow {
  child_id: string;
  sex: 'M' | 'F';
  age_months: number;
  measurement_date: string;
  weight_kg: number | null;
  height_cm: number;
  muac_mm: number | null;
  oedema: B1YesNo;
  measurement_valid: boolean;
  referral_status: B1ReferralStatus;
  assigned_worker_id: string;
  task_status: B1TaskStatus;
  enrolled: boolean;
  enrolment_date: string | null;
  last_visit_date: string | null;
  referral_date: string | null;
  danger_sign: boolean;
  weight_prev1_kg: number | null;
  weight_prev2_kg: number | null;
}

export type B1ChildLoadResult =
  | { status: 'loading'; source: 'b1-csv' }
  | { status: 'ready'; source: 'b1-csv'; rows: B1ChildRow[] }
  | { status: 'empty'; source: 'b1-csv'; rows: [] }
  | { status: 'unavailable'; source: 'b1-csv'; message: string }
  | { status: 'unauthorized'; source: 'b1-csv'; message: string }
  | { status: 'error'; source: 'b1-csv'; message: string };

export interface B1CsvDataSource {
  loadChildren(): Promise<B1ChildLoadResult>;
}

export class B1CsvUnauthorizedError extends Error {
  constructor() {
    super('The B1 source denied this request.');
    this.name = 'B1CsvUnauthorizedError';
  }
}

/** Adapter factory for a future approved, authenticated transport. Not wired to any current URL. */
export function createB1CsvDataSource(loadCsv: () => Promise<string>): B1CsvDataSource {
  return {
    async loadChildren() {
      let csv: string;
      try {
        csv = await loadCsv();
      } catch (error) {
        if (error instanceof B1CsvUnauthorizedError) {
          return {
            status: 'unauthorized',
            source: 'b1-csv',
            message: 'The authenticated B1 source did not authorize access. No other data source was substituted.',
          };
        }
        return {
          status: 'error',
          source: 'b1-csv',
          message: 'The authorized B1 source could not be reached. No other data source was substituted.',
        };
      }
      try {
        const rows = parseB1ChildrenCsv(csv);
        return rows.length > 0
          ? { status: 'ready', source: 'b1-csv', rows }
          : { status: 'empty', source: 'b1-csv', rows: [] };
      } catch {
        return {
          status: 'error',
          source: 'b1-csv',
          message: 'The authorized B1 source returned malformed or unexpected data. No other data source was substituted.',
        };
      }
    },
  };
}

export const B1_SOURCE_UNAVAILABLE_MESSAGE =
  'The B1 CSV is kept outside the frontend. B2 does not yet provide an authenticated, centre/worker-authorized endpoint for this dataset.';

/** Default browser source. It deliberately performs no network or local-data fallback. */
export const b1CsvDataSource: B1CsvDataSource = {
  async loadChildren() {
    return {
      status: 'unavailable',
      source: 'b1-csv',
      message: B1_SOURCE_UNAVAILABLE_MESSAGE,
    };
  },
};

export interface B1ChildFilters {
  search?: string;
  sex?: B1ChildRow['sex'] | '';
  referralStatus?: B1ReferralStatus | '';
  taskStatus?: B1TaskStatus | '';
  enrolled?: boolean | '';
}

/** Search and filter only fields present in B1/children.csv. */
export function filterB1Children(rows: readonly B1ChildRow[], filters: B1ChildFilters): B1ChildRow[] {
  const query = filters.search?.trim().toLowerCase() || '';
  return rows.filter((row) => {
    if (filters.sex && row.sex !== filters.sex) return false;
    if (filters.referralStatus && row.referral_status !== filters.referralStatus) return false;
    if (filters.taskStatus && row.task_status !== filters.taskStatus) return false;
    if (filters.enrolled !== '' && filters.enrolled !== undefined && row.enrolled !== filters.enrolled) return false;
    if (!query) return true;
    return [row.child_id, row.sex, row.assigned_worker_id, row.referral_status, row.task_status]
      .some((field) => field.toLowerCase().includes(query));
  });
}

/** Parse RFC 4180-style quoted fields, including escaped quotes and embedded newlines. */
export function parseCsvRecords(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0 || closedQuote) throw new Error(`Malformed CSV quote at character ${index + 1}.`);
      quoted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
      closedQuote = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      closedQuote = false;
    } else {
      if (closedQuote) throw new Error(`Unexpected character after a quoted CSV field at character ${index + 1}.`);
      field += char;
    }
  }

  if (quoted) throw new Error('Malformed CSV: a quoted field is not closed.');
  if (field.length > 0 || record.length > 0 || closedQuote) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function parseNumber(value: string, column: string, rowNumber: number, optional = false): number | null {
  if (value === '' && optional) return null;
  if (!value.trim()) throw new Error(`Row ${rowNumber}: ${column} cannot be blank.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Row ${rowNumber}: ${column} must be numeric.`);
  return parsed;
}

function parseYesNo(value: string, column: string, rowNumber: number): B1YesNo {
  if (value !== 'yes' && value !== 'no') throw new Error(`Row ${rowNumber}: ${column} must be "yes" or "no".`);
  return value;
}

function parseBoolean(value: string, column: string, rowNumber: number, yesNo = false): boolean {
  if (yesNo) {
    if (value === 'yes') return true;
    if (value === 'no') return false;
  } else {
    if (value === 'True') return true;
    if (value === 'False') return false;
  }
  throw new Error(`Row ${rowNumber}: ${column} has an unexpected boolean value.`);
}

function parseDate(value: string, column: string, rowNumber: number, optional = false): string | null {
  if (!value && optional) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Row ${rowNumber}: ${column} must be YYYY-MM-DD${optional ? ' or blank' : ''}.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Row ${rowNumber}: ${column} is not a valid calendar date.`);
  }
  return value;
}

function parseRow(cells: string[], rowNumber: number): B1ChildRow {
  if (cells.length !== B1_CHILD_HEADERS.length) {
    throw new Error(`Row ${rowNumber}: expected ${B1_CHILD_HEADERS.length} columns, received ${cells.length}.`);
  }
  const row = Object.fromEntries(B1_CHILD_HEADERS.map((header, index) => [header, cells[index]])) as Record<string, string>;
  if (!/^C\d{4}$/.test(row.child_id)) throw new Error(`Row ${rowNumber}: child_id must use the C0001–C1000 source identifier format.`);
  if (row.sex !== 'M' && row.sex !== 'F') throw new Error(`Row ${rowNumber}: sex must be "M" or "F".`);
  if (!/^W\d{2}$/.test(row.assigned_worker_id)) throw new Error(`Row ${rowNumber}: assigned_worker_id must use the source W## format.`);
  if (!(['attended', 'issued', 'none', 'outcome_logged'] as string[]).includes(row.referral_status)) {
    throw new Error(`Row ${rowNumber}: referral_status is not a recognized B1 status.`);
  }
  if (!(['new', 'none'] as string[]).includes(row.task_status)) {
    throw new Error(`Row ${rowNumber}: task_status is not a recognized B1 status.`);
  }

  const ageMonths = parseNumber(row.age_months, 'age_months', rowNumber) as number;
  const muac = parseNumber(row.muac_mm, 'muac_mm', rowNumber, true);
  const weight = parseNumber(row.weight_kg, 'weight_kg', rowNumber, true);
  const height = parseNumber(row.height_cm, 'height_cm', rowNumber) as number;
  const previousWeight1 = parseNumber(row.weight_prev1_kg, 'weight_prev1_kg', rowNumber, true);
  const previousWeight2 = parseNumber(row.weight_prev2_kg, 'weight_prev2_kg', rowNumber, true);
  if (!Number.isInteger(ageMonths) || ageMonths < 0) throw new Error(`Row ${rowNumber}: age_months must be a non-negative integer.`);
  if (!Number.isInteger(muac) && muac !== null) throw new Error(`Row ${rowNumber}: muac_mm must be an integer or blank.`);
  if ((weight !== null && weight <= 0) || height <= 0 || (muac !== null && muac <= 0)
      || (previousWeight1 !== null && previousWeight1 <= 0) || (previousWeight2 !== null && previousWeight2 <= 0)) {
    throw new Error(`Row ${rowNumber}: measurements must be positive numeric values.`);
  }

  const referralStatus = row.referral_status as B1ReferralStatus;
  const taskStatus = row.task_status as B1TaskStatus;
  return {
    child_id: row.child_id,
    sex: row.sex,
    age_months: ageMonths,
    measurement_date: parseDate(row.measurement_date, 'measurement_date', rowNumber) as string,
    weight_kg: weight,
    height_cm: height,
    muac_mm: muac,
    oedema: parseYesNo(row.oedema, 'oedema', rowNumber),
    measurement_valid: parseBoolean(row.measurement_valid, 'measurement_valid', rowNumber),
    referral_status: referralStatus,
    assigned_worker_id: row.assigned_worker_id,
    task_status: taskStatus,
    enrolled: parseBoolean(row.enrolled, 'enrolled', rowNumber, true),
    enrolment_date: parseDate(row.enrolment_date, 'enrolment_date', rowNumber, true),
    last_visit_date: parseDate(row.last_visit_date, 'last_visit_date', rowNumber, true),
    referral_date: parseDate(row.referral_date, 'referral_date', rowNumber, true),
    danger_sign: parseBoolean(row.danger_sign, 'danger_sign', rowNumber, true),
    weight_prev1_kg: previousWeight1,
    weight_prev2_kg: previousWeight2,
  };
}

/** Validate the exact frozen B1 file contract; no IDs or row values are synthesized. */
export function parseB1ChildrenCsv(text: string): B1ChildRow[] {
  const records = parseCsvRecords(text);
  if (records.length === 0) throw new Error('B1 CSV is empty and has no header.');
  if (records[0].length !== B1_CHILD_HEADERS.length
      || records[0].some((header, index) => header !== B1_CHILD_HEADERS[index])) {
    throw new Error('B1 CSV header does not match the expected 19-column child schema.');
  }
  const rows = records.slice(1).map((cells, index) => parseRow(cells, index + 2));
  if (rows.length !== 1000) throw new Error(`B1 CSV must contain exactly 1,000 child rows; received ${rows.length}.`);
  const ids = new Set(rows.map((row) => row.child_id));
  if (ids.size !== rows.length) throw new Error('B1 CSV contains duplicate child IDs.');
  for (let index = 1; index <= 1000; index += 1) {
    const expected = `C${String(index).padStart(4, '0')}`;
    if (!ids.has(expected)) throw new Error(`B1 CSV is missing expected child ID ${expected}.`);
  }
  return rows;
}
