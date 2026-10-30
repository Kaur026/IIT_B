import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPreparedPreviewCatalog,
  getPreparedPreviewPage,
  LOCAL_PREVIEW_MODE,
  PreparedPreviewApiError,
  PreviewCatalog,
  PreviewDatasetKey,
  PreviewDatasetMeta,
  PreviewPage,
} from '../services/preparedPreviewApi';

type LoadState = 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';
const PAGE_SIZE = 25;

function messageForError(error: unknown): { state: LoadState; message: string } {
  if (error instanceof PreparedPreviewApiError) {
    if (error.status === 403) return { state: 'error', message: error.message };
    if (error.unavailable || error.status === 404) return { state: 'unavailable', message: error.message };
    return { state: 'error', message: error.message };
  }
  return { state: 'error', message: 'Prepared preview data could not be loaded.' };
}

function humanize(field: string): string {
  return field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const PreparedDatasetPreviewPage: React.FC = () => {
  const apiBaseUrl = import.meta.env.VITE_B2_API_URL?.trim();
  const [catalogState, setCatalogState] = useState<LoadState>('loading');
  const [catalogError, setCatalogError] = useState('');
  const [catalog, setCatalog] = useState<PreviewCatalog | null>(null);
  const [selectedKey, setSelectedKey] = useState<PreviewDatasetKey | ''>('');
  const [page, setPage] = useState<PreviewPage | null>(null);
  const [pageState, setPageState] = useState<LoadState>('loading');
  const [pageError, setPageError] = useState('');
  const [offset, setOffset] = useState(0);
  const [filterBy, setFilterBy] = useState('');
  const [filterFieldDraft, setFilterFieldDraft] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [filterDraft, setFilterDraft] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [pageRetry, setPageRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setCatalogState('loading');
    getPreparedPreviewCatalog(apiBaseUrl).then((result) => {
      if (!active) return;
      setCatalog(result);
      setCatalogError('');
      setCatalogState(result.datasets.length ? 'ready' : 'empty');
      setSelectedKey((current) => current && result.datasets.some((item) => item.key === current)
        ? current : result.datasets[0]?.key ?? '');
    }).catch((error: unknown) => {
      if (!active) return;
      const mapped = messageForError(error);
      setCatalogError(mapped.message);
      setCatalogState(mapped.state);
      setCatalog(null);
      setSelectedKey('');
    });
    return () => { active = false; };
  }, [apiBaseUrl, catalogRetry]);

  useEffect(() => {
    if (!selectedKey || catalogState !== 'ready') return;
    let active = true;
    setPage(null);
    setPageState('loading');
    setPageError('');
    getPreparedPreviewPage(apiBaseUrl, selectedKey, {
      limit: PAGE_SIZE, offset, filterBy, filterValue, sortBy, sortOrder,
    }).then((result) => {
      if (!active) return;
      setPage(result);
      setPageState(result.items.length ? 'ready' : 'empty');
    }).catch((error: unknown) => {
      if (!active) return;
      const mapped = messageForError(error);
      setPageError(mapped.message);
      setPageState(mapped.state);
    });
    return () => { active = false; };
  }, [apiBaseUrl, catalogState, filterBy, filterValue, offset, pageRetry, selectedKey, sortBy, sortOrder]);

  const selectedMeta: PreviewDatasetMeta | undefined = catalog?.datasets.find((item) => item.key === selectedKey);
  const clearFilter = () => {
    setFilterBy('');
    setFilterFieldDraft('');
    setFilterDraft('');
    setFilterValue('');
    setOffset(0);
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC] text-[#0E1B2B]">
      <header className="border-b border-slate-200/70 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0E1B2B] text-xs font-bold tracking-tighter text-white">PA</span>
            <span className="text-sm font-semibold tracking-tight">Poshan Action Layer</span>
          </Link>
          <Link to="/dashboard" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Back to Overview</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8" aria-live="polite">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1F8A83]">B! / data · Read only</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0E1B2B] sm:text-3xl">Prepared Dataset Explorer</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Inspect source records from the validated backend CSVs. This explorer does not join unrelated identifiers, change records, or use demo-store data.</p>
            </div>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-950">LOCAL DEVELOPMENT ONLY</span>
          </div>
        </section>

        {catalogState === 'ready' && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" role="status" data-testid="preview-active-banner">
          {LOCAL_PREVIEW_MODE}
        </div>}

        {(catalogState === 'loading' || catalogState === 'unavailable' || catalogState === 'error' || catalogState === 'empty') && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6" role="status">
            {catalogState === 'loading' && <p className="text-sm text-slate-600">Connecting to the loopback-only prepared-data preview…</p>}
            {catalogState === 'empty' && <p className="text-sm text-slate-700">The preview API returned no dataset metadata.</p>}
            {(catalogState === 'unavailable' || catalogState === 'error') && <>
              <h2 className="font-semibold text-slate-900">{catalogState === 'unavailable' ? 'Local preview unavailable' : 'Preview request failed'}</h2>
              <p className="mt-2 text-sm text-slate-600">{catalogError}</p>
              <button type="button" onClick={() => setCatalogRetry((value) => value + 1)} className="mt-4 rounded-full bg-[#0E1B2B] px-4 py-2 text-xs font-semibold text-white">Retry preview connection</button>
            </>}
          </section>
        )}

        {catalogState === 'ready' && selectedMeta && <>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(14rem,1fr)_2fr]">
              <label className="text-xs font-semibold text-slate-700">Dataset
                <select value={selectedKey} onChange={(event) => { setSelectedKey(event.target.value as PreviewDatasetKey); setOffset(0); clearFilter(); setSortBy(''); setSortOrder('asc'); }} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900">
                  {catalog.datasets.map((item) => <option value={item.key} key={item.key}>{item.label} · {item.total.toLocaleString()}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[10rem] flex-1 text-xs font-semibold text-slate-700">Filter field
                  <select value={filterFieldDraft} onChange={(event) => setFilterFieldDraft(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900">
                    <option value="">No filter</option>
                    {selectedMeta.filters.map((field) => <option key={field} value={field}>{humanize(field)}</option>)}
                  </select>
                </div>
                <label className="min-w-[10rem] flex-1 text-xs font-semibold text-slate-700">Exact value
                  <input value={filterDraft} onChange={(event) => setFilterDraft(event.target.value)} disabled={!filterFieldDraft} maxLength={128} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 disabled:bg-slate-100" />
                </label>
                <button type="button" onClick={() => { setFilterBy(filterFieldDraft); setFilterValue(filterFieldDraft ? filterDraft.trim() : ''); setOffset(0); }} disabled={Boolean(filterFieldDraft && !filterDraft.trim())} className="rounded-full border border-[#1F8A83]/30 bg-[#1F8A83]/5 px-4 py-2.5 text-xs font-semibold text-[#176A65] disabled:opacity-50">Apply filter</button>
                <button type="button" onClick={clearFilter} className="rounded-full border border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-700">Clear</button>
                <label className="min-w-[9rem] text-xs font-semibold text-slate-700">Sort by
                  <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setOffset(0); }} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900">
                    <option value="">Source ID order</option>
                    {selectedMeta.sort_fields.map((field) => <option key={field} value={field}>{humanize(field)}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">Direction
                  <select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as 'asc' | 'desc'); setOffset(0); }} className="mt-1.5 block rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900">
                    <option value="asc">Ascending</option><option value="desc">Descending</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span><strong className="text-slate-900">{selectedMeta.total.toLocaleString()}</strong> source records · page size {PAGE_SIZE}</span>
              <span>Displayed fields: {selectedMeta.fields.length} · All other source fields are withheld from this preview.</span>
            </div>
            {Object.keys(selectedMeta.excluded_fields).length > 0 && <details className="mt-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">Fields withheld from this dataset view</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{Object.entries(selectedMeta.excluded_fields).map(([field, reason]) => <li key={field}><code>{field}</code> — {reason}</li>)}</ul>
            </details>}
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label={`${selectedMeta.label} records`}>
            {pageState === 'loading' && <p className="p-6 text-sm text-slate-600" role="status">Loading source records…</p>}
            {(pageState === 'unavailable' || pageState === 'error') && <div className="p-6" role="status">
              <h2 className="font-semibold text-slate-900">{pageState === 'unavailable' ? 'Dataset unavailable' : 'Dataset request failed'}</h2>
              <p className="mt-2 text-sm text-slate-600">{pageError}</p>
              <button type="button" onClick={() => setPageRetry((value) => value + 1)} className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Retry this dataset</button>
            </div>}
            {pageState === 'empty' && <p className="p-6 text-sm text-slate-600" role="status">No source records match the selected filter.</p>}
            {pageState === 'ready' && page && <>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600"><tr>{page.fields.map((field) => <th key={field} className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-semibold">{humanize(field)}</th>)}</tr></thead>
                  <tbody>{page.items.map((record) => <tr key={record[page.fields[0]]} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    {page.fields.map((field) => <td key={field} className="whitespace-nowrap px-4 py-3 align-top text-slate-700">{record[field]}</td>)}
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-600">Showing {offset + 1}–{Math.min(offset + page.items.length, page.total)} of {page.total.toLocaleString()} matching rows</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} disabled={offset === 0} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 disabled:opacity-40">Previous</button>
                  <button type="button" onClick={() => setOffset((value) => value + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= page.total} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 disabled:opacity-40">Next</button>
                </div>
              </div>
            </>}
          </section>
        </>}
      </main>
    </div>
  );
};
