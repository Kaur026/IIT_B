import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, ShieldAlert } from 'lucide-react';
import {
  b1CsvDataSource,
  filterB1Children,
  type B1ChildFilters,
  type B1ChildLoadResult,
  type B1ChildRow,
} from '../services/b1CsvDataSource.ts';

const EMPTY_FILTERS: B1ChildFilters = { search: '', sex: '', referralStatus: '', taskStatus: '', enrolled: '' };

/** Read-only interface. The private CSV is not bundled or fetched by the browser. */
export const B1ChildExplorerPage: React.FC = () => {
  const [result, setResult] = useState<B1ChildLoadResult>({ status: 'loading', source: 'b1-csv' });
  const [filters, setFilters] = useState<B1ChildFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    let active = true;
    setResult({ status: 'loading', source: 'b1-csv' });
    void b1CsvDataSource.loadChildren().then((loaded) => {
      if (active) setResult(loaded);
    }).catch(() => {
      if (active) setResult({
        status: 'error',
        source: 'b1-csv',
        message: 'The B1 dataset could not be loaded. No other data source was substituted.',
      });
    });
    return () => { active = false; };
  }, []);

  const rows = result.status === 'ready' ? result.rows : [];
  const filteredRows = useMemo(() => filterB1Children(rows, filters), [rows, filters]);
  const selected: B1ChildRow | undefined = filteredRows.find((row) => row.child_id === selectedId);
  const available = result.status === 'ready' || result.status === 'empty';
  const updateFilter = <K extends keyof B1ChildFilters>(key: K, value: B1ChildFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedId('');
  };

  return (
    <main className="min-h-screen bg-[#F5F9FC] px-4 py-8 text-[#0E1B2B] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link to="/beneficiaries" className="inline-flex items-center gap-2 text-sm text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Back to the separate demo beneficiary list
        </Link>

        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-800">Read-only source explorer</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">B1 Synthetic Screening Dataset</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            This is synthetic screening data, not live beneficiary records. It is separate from the illustrative browser-local demo and cannot be used for operational casework.
          </p>
          <p className="mt-2 text-xs text-slate-500">Source attribution: private repository fixture <code>B1/children.csv</code>. Values have not been deployed to the browser.</p>
        </header>

        {result.status === 'loading' && <section role="status" className="rounded-2xl border bg-white p-6 text-sm">Loading the B1 dataset…</section>}

        {result.status === 'unavailable' && (
          <section role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
              <div>
                <h2 className="font-semibold text-amber-950">Dataset unavailable in this frontend</h2>
                <p className="mt-2 text-sm leading-relaxed text-amber-950">{result.message}</p>
                <p className="mt-2 text-xs text-amber-900">B2 has no authenticated endpoint for these rows. The CSV remains private; no mock, localStorage, or other backend records are shown instead.</p>
              </div>
            </div>
          </section>
        )}

        {result.status === 'unauthorized' && (
          <section role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6">
            <h2 className="font-semibold text-rose-950">Access to the B1 dataset was not authorized</h2>
            <p className="mt-2 text-sm text-rose-900">{result.message}</p>
          </section>
        )}

        {result.status === 'error' && (
          <section role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6">
            <h2 className="font-semibold text-rose-950">Dataset could not be loaded</h2>
            <p className="mt-2 text-sm text-rose-900">{result.message}</p>
          </section>
        )}

        {!available && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Dataset search and filters">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Children</h2>
              <span data-testid="b1-child-count" className="text-sm font-medium text-slate-600">Dataset unavailable</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs font-medium sm:col-span-2 lg:col-span-1"><span className="mb-1 block">Search ID or worker</span><input disabled className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm" placeholder="Unavailable until secure source access is configured" /></label>
              <SelectFilter label="Sex" value="" disabled options={['M', 'F']} onChange={() => undefined} />
              <SelectFilter label="Referral status" value="" disabled options={['attended', 'issued', 'none', 'outcome_logged']} onChange={() => undefined} />
              <SelectFilter label="Task status" value="" disabled options={['new', 'none']} onChange={() => undefined} />
              <label className="text-xs font-medium"><span className="mb-1 block">Enrolled</span><select disabled className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm" defaultValue=""><option value="">Any</option><option value="yes">Yes</option><option value="no">No</option></select></label>
            </div>
          </section>
        )}

        {available && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Dataset search and filters">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Children</h2>
                <span data-testid="b1-child-count" className="text-sm font-medium text-slate-600">{filteredRows.length} of {rows.length} records</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="sm:col-span-2 lg:col-span-1">
                  <span className="mb-1 block text-xs font-medium">Search ID or worker</span>
                  <span className="flex items-center gap-2 rounded-xl border px-3 py-2">
                    <Search className="h-4 w-4 text-slate-500" />
                    <input className="min-w-0 flex-1 text-sm outline-none" value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="C0001 or W07" />
                  </span>
                </label>
                <SelectFilter label="Sex" value={filters.sex || ''} disabled={!available} onChange={(value) => updateFilter('sex', value as B1ChildFilters['sex'])} options={['M', 'F']} />
                <SelectFilter label="Referral status" value={filters.referralStatus || ''} disabled={!available} onChange={(value) => updateFilter('referralStatus', value as B1ChildFilters['referralStatus'])} options={['attended', 'issued', 'none', 'outcome_logged']} />
                <SelectFilter label="Task status" value={filters.taskStatus || ''} disabled={!available} onChange={(value) => updateFilter('taskStatus', value as B1ChildFilters['taskStatus'])} options={['new', 'none']} />
                <label className="text-xs font-medium">
                  <span className="mb-1 block">Enrolled</span>
                  <select className="w-full rounded-xl border bg-white px-3 py-2 text-sm" value={filters.enrolled === '' ? '' : filters.enrolled ? 'yes' : 'no'} disabled={!available} onChange={(event) => updateFilter('enrolled', event.target.value === '' ? '' : event.target.value === 'yes')}>
                    <option value="">Any</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </label>
              </div>
            </section>

            {result.status === 'empty' || filteredRows.length === 0 ? (
              <section role="status" className="rounded-2xl border bg-white p-6 text-sm text-slate-600">No B1 child records match these filters.</section>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
                <section className="max-h-[34rem] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="B1 child records">
                  <ul className="divide-y divide-slate-100">
                    {filteredRows.map((row) => (
                      <li key={row.child_id}>
                        <button type="button" onClick={() => setSelectedId(row.child_id)} aria-pressed={selectedId === row.child_id} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 aria-pressed:bg-teal-50">
                          <span><span className="block font-mono text-sm font-semibold">{row.child_id}</span><span className="text-xs text-slate-500">Age {row.age_months} months · Sex {row.sex}</span></span>
                          <span className="text-right text-xs text-slate-600">Worker {row.assigned_worker_id}<br />Referral: {row.referral_status}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
                  <h2 className="font-semibold">Source row details</h2>
                  {selected ? <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{Object.entries(selected).map(([field, value]) => <div key={field}><dt className="text-xs text-slate-500">{field}</dt><dd className="mt-0.5 break-words font-medium">{value === null ? 'Blank in source' : String(value)}</dd></div>)}</dl> : <p className="mt-3 text-sm text-slate-600">Select a row to inspect its source fields. No operational actions are available.</p>}
                </section>
              </div>
            )}
          </>
        )}

        <footer className="text-xs text-slate-500">Read-only synthetic source. No registration, measurement submission, tasks, referrals, or audit actions are available here.</footer>
      </div>
    </main>
  );
};

const SelectFilter: React.FC<{ label: string; value: string; disabled: boolean; options: string[]; onChange: (value: string) => void }> = ({ label, value, disabled, options, onChange }) => (
  <label className="text-xs font-medium">
    <span className="mb-1 block">{label}</span>
    <select className="w-full rounded-xl border bg-white px-3 py-2 text-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">Any</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);
