import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getPreparedDatasetSummary, PreparedDataApiError } from './preparedDataApi.ts';

function validSummary() {
  return {
    source: 'B!-PREPARED-SYNTHETIC-DATA',
    label: 'SYNTHETIC DATA / PROPOSED INTEGRATION',
    counts: {
      beneficiaries_total: 3025,
      beneficiaries_by_category: { child: 2425, pregnant_woman: 350, lactating_mother: 250 },
      centres_total: 122,
      measurements_total: 9715,
      tasks_total: 152,
      tasks_by_status: { assigned: 24, acknowledged: 17, in_progress: 41, closed: 70 },
      referrals_total: 85,
      referrals_by_state: { sent: 21, acknowledged: 28, attended: 12, outcome_recorded: 24 },
    },
  };
}

test('prepared summary uses the explicit read-only endpoint without user-supplied role or scope', async () => {
  let requestUrl = '';
  let request: RequestInit | undefined;
  const result = await getPreparedDatasetSummary('https://api.example.test/', async (url, init) => {
    requestUrl = String(url);
    request = init;
    return Response.json(validSummary());
  });
  assert.equal(requestUrl, 'https://api.example.test/api/prepared-data/summary');
  assert.equal(request?.method, 'GET');
  assert.equal(request?.cache, 'no-store');
  assert.equal(new Headers(request?.headers).has('authorization'), false);
  assert.equal(result.counts.beneficiaries_total, 3025);
});

test('missing configuration, HTTP failures, network failures, and malformed data stay unavailable', async () => {
  await assert.rejects(getPreparedDatasetSummary(undefined), PreparedDataApiError);
  await assert.rejects(
    getPreparedDatasetSummary('https://api.example.test', async () => new Response(null, { status: 503 })),
    /HTTP 503/,
  );
  await assert.rejects(
    getPreparedDatasetSummary('https://api.example.test', async () => { throw new Error('private network detail'); }),
    (error: Error) => error instanceof PreparedDataApiError && !error.message.includes('private network detail'),
  );
  await assert.rejects(
    getPreparedDatasetSummary('https://api.example.test', async () => Response.json({ ...validSummary(), counts: { ...validSummary().counts, tasks_total: 151 } })),
    /totals do not match/,
  );
  await assert.rejects(
    getPreparedDatasetSummary('https://api.example.test', async () => Response.json({ source: 'B2', label: 'SYNTHETIC DATA / PROPOSED INTEGRATION', counts: {} })),
    /response is invalid|counts are invalid/,
  );
});

test('the dashboard uses mock-store metrics and no longer renders a prepared-data summary widget', () => {
  const dashboard = readFileSync(new URL('../pages/DashboardPage.tsx', import.meta.url), 'utf8');
  const mockDashboard = readFileSync(new URL('../pages/MockDashboardView.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /MockDashboardView as DashboardPage/);
  assert.match(mockDashboard, /mockStore\.getMetrics/);
  assert.doesNotMatch(dashboard + mockDashboard, /PreparedDatasetSummaryCard|Prepared Data Overview|getPreparedDatasetSummary/);
});
