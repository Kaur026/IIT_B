import type { PreviewCatalog, PreviewDatasetKey, PreviewDatasetMeta } from './preparedPreviewApi.ts';

export const PREPARED_DASHBOARD_SECTIONS = [
  {
    id: 'coverage',
    title: 'People and service locations',
    description: 'Prepared beneficiary, centre, and worker source records.',
    datasets: ['beneficiaries', 'centres', 'workers'],
  },
  {
    id: 'measurements',
    title: 'Measurements and services',
    description: 'Source measurement, maternal profile, visit, and service records.',
    datasets: ['measurements', 'maternal_profiles', 'home_visits', 'service_records'],
  },
  {
    id: 'actions',
    title: 'Tasks and referrals',
    description: 'Prepared workflow records shown with their source statuses.',
    datasets: ['tasks', 'referrals'],
  },
  {
    id: 'review',
    title: 'Review and reference data',
    description: 'Prepared review, verification, and age-band reference records.',
    datasets: ['review_history', 'verification_records', 'age_bands_reference'],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  datasets: readonly PreviewDatasetKey[];
}>;

export interface PreparedDashboardSection {
  id: string;
  title: string;
  description: string;
  datasets: PreviewDatasetMeta[];
}

export interface PreparedDashboardMetric {
  key: PreviewDatasetKey;
  label: string;
  total: number;
}

const METRIC_LABELS: ReadonlyArray<{ key: PreviewDatasetKey; label: string }> = [
  { key: 'beneficiaries', label: 'Beneficiaries' },
  { key: 'centres', label: 'Centres' },
  { key: 'workers', label: 'Workers' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'referrals', label: 'Referrals' },
];

export function groupPreparedDatasets(catalog: PreviewCatalog): PreparedDashboardSection[] {
  const byKey = new Map(catalog.datasets.map((dataset) => [dataset.key, dataset]));
  return PREPARED_DASHBOARD_SECTIONS.map((section) => ({
    ...section,
    datasets: section.datasets.map((key) => {
      const dataset = byKey.get(key);
      if (!dataset) throw new Error(`Prepared preview catalog is missing ${key}.`);
      return dataset;
    }),
  }));
}

export function getPreparedDashboardMetrics(catalog: PreviewCatalog): PreparedDashboardMetric[] {
  const byKey = new Map(catalog.datasets.map((dataset) => [dataset.key, dataset]));
  return METRIC_LABELS.map(({ key, label }) => {
    const dataset = byKey.get(key);
    if (!dataset) throw new Error(`Prepared preview catalog is missing ${key}.`);
    return { key, label, total: dataset.total };
  });
}
