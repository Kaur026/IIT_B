export const LOCAL_PREVIEW_MODE = 'SYNTHETIC DATA — LOCAL DEVELOPMENT PREVIEW' as const;

export const PREVIEW_DATASETS = {
  age_bands_reference: {
    label: 'Age bands reference', fields: ['band_id', 'label', 'min_months', 'max_months', 'service_name', 'verified', 'status', 'synthetic_flag'],
    filters: ['status', 'verified'], sortFields: ['band_id', 'min_months', 'max_months', 'label'],
  },
  beneficiaries: {
    label: 'Beneficiaries', fields: ['beneficiary_id', 'centre_id', 'category', 'sex', 'enrolment_date', 'synthetic_flag'],
    filters: ['category', 'centre_id', 'sex'], sortFields: ['beneficiary_id', 'centre_id', 'category', 'sex', 'enrolment_date'],
  },
  centres: {
    label: 'Centres', fields: ['centre_id', 'name', 'block', 'district', 'state', 'synthetic_flag'],
    filters: ['block', 'district', 'state'], sortFields: ['centre_id', 'name', 'block', 'district', 'state'],
  },
  measurements: {
    label: 'Measurements', fields: ['measurement_id', 'beneficiary_id', 'centre_id', 'measured_on', 'weight_value', 'weight_unit', 'height_value', 'height_unit', 'muac_cm', 'is_baseline', 'synthetic_flag'],
    filters: ['beneficiary_id', 'centre_id', 'measured_on', 'is_baseline'], sortFields: ['measurement_id', 'beneficiary_id', 'centre_id', 'measured_on'],
  },
  tasks: {
    label: 'Prepared tasks', fields: ['task_id', 'flag_id', 'beneficiary_id', 'centre_id', 'owner_role', 'status', 'created_on', 'due_on', 'closed_on', 'outcome', 'synthetic_flag'],
    filters: ['centre_id', 'owner_role', 'status'], sortFields: ['task_id', 'beneficiary_id', 'centre_id', 'status', 'created_on', 'due_on'],
  },
  referrals: {
    label: 'Prepared referrals', fields: ['referral_id', 'beneficiary_id', 'centre_id', 'referral_type', 'state', 'sent_on', 'acknowledged_on', 'attended_on', 'outcome_on', 'due_on', 'synthetic_flag'],
    filters: ['centre_id', 'referral_type', 'state'], sortFields: ['referral_id', 'beneficiary_id', 'centre_id', 'state', 'sent_on', 'due_on'],
  },
  home_visits: {
    label: 'Home visits', fields: ['visit_id', 'beneficiary_id', 'centre_id', 'visit_date', 'outcome', 'synthetic_flag'],
    filters: ['beneficiary_id', 'centre_id', 'outcome'], sortFields: ['visit_id', 'beneficiary_id', 'centre_id', 'visit_date', 'outcome'],
  },
  maternal_profiles: {
    label: 'Maternal profiles', fields: ['maternal_id', 'beneficiary_id', 'centre_id', 'synthetic_flag'],
    filters: ['beneficiary_id', 'centre_id'], sortFields: ['maternal_id', 'beneficiary_id', 'centre_id'],
  },
  service_records: {
    label: 'Service records', fields: ['service_id', 'beneficiary_id', 'centre_id', 'service_type', 'service_date', 'quantity', 'synthetic_flag'],
    filters: ['beneficiary_id', 'centre_id', 'service_type'], sortFields: ['service_id', 'beneficiary_id', 'centre_id', 'service_type', 'service_date'],
  },
  review_history: {
    label: 'Review history', fields: ['review_id', 'flag_id', 'measurement_id', 'centre_id', 'flagged_on', 'reviewed_on', 'decision', 'synthetic_flag'],
    filters: ['measurement_id', 'centre_id', 'decision'], sortFields: ['review_id', 'measurement_id', 'centre_id', 'flagged_on', 'reviewed_on'],
  },
  verification_records: {
    label: 'Verification records', fields: ['verification_id', 'beneficiary_id', 'centre_id', 'status', 'opened_on', 'resolved_on', 'synthetic_flag'],
    filters: ['beneficiary_id', 'centre_id', 'status'], sortFields: ['verification_id', 'beneficiary_id', 'centre_id', 'status', 'opened_on'],
  },
  workers: {
    label: 'Workers', fields: ['worker_id', 'centre_id', 'role', 'synthetic_flag'],
    filters: ['centre_id', 'role'], sortFields: ['worker_id', 'centre_id', 'role'],
  },
} as const;

