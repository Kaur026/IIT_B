import React, { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { getPreparedDatasetSummary, PreparedDatasetSummary } from '../../services/preparedDataApi';

type SummaryState =
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }
  | { status: 'empty'; summary: PreparedDatasetSummary }
  | { status: 'ready'; summary: PreparedDatasetSummary };

function Count({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value.toLocaleString()}</div>
  </div>;
}

export const PreparedDatasetSummaryCard: React.FC = () => {
  const apiBaseUrl = import.meta.env.VITE_B2_API_URL?.trim();
  const [state, setState] = useState<SummaryState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    if (!apiBaseUrl) {
      setState({ status: 'unavailable', message: 'The prepared-data API URL is not configured.' });
      return () => { active = false; };
    }
    setState({ status: 'loading' });
    getPreparedDatasetSummary(apiBaseUrl).then((summary) => {
      if (active) setState({ status: summary.counts.beneficiaries_total === 0 ? 'empty' : 'ready', summary });
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : 'Prepared synthetic data could not be loaded.';
      const unavailable = message.includes('not configured') || message.includes('unavailable');
      setState({ status: unavailable ? 'unavailable' : 'error', message });
    });
    return () => { active = false; };
  }, [apiBaseUrl]);

  return <section className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-5 sm:p-6" aria-labelledby="prepared-data-title" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800">
          <Database className="h-3.5 w-3.5" /> B! PREPARED SYNTHETIC DATASET
        </div>
        <h2 id="prepared-data-title" className="mt-3 text-lg font-semibold text-slate-900">Team-prepared data snapshot</h2>
        <p className="mt-1 text-xs text-slate-600">Read-only aggregate counts from the prepared synthetic dataset. Separate from B2 operational records and browser-local demo data.</p>
      </div>
      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-900">SYNTHETIC · NOT LIVE BENEFICIARIES</span>
    </div>

    {state.status === 'loading' && <p className="mt-5 text-sm text-slate-600">Loading prepared dataset summary…</p>}
    {(state.status === 'unavailable' || state.status === 'error') && <div className={`mt-5 rounded-xl border p-3 text-sm ${state.status === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-white text-amber-900'}`} role="status">
      <strong>{state.status === 'error' ? 'Prepared dataset unavailable' : 'Prepared dataset not connected'}</strong>
      <span className="ml-1">{state.message}</span>
    </div>}
    {state.status === 'empty' && <p className="mt-5 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">The prepared synthetic dataset contains no summary records.</p>}
    {state.status === 'ready' && <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Count label="Beneficiaries" value={state.summary.counts.beneficiaries_total} />
        <Count label="Children" value={state.summary.counts.beneficiaries_by_category.child} />
        <Count label="Pregnant women" value={state.summary.counts.beneficiaries_by_category.pregnant_woman} />
        <Count label="Lactating mothers" value={state.summary.counts.beneficiaries_by_category.lactating_mother} />
        <Count label="Centres" value={state.summary.counts.centres_total} />
        <Count label="Measurements" value={state.summary.counts.measurements_total} />
        <Count label="Tasks" value={state.summary.counts.tasks_total} />
        <Count label="Assigned tasks" value={state.summary.counts.tasks_by_status.assigned} />
        <Count label="Acknowledged tasks" value={state.summary.counts.tasks_by_status.acknowledged} />
        <Count label="In progress tasks" value={state.summary.counts.tasks_by_status.in_progress} />
        <Count label="Closed tasks" value={state.summary.counts.tasks_by_status.closed} />
        <Count label="Referrals" value={state.summary.counts.referrals_total} />
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Source: server-side aggregate of B!/data CSVs. No row-level IDs or records are returned to the browser.</p>
    </>}
  </section>;
};
