export interface PreparedBeneficiaryRecord {
  beneficiary_id: string;
  centre_id: string;
  category: 'child' | 'pregnant_woman' | 'lactating_mother';
  sex: 'F' | 'M';
  synthetic_flag: 'SYNTHETIC';
}

export interface PreparedMeasurementRecord {
  measurement_id: string;
  beneficiary_id: string;
  centre_id: string;
  measured_on: string;
  weight_value: string;
  weight_unit: 'g' | 'kg';
  height_value: string;
  height_unit: 'cm' | 'm';
  muac_cm: string;
  is_baseline: '0' | '1';
  synthetic_flag: 'SYNTHETIC';
}

export interface PreparedRecordsPage<T> {
  source: 'B!-PREPARED-SYNTHETIC-DATA';
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export class PreparedRecordsApiError extends Error {
  readonly status?: number;
  readonly accessDenied: boolean;

  constructor(message: string, status?: number, accessDenied = false) {
    super(message);
    this.name = 'PreparedRecordsApiError';
    this.status = status;
    this.accessDenied = accessDenied;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => key in value);
}

const beneficiaryKeys = [
  'beneficiary_id', 'centre_id', 'category', 'sex', 'synthetic_flag',
] as const;
const measurementKeys = [
  'measurement_id', 'beneficiary_id', 'centre_id', 'measured_on', 'weight_value',
  'weight_unit', 'height_value', 'height_unit', 'muac_cm', 'is_baseline', 'synthetic_flag',
] as const;

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

function isIdentifier(value: unknown): value is string {
  return isText(value) && value.length > 0 && value.length <= 128
    && value === value.trim() && !/\s/.test(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseBeneficiary(value: unknown): PreparedBeneficiaryRecord {
  if (!isRecord(value) || !exactKeys(value, beneficiaryKeys)
    || !isIdentifier(value.beneficiary_id)
    || !isIdentifier(value.centre_id)
    || !['child', 'pregnant_woman', 'lactating_mother'].includes(String(value.category))
    || !['F', 'M'].includes(String(value.sex))
    || value.synthetic_flag !== 'SYNTHETIC') {
    throw new PreparedRecordsApiError('Prepared beneficiary response does not match the approved field contract.');
  }
  return value as unknown as PreparedBeneficiaryRecord;
}

function numericOrBlank(value: unknown): value is string {
  return typeof value === 'string' && (value.trim() === '' || (Number.isFinite(Number(value)) && Number(value) > 0));
}

function parseMeasurement(value: unknown): PreparedMeasurementRecord {
  if (!isRecord(value) || !exactKeys(value, measurementKeys)
    || !isIdentifier(value.measurement_id)
    || !isIdentifier(value.beneficiary_id)
    || !isIdentifier(value.centre_id)
    || !isIsoDate(value.measured_on)
    || !numericOrBlank(value.weight_value)
    || !['g', 'kg'].includes(String(value.weight_unit))
    || !numericOrBlank(value.height_value)
    || !['cm', 'm'].includes(String(value.height_unit))
    || typeof value.muac_cm !== 'string' || !Number.isFinite(Number(value.muac_cm)) || Number(value.muac_cm) <= 0
    || !['0', '1'].includes(String(value.is_baseline))
    || value.synthetic_flag !== 'SYNTHETIC') {
    throw new PreparedRecordsApiError('Prepared measurement response does not match the approved field contract.');
  }
  return value as unknown as PreparedMeasurementRecord;
}

function parsePage<T>(value: unknown, expectedLimit: number, expectedOffset: number, parseItem: (item: unknown) => T): PreparedRecordsPage<T> {
  if (!isRecord(value) || !exactKeys(value, ['source', 'items', 'total', 'limit', 'offset'])
    || value.source !== 'B!-PREPARED-SYNTHETIC-DATA'
    || !Array.isArray(value.items)
    || !Number.isSafeInteger(value.total) || Number(value.total) < 0
    || value.limit !== expectedLimit || value.offset !== expectedOffset) {
    throw new PreparedRecordsApiError('Prepared records response is invalid.');
  }
  const items = value.items.map(parseItem);
  const total = Number(value.total);
  const expectedItems = Math.max(0, Math.min(expectedLimit, total - expectedOffset));
  if (items.length !== expectedItems) {
    throw new PreparedRecordsApiError('Prepared records pagination is inconsistent.');
  }
  return { source: value.source, items, total, limit: expectedLimit, offset: expectedOffset };
}

function makeUrl(apiBaseUrl: string | undefined, path: string, params: Record<string, string | number | undefined>): URL {
  const base = apiBaseUrl?.trim();
  if (!base) throw new PreparedRecordsApiError('Protected prepared records are not connected.');
  try {
    const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('Insecure API origin.');
    }
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    return url;
  } catch {
    throw new PreparedRecordsApiError('Prepared records API URL is invalid.');
  }
}

async function requestPage<T>(
  apiBaseUrl: string | undefined,
  accessToken: string | undefined,
  path: string,
  params: Record<string, string | number | undefined>,
  parseItem: (item: unknown) => T,
  fetchImpl: typeof fetch,
): Promise<PreparedRecordsPage<T>> {
  if (!accessToken?.trim()) throw new PreparedRecordsApiError('A signed-in provider session is required.', 401, true);
  const limit = Number(params.limit ?? 25);
  const offset = Number(params.offset ?? 0);
  const url = makeUrl(apiBaseUrl, path, params);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    throw new PreparedRecordsApiError('Prepared records API is unavailable.');
  }
  if (!response.ok) {
    const denied = response.status === 401 || response.status === 403;
    const message = response.status === 404
      ? 'The prepared data, requested identifier, or row-access route is unavailable in this authorized scope.'
      : denied
        ? 'Your account is not authorized for these prepared records.'
        : response.status === 503
          ? 'Prepared records or authorization services are unavailable.'
          : `Prepared records API returned HTTP ${response.status}.`;
    throw new PreparedRecordsApiError(message, response.status, denied);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PreparedRecordsApiError('Prepared records API returned invalid JSON.');
  }
  return parsePage(payload, limit, offset, parseItem);
}

export function getPreparedBeneficiaries(
  apiBaseUrl: string | undefined,
  accessToken: string | undefined,
  options: { limit?: number; offset?: number; category?: PreparedBeneficiaryRecord['category'] } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<PreparedRecordsPage<PreparedBeneficiaryRecord>> {
  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new PreparedRecordsApiError('Prepared records page request is invalid.');
  }
  return requestPage(apiBaseUrl, accessToken, '/api/prepared-data/beneficiaries', {
    limit, offset, category: options.category,
  }, parseBeneficiary, fetchImpl);
}

export function getPreparedMeasurements(
  apiBaseUrl: string | undefined,
  accessToken: string | undefined,
  options: { limit?: number; offset?: number; beneficiaryId?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<PreparedRecordsPage<PreparedMeasurementRecord>> {
  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new PreparedRecordsApiError('Prepared records page request is invalid.');
  }
  return requestPage(apiBaseUrl, accessToken, '/api/prepared-data/measurements', {
    limit, offset, beneficiary_id: options.beneficiaryId,
  }, parseMeasurement, fetchImpl);
}