export type PreviewDatasetKey = keyof typeof PREVIEW_DATASETS;
export type PreviewRow = Record<string, string>;
export interface PreviewDatasetMeta {
  key: PreviewDatasetKey;
  label: string;
  fields: string[];
  excluded_fields: Record<string, string>;
  filters: string[];
  sort_fields: string[];
  total: number;
}
export interface PreviewCatalog {
  mode: typeof LOCAL_PREVIEW_MODE;
  datasets: PreviewDatasetMeta[];
}
export interface PreviewPage {
  mode: typeof LOCAL_PREVIEW_MODE;
  dataset: PreviewDatasetKey;
  label: string;
  fields: string[];
  excluded_fields: Record<string, string>;
  items: PreviewRow[];
  total: number;
  limit: number;
  offset: number;
}
export interface PreviewPageOptions {
  limit?: number;
  offset?: number;
  filterBy?: string;
  filterValue?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class PreparedPreviewApiError extends Error {
  readonly status?: number;
  readonly unavailable: boolean;

  constructor(message: string, status?: number, unavailable = false) {
    super(message);
    this.name = 'PreparedPreviewApiError';
    this.status = status;
    this.unavailable = unavailable;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => key in value);
}

function isDatasetKey(value: unknown): value is PreviewDatasetKey {
  return typeof value === 'string' && value in PREVIEW_DATASETS;
}

function previewUrl(apiBaseUrl: string | undefined, path: string, params?: URLSearchParams): URL {
  if (!apiBaseUrl?.trim()) throw new PreparedPreviewApiError('Local prepared preview API is not configured.', undefined, true);
  try {
    const url = new URL(path, apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)
      || (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username || url.password) throw new Error('Not a loopback origin');
    params?.forEach((value, key) => url.searchParams.set(key, value));
    return url;
  } catch {
    throw new PreparedPreviewApiError('Local prepared preview requires a loopback API URL.', undefined, true);
  }
}

async function getJson(url: URL, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'GET', cache: 'no-store', credentials: 'omit' });
  } catch {
    throw new PreparedPreviewApiError('Local prepared preview API could not be reached.', undefined, true);
  }
  if (!response.ok) {
    if (response.status === 404) throw new PreparedPreviewApiError('Local prepared preview is disabled or unavailable.', 404, true);
    if (response.status === 403) throw new PreparedPreviewApiError('Local prepared preview denied this non-local or unsafe request.', 403);
    if (response.status === 422) throw new PreparedPreviewApiError('The preview request was rejected. Check the selected filter or page settings.', 422);
    throw new PreparedPreviewApiError('Prepared preview data could not be loaded.', response.status, response.status >= 500);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new PreparedPreviewApiError('Prepared preview API returned an invalid response.');
  }
}

function parseMeta(value: unknown): PreviewDatasetMeta {
  if (!isRecord(value) || !exactKeys(value, ['key', 'label', 'fields', 'excluded_fields', 'filters', 'sort_fields', 'total'])
    || !isDatasetKey(value.key)) throw new PreparedPreviewApiError('Prepared preview catalog is invalid.');
  const contract = PREVIEW_DATASETS[value.key];
  if (value.label !== contract.label
    || JSON.stringify(value.fields) !== JSON.stringify(contract.fields)
    || JSON.stringify(value.filters) !== JSON.stringify(contract.filters)
    || JSON.stringify(value.sort_fields) !== JSON.stringify(contract.sortFields)
    || !Number.isSafeInteger(value.total) || Number(value.total) < 0
    || !isRecord(value.excluded_fields)
    || Object.entries(value.excluded_fields).some(([field, reason]) => contract.fields.includes(field as never) || typeof reason !== 'string')) {
    throw new PreparedPreviewApiError('Prepared preview catalog does not match the allowlisted field contract.');
  }
  return value as unknown as PreviewDatasetMeta;
}

