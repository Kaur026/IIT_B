import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getPreparedBeneficiaries,
  getPreparedMeasurements,
  PreparedRecordsApiError,
} from './preparedRecordsApi.ts';

const beneficiary = {
  beneficiary_id: 'PREP-B001', centre_id: 'PREP-C01', category: 'child', sex: 'F',
  synthetic_flag: 'SYNTHETIC',
};
const measurement = {
  measurement_id: 'PREP-M001', beneficiary_id: 'PREP-B001', centre_id: 'PREP-C01',
  measured_on: '2025-02-03', weight_value: '8.25', weight_unit: 'kg',
  height_value: '71.5', height_unit: 'cm', muac_cm: '13.4', is_baseline: '1', synthetic_flag: 'SYNTHETIC',
};
function page(item: unknown, limit = 25, offset = 0) {
  return { source: 'B!-PREPARED-SYNTHETIC-DATA', items: [item], total: 1, limit, offset };
}

test('prepared beneficiary service uses the protected API and preserves allowlisted source fields', async () => {
  let requestedUrl = '';
  let init: RequestInit | undefined;
  const result = await getPreparedBeneficiaries('https://api.example.test', 'verified-token', { limit: 25, offset: 0 }, async (url, request) => {
    requestedUrl = String(url);
    init = request;
    return Response.json(page(beneficiary));
  });
  assert.equal(requestedUrl, 'https://api.example.test/api/prepared-data/beneficiaries?limit=25&offset=0');
  assert.equal(init?.method, 'GET');
  assert.equal(init?.cache, 'no-store');
  assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer verified-token');
  assert.equal(new URL(requestedUrl).searchParams.has('role'), false);
  assert.equal(new URL(requestedUrl).searchParams.has('centre_scope'), false);
  assert.deepEqual(result.items[0], beneficiary);
});

test('prepared measurement service preserves the source values and sends no role or scope claims', async () => {
  let requestedUrl = '';
  let init: RequestInit | undefined;
  const result = await getPreparedMeasurements('https://api.example.test/', 'verified-token', { beneficiaryId: 'PREP-B001' }, async (url, request) => {
    requestedUrl = String(url);
    init = request;
    return Response.json(page(measurement));
  });
  assert.equal(new URL(requestedUrl).pathname, '/api/prepared-data/measurements');
  assert.equal(new URL(requestedUrl).searchParams.get('beneficiary_id'), 'PREP-B001');
  assert.equal(new Headers(init?.headers).has('x-demo-actor'), false);
  assert.deepEqual(result.items[0], measurement);
});

test('service rejects missing or extra beneficiary fields and malformed measurement values', async () => {
  await assert.rejects(getPreparedBeneficiaries('https://api.example.test', 'token', {}, async () => Response.json(page({ beneficiary_id: 'PREP-B001' }))), /approved field contract/);
  await assert.rejects(getPreparedBeneficiaries('https://api.example.test', 'token', {}, async () => Response.json(page({ ...beneficiary, name: 'must not pass' }))), /approved field contract/);
  await assert.rejects(getPreparedMeasurements('https://api.example.test', 'token', {}, async () => Response.json(page({ ...measurement, muac_cm: '' }))), /approved field contract/);
  await assert.rejects(getPreparedMeasurements('https://api.example.test', 'token', {}, async () => Response.json(page({ ...measurement, recorded_by: 'must not pass' }))), /approved field contract/);
  await assert.rejects(getPreparedMeasurements('https://api.example.test', 'token', {}, async () => Response.json(page({ ...measurement, measured_on: '2025-02-30' }))), /approved field contract/);
});

test('measurement service preserves allowed blank weight and height values', async () => {
  const result = await getPreparedMeasurements('https://api.example.test', 'token', {}, async () => Response.json(page({
    ...measurement, weight_value: '', height_value: '',
  })));
  assert.equal(result.items[0].weight_value, '');
  assert.equal(result.items[0].height_value, '');
});

test('service distinguishes denied, disabled, failed, and unavailable requests without response-body leakage', async () => {
  await assert.rejects(getPreparedBeneficiaries('https://api.example.test', undefined),
    (error: Error) => error instanceof PreparedRecordsApiError && error.accessDenied);
  for (const status of [401, 403]) {
    await assert.rejects(getPreparedBeneficiaries('https://api.example.test', 'token', {}, async () => new Response('private body', { status })),
      (error: Error) => error instanceof PreparedRecordsApiError && error.status === status && error.accessDenied && !error.message.includes('private body'));
  }
  await assert.rejects(getPreparedBeneficiaries('https://api.example.test', 'token', {}, async () => new Response('private body', { status: 404 })), /unavailable in this authorized scope/);
  await assert.rejects(getPreparedBeneficiaries('https://api.example.test', 'token', {}, async () => { throw new Error('private network detail'); }),
    (error: Error) => error instanceof PreparedRecordsApiError && !error.message.includes('private network detail'));
});

test('page bounds and response pagination are validated', async () => {
  assert.throws(() => getPreparedBeneficiaries('https://api.example.test', 'token', { limit: 101 }), PreparedRecordsApiError);
  await assert.rejects(getPreparedBeneficiaries('https://api.example.test', 'token', { limit: 10, offset: 20 }, async () => Response.json(page(beneficiary, 10, 0))), /response is invalid/);
});

test('authenticated record views never fall back to mockStore after API failure', () => {
  const views = readFileSync(new URL('../components/portal/PreparedRecordsViews.tsx', import.meta.url), 'utf8');
  const beneficiaries = readFileSync(new URL('../pages/BeneficiaryListPage.tsx', import.meta.url), 'utf8');
  const measurements = readFileSync(new URL('../pages/MeasurementPage.tsx', import.meta.url), 'utf8');
  assert.match(views, /getPreparedBeneficiaries/);
  assert.match(views, /getPreparedMeasurements/);
  assert.match(views, /Access denied/);
  assert.match(views, /Prepared records unavailable/);
  assert.doesNotMatch(views, /mockStore/);
  assert.match(beneficiaries, /if \(supabaseSession\)[\s\S]*PreparedBeneficiaryView accessToken=\{supabaseSession\.access_token\}/);
  assert.match(measurements, /if \(supabaseSession\)[\s\S]*PreparedMeasurementView accessToken=\{supabaseSession\.access_token\}/);
  assert.match(beneficiaries, /isMockDemoEnabled\(import\.meta\.env\)/);
  assert.match(measurements, /isMockDemoEnabled\(import\.meta\.env\)/);
});
