import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PREVIEW_DATASETS,
  LOCAL_PREVIEW_MODE,
} from './preparedPreviewApi.ts';
import type { PreviewCatalog } from './preparedPreviewApi.ts';
import { getPreparedDashboardMetrics, groupPreparedDatasets } from './preparedDashboardModel.ts';

function catalogFixture(): PreviewCatalog {
  const keys = Object.keys(PREVIEW_DATASETS) as Array<keyof typeof PREVIEW_DATASETS>;
  return {
    mode: LOCAL_PREVIEW_MODE,
    datasets: keys.map((key, index) => {
      const contract = PREVIEW_DATASETS[key];
      return {
        key,
        label: contract.label,
        fields: [...contract.fields],
        excluded_fields: {},
        filters: [...contract.filters],
        sort_fields: [...contract.sortFields],
        total: (index + 1) * 7,
      };
    }),
  };
}

test('prepared dashboard represents all twelve distinct datasets and uses catalog totals', () => {
  const catalog = catalogFixture();
  const sections = groupPreparedDatasets(catalog);
  const groupedKeys = sections.flatMap((section) => section.datasets.map((dataset) => dataset.key));
  assert.equal(groupedKeys.length, 12);
  assert.equal(new Set(groupedKeys).size, 12);
  assert.deepEqual([...groupedKeys].sort(), Object.keys(PREVIEW_DATASETS).sort());

  const metrics = getPreparedDashboardMetrics(catalog);
  assert.deepEqual(metrics.map(({ key, total }) => ({ key, total })), [
    { key: 'beneficiaries', total: 14 },
    { key: 'centres', total: 21 },
    { key: 'workers', total: 84 },
    { key: 'measurements', total: 28 },
    { key: 'tasks', total: 35 },
    { key: 'referrals', total: 42 },
  ]);
});

test('the main dashboard remains mock-only and the prepared CSV preview is not routed or shown in navigation', () => {
  const mockDashboard = readFileSync(new URL('../pages/MockDashboardView.tsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../pages/DashboardPage.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const portalLayout = readFileSync(new URL('../components/portal/PortalLayout.tsx', import.meta.url), 'utf8');

  assert.match(mockDashboard, /mockStore/);
  assert.doesNotMatch(mockDashboard, /getPreparedPreview(Catalog|Page)/);
  assert.match(dashboard, /MockDashboardView as DashboardPage/);
  assert.doesNotMatch(dashboard, /preparedPreview|PreparedDataDashboard/);
  assert.doesNotMatch(app, /path="\/prepared-preview"/);
  assert.doesNotMatch(portalLayout, /Prepared Data Preview|\/prepared-preview/);
});