export function parsePreviewCatalog(value: unknown): PreviewCatalog {
  if (!isRecord(value) || !exactKeys(value, ['mode', 'datasets']) || value.mode !== LOCAL_PREVIEW_MODE
    || !Array.isArray(value.datasets)) throw new PreparedPreviewApiError('Prepared preview catalog is invalid.');
  const datasets = value.datasets.map(parseMeta);
  if (datasets.length !== Object.keys(PREVIEW_DATASETS).length
    || new Set(datasets.map((item) => item.key)).size !== datasets.length) {
    throw new PreparedPreviewApiError('Prepared preview catalog does not include the complete dataset set.');
  }
  return { mode: LOCAL_PREVIEW_MODE, datasets };
}

function parsePreviewPage(value: unknown, key: PreviewDatasetKey, options: Required<PreviewPageOptions>): PreviewPage {
  if (!isRecord(value) || !exactKeys(value, ['mode', 'dataset', 'label', 'fields', 'excluded_fields', 'items', 'total', 'limit', 'offset'])
    || value.mode !== LOCAL_PREVIEW_MODE || value.dataset !== key || value.label !== PREVIEW_DATASETS[key].label
    || JSON.stringify(value.fields) !== JSON.stringify(PREVIEW_DATASETS[key].fields)
    || !isRecord(value.excluded_fields) || !Array.isArray(value.items)
    || !Number.isSafeInteger(value.total) || Number(value.total) < 0
    || value.limit !== options.limit || value.offset !== options.offset) {
    throw new PreparedPreviewApiError('Prepared preview page does not match its contract.');
  }
  const items = value.items.map((item) => {
    if (!isRecord(item) || !exactKeys(item, PREVIEW_DATASETS[key].fields)
      || Object.values(item).some((field) => typeof field !== 'string')) {
      throw new PreparedPreviewApiError('Prepared preview record contains unexpected fields or values.');
    }
    return item as PreviewRow;
  });
  if (items.length !== Math.max(0, Math.min(options.limit, Number(value.total) - options.offset))) {
    throw new PreparedPreviewApiError('Prepared preview pagination is inconsistent.');
  }
  return value as unknown as PreviewPage;
}

export async function getPreparedPreviewCatalog(
  apiBaseUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<PreviewCatalog> {
  return parsePreviewCatalog(await getJson(previewUrl(apiBaseUrl, '/api/preview/prepared-data/datasets'), fetchImpl));
}

export async function getPreparedPreviewPage(
  apiBaseUrl: string | undefined,
  key: PreviewDatasetKey,
  options: PreviewPageOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<PreviewPage> {
  const normalized: Required<PreviewPageOptions> = {
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
    filterBy: options.filterBy ?? '',
    filterValue: options.filterValue ?? '',
    sortBy: options.sortBy ?? '',
    sortOrder: options.sortOrder ?? 'asc',
  };
  const contract = PREVIEW_DATASETS[key];
  if (!contract || !Number.isInteger(normalized.limit) || normalized.limit < 1 || normalized.limit > 100
    || !Number.isInteger(normalized.offset) || normalized.offset < 0
    || ((normalized.filterBy === '') !== (normalized.filterValue === ''))
    || (normalized.filterBy && !contract.filters.includes(normalized.filterBy as never))
    || (normalized.sortBy && !contract.sortFields.includes(normalized.sortBy as never))
    || !['asc', 'desc'].includes(normalized.sortOrder)) {
    throw new PreparedPreviewApiError('Prepared preview query is outside its allowlisted contract.');
  }
  const params = new URLSearchParams({ limit: String(normalized.limit), offset: String(normalized.offset), sort_order: normalized.sortOrder });
  if (normalized.filterBy) {
    params.set('filter_by', normalized.filterBy);
    params.set('filter_value', normalized.filterValue);
  }
  if (normalized.sortBy) params.set('sort_by', normalized.sortBy);
  const url = previewUrl(apiBaseUrl, `/api/preview/prepared-data/${encodeURIComponent(key)}`, params);
  return parsePreviewPage(await getJson(url, fetchImpl), key, normalized);
}
