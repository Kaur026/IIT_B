export interface PreparedDatasetCounts {
  beneficiaries_total: number;
  beneficiaries_by_category: {
    child: number;
    pregnant_woman: number;
    lactating_mother: number;
  };
  centres_total: number;
  measurements_total: number;
  tasks_total: number;
  tasks_by_status: {
    assigned: number;
    acknowledged: number;
    in_progress: number;
    closed: number;
  };
  referrals_total: number;
  referrals_by_state: {
    sent: number;
    acknowledged: number;
    attended: number;
    outcome_recorded: number;
  };
}

export interface PreparedDatasetSummary {
  source: 'B!-PREPARED-SYNTHETIC-DATA';
  label: 'SYNTHETIC DATA / PROPOSED INTEGRATION';
  counts: PreparedDatasetCounts;
}

export class PreparedDataApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreparedDataApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCountMap(value: unknown, expectedKeys: string[]): value is Record<string, number> {
  return isRecord(value)
    && Object.keys(value).length === expectedKeys.length
    && expectedKeys.every((key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0);
}

function parseSummary(value: unknown): PreparedDatasetSummary {
  if (!isRecord(value) || value.source !== 'B!-PREPARED-SYNTHETIC-DATA'
    || value.label !== 'SYNTHETIC DATA / PROPOSED INTEGRATION' || !isRecord(value.counts)) {
    throw new PreparedDataApiError('Prepared synthetic dataset response is invalid.');
  }
  const counts = value.counts;
  const categoryKeys = ['child', 'pregnant_woman', 'lactating_mother'];
  const taskKeys = ['assigned', 'acknowledged', 'in_progress', 'closed'];
  const referralKeys = ['sent', 'acknowledged', 'attended', 'outcome_recorded'];
  const numericKeys = ['beneficiaries_total', 'centres_total', 'measurements_total', 'tasks_total', 'referrals_total'];
  if (numericKeys.some((key) => !Number.isSafeInteger(counts[key]) || Number(counts[key]) < 0)
    || !isCountMap(counts.beneficiaries_by_category, categoryKeys)
    || !isCountMap(counts.tasks_by_status, taskKeys)
    || !isCountMap(counts.referrals_by_state, referralKeys)) {
    throw new PreparedDataApiError('Prepared synthetic dataset counts are invalid.');
  }
  const byCategory = counts.beneficiaries_by_category as Record<string, number>;
  const byTaskStatus = counts.tasks_by_status as Record<string, number>;
  const byReferralState = counts.referrals_by_state as Record<string, number>;
  if (categoryKeys.reduce((sum, key) => sum + byCategory[key], 0) !== counts.beneficiaries_total
    || taskKeys.reduce((sum, key) => sum + byTaskStatus[key], 0) !== counts.tasks_total
    || referralKeys.reduce((sum, key) => sum + byReferralState[key], 0) !== counts.referrals_total) {
    throw new PreparedDataApiError('Prepared synthetic dataset totals do not match their status counts.');
  }
  return value as unknown as PreparedDatasetSummary;
}

export async function getPreparedDatasetSummary(
  apiBaseUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<PreparedDatasetSummary> {
  const base = apiBaseUrl?.trim();
  if (!base) throw new PreparedDataApiError('Prepared dataset API is not configured.');

  let url: URL;
  try {
    url = new URL('/api/prepared-data/summary', base.endsWith('/') ? base : `${base}/`);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('Insecure API origin.');
    }
  } catch {
    throw new PreparedDataApiError('Prepared dataset API URL is invalid.');
  }

  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
  } catch {
    throw new PreparedDataApiError('Prepared dataset API is unavailable.');
  }
  if (!response.ok) {
    throw new PreparedDataApiError(`Prepared dataset API returned HTTP ${response.status}.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PreparedDataApiError('Prepared dataset API returned invalid JSON.');
  }
  return parseSummary(payload);
}
