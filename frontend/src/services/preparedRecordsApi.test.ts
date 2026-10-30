import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getPreparedBeneficiaries,
  getPreparedMeasurements,
  PreparedRecordsApiError,
} from './preparedRecordsApi.ts';
import {
  getPreparedPreviewCatalog,
  getPreparedPreviewPage,
  LOCAL_PREVIEW_MODE,
  PREVIEW_DATASETS,
  PreparedPreviewApiError,
} from './preparedPreviewApi.ts';

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

test('local preview catalog and all twelve dataset pages use exact allowlisted API contracts', async () => {
  const keys = Object.keys(PREVIEW_DATASETS) as Array<keyof typeof PREVIEW_DATASETS>;
  let catalogUrl = '';
  const catalog = await getPreparedPreviewCatalog('http://127.0.0.1:8000', async (url, init) => {
    catalogUrl = String(url);
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.cache, 'no-store');
    return Response.json({
      mode: LOCAL_PREVIEW_MODE,
      datasets: keys.map((key) => {
        const contract = PREVIEW_DATASETS[key];
        return { key, label: contract.label, fields: contract.fields, excluded_fields: {}, filters: contract.filters, sort_fields: contract.sortFields, total: 1 };
      }),
    });
  });
  assert.equal(new URL(catalogUrl).pathname, '/api/preview/prepared-data/datasets');
  assert.equal(catalog.datasets.length, 12);

  for (const key of keys) {
    const contract = PREVIEW_DATASETS[key];
    let pageUrl = '';
    const result = await getPreparedPreviewPage('http://localhost:8000/', key, { limit: 1, offset: 0 }, async (url) => {
      pageUrl = String(url);
      return Response.json({
        mode: LOCAL_PREVIEW_MODE,
        dataset: key,
        label: contract.label,
        fields: contract.fields,
        excluded_fields: {},
        items: [Object.fromEntries(contract.fields.map((field) => [field, field === 'synthetic_flag' ? 'SYNTHETIC' : 'source-value']))],
        total: 1,
        limit: 1,
        offset: 0,
      });
    });
    assert.equal(new URL(pageUrl).pathname, `/api/preview/prepared-data/${key}`);
    assert.equal(result.items.length, 1);
    assert.deepEqual(Object.keys(result.items[0]), [...contract.fields]);
    assert.equal(result.items[0].synthetic_flag, 'SYNTHETIC');
  }
});

test('local preview rejects malformed data, non-loopback URLs, and failures without a mock fallback', async () => {
  await assert.rejects(getPreparedPreviewCatalog(undefined),
    (error: Error) => error instanceof PreparedPreviewApiError && error.unavailable);
  await assert.rejects(getPreparedPreviewCatalog('https://remote.example.test'),
    (error: Error) => error instanceof PreparedPreviewApiError && error.unavailable);
  await assert.rejects(getPreparedPreviewCatalog('http://127.0.0.1:8000', async () => new Response('disabled', { status: 404 })),
    (error: Error) => error instanceof PreparedPreviewApiError && error.unavailable && error.status === 404);
  await assert.rejects(getPreparedPreviewCatalog('http://127.0.0.1:8000', async () => { throw new Error('offline'); }),
    (error: Error) => error instanceof PreparedPreviewApiError && error.unavailable);
  await assert.rejects(getPreparedPreviewPage('http://127.0.0.1:8000', 'beneficiaries', { limit: 1 }, async () => Response.json({})),
    /does not match its contract/);
  await assert.rejects(getPreparedPreviewPage('http://127.0.0.1:8000', 'beneficiaries', { limit: 101 }),
    /outside its allowlisted contract/);
  const previewPage = readFileSync(new URL('../pages/PreparedDatasetPreviewPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(previewPage, /mockStore/);
  assert.match(previewPage, /getPreparedPreviewPage/);
});

test('page bounds and response pagination are validated', async () => {
  assert.throws(() => getPreparedBeneficiaries('https://api.example.test', 'token', { limit: 101 }), PreparedRecordsApiError);
  await assert.rejects(getPreparedBeneficiaries('https://api.example.test', 'token', { limit: 10, offset: 20 }, async () => Response.json(page(beneficiary, 10, 0))), /response is invalid/);
});

test('record pages never connect provider sessions to prepared records or substitute mock data', () => {
  const beneficiaries = readFileSync(new URL('../pages/BeneficiaryListPage.tsx', import.meta.url), 'utf8');
  const measurements = readFileSync(new URL('../pages/MeasurementPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(beneficiaries + measurements, /PreparedRecordsViews|PreparedBeneficiaryView|PreparedMeasurementView|getPreparedBeneficiaries|getPreparedMeasurements/);
  assert.match(beneficiaries, /Mock beneficiary data unavailable for provider sessions/);
  assert.match(measurements, /Mock measurements unavailable for provider sessions/);
  assert.match(beneficiaries, /isMockDemoEnabled\(import\.meta\.env\)/);
  assert.match(measurements, /isMockDemoEnabled\(import\.meta\.env\)/);
});
