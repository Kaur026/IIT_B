import React, { useEffect, useState } from 'react';
import {
  getPreparedBeneficiaries,
  getPreparedMeasurements,
  PreparedBeneficiaryRecord,
  PreparedMeasurementRecord,
  PreparedRecordsApiError,
  PreparedRecordsPage,
} from '../../services/preparedRecordsApi';

const PAGE_SIZE = 25;
const apiBaseUrl = import.meta.env.VITE_B2_API_URL?.trim();

function StateMessage({
  status,
  message,
  onRetry,
}: {
  status: 'loading' | 'empty' | 'error' | 'denied' | 'unavailable';
  message?: string;
  onRetry?: () => void;
}) {
  if (status === 'loading') return <p role="status" className="mt-5 text-sm text-slate-600">Loading protected prepared records…</p>;
  if (status === 'empty') return <p role="status" className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">No prepared records are available in your authorized scope.</p>;
  const denied = status === 'denied';
  return <div role={denied ? 'alert' : 'status'} className={`mt-5 rounded-xl border p-4 text-sm ${denied ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
    <strong>{denied ? 'Access denied' : status === 'error' ? 'Could not load prepared records' : 'Prepared records unavailable'}</strong>
    <span className="ml-1">{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="ml-3 underline underline-offset-2">Retry</button>}
  </div>;
}

function pageError(error: unknown): { status: 'error' | 'denied' | 'unavailable'; message: string } {
  if (error instanceof PreparedRecordsApiError) {
    if (error.accessDenied) return { status: 'denied', message: error.message };
    if (error.status === 404 || error.status === 503 || error.message.includes('not connected') || error.message.includes('unavailable')) {
      return { status: 'unavailable', message: error.message };
    }
    return { status: 'error', message: error.message };
  }
  return { status: 'error', message: 'Prepared records could not be loaded.' };
}

function Pager<T>({
  page,
  onOffset,
}: {
  page: PreparedRecordsPage<T>;
  onOffset: (offset: number) => void;
}) {
  const start = page.total === 0 ? 0 : page.offset + 1;
  const end = Math.min(page.offset + page.items.length, page.total);
  return <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-600">
    <span>Showing {start}–{end} of {page.total}</span>
    <div className="flex gap-2">
      <button type="button" disabled={page.offset === 0} onClick={() => onOffset(Math.max(0, page.offset - page.limit))} className="rounded-full border px-3 py-1.5 disabled:opacity-40">Previous</button>
      <button type="button" disabled={page.offset + page.items.length >= page.total} onClick={() => onOffset(page.offset + page.limit)} className="rounded-full border px-3 py-1.5 disabled:opacity-40">Next</button>
    </div>
  </div>;
}

export function PreparedBeneficiaryView({ accessToken }: { accessToken: string }) {
  const [category, setCategory] = useState<PreparedBeneficiaryRecord['category'] | ''>('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PreparedRecordsPage<PreparedBeneficiaryRecord> | null>(null);
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready' | 'error' | 'denied' | 'unavailable'>('loading');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getPreparedBeneficiaries(apiBaseUrl, accessToken, {
      limit: PAGE_SIZE, offset, ...(category ? { category } : {}),
    }).then((result) => {
      if (!active) return;
      setPage(result);
      setStatus(result.items.length === 0 ? 'empty' : 'ready');
    }).catch((error: unknown) => {
      if (!active) return;
      setPage(null);
      const parsed = pageError(error);
      setStatus(parsed.status);
      setMessage(parsed.message);
    });
    return () => { active = false; };
  }, [accessToken, category, offset, reload]);

  return <section className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-5 sm:p-6" aria-labelledby="prepared-beneficiary-title" aria-live="polite">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <span className="inline-flex rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800">B! PREPARED SYNTHETIC DATASET</span>
        <h1 id="prepared-beneficiary-title" className="mt-3 text-xl font-semibold text-slate-900">Prepared beneficiaries</h1>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">Read-only source records. Names, caregiver details, and dates of birth are excluded from this view. Access is limited by the backend principal and organization scope.</p>
      </div>
      <label className="text-xs font-medium text-slate-700">Category
        <select value={category} onChange={(event) => { setCategory(event.target.value as typeof category); setOffset(0); }} className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
          <option value="">All categories</option><option value="child">Child</option><option value="pregnant_woman">Pregnant woman</option><option value="lactating_mother">Lactating mother</option>
        </select>
      </label>
    </header>
    {status === 'loading' || status === 'empty' || status === 'error' || status === 'denied' || status === 'unavailable'
      ? <StateMessage status={status} message={message} onRetry={() => setReload((value) => value + 1)} />
      : page && <>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Beneficiary ID</th><th className="p-3">Centre ID</th><th className="p-3">Category</th><th className="p-3">Sex</th></tr></thead>
            <tbody>{page.items.map((record) => <tr key={record.beneficiary_id} className="border-t border-slate-100"><td className="p-3 font-mono">{record.beneficiary_id}</td><td className="p-3 font-mono">{record.centre_id}</td><td className="p-3">{record.category}</td><td className="p-3">{record.sex}</td></tr>)}</tbody>
          </table>
        </div>
        <Pager page={page} onOffset={setOffset} />
        <p className="mt-3 text-[11px] text-slate-500">Source values are read from backend CSV validation. No mock records or operational actions are included.</p>
      </>}
  </section>;
}

export function PreparedMeasurementView({ accessToken }: { accessToken: string }) {
  const [beneficiaryInput, setBeneficiaryInput] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PreparedRecordsPage<PreparedMeasurementRecord> | null>(null);
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready' | 'error' | 'denied' | 'unavailable'>('loading');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getPreparedMeasurements(apiBaseUrl, accessToken, {
      limit: PAGE_SIZE, offset, ...(beneficiaryId ? { beneficiaryId } : {}),
    }).then((result) => {
      if (!active) return;
      setPage(result);
      setStatus(result.items.length === 0 ? 'empty' : 'ready');
    }).catch((error: unknown) => {
      if (!active) return;
      setPage(null);
      const parsed = pageError(error);
      setStatus(parsed.status);
      setMessage(parsed.message);
    });
    return () => { active = false; };
  }, [accessToken, beneficiaryId, offset, reload]);

  return <section className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-5 sm:p-6" aria-labelledby="prepared-measurement-title" aria-live="polite">
    <header>
      <span className="inline-flex rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800">B! PREPARED SYNTHETIC DATASET</span>
      <h1 id="prepared-measurement-title" className="mt-3 text-xl font-semibold text-slate-900">Prepared measurements</h1>
      <p className="mt-1 max-w-2xl text-xs text-slate-600">Read-only recorded source values. This view does not calculate clinical outcomes or submit measurements.</p>
    </header>
    <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); setOffset(0); setBeneficiaryId(beneficiaryInput.trim()); }}>
      <label className="text-xs font-medium text-slate-700">Beneficiary ID (optional)
        <input value={beneficiaryInput} onChange={(event) => setBeneficiaryInput(event.target.value)} maxLength={128} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs" />
      </label>
      <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Filter</button>
      {beneficiaryId && <button type="button" onClick={() => { setBeneficiaryInput(''); setBeneficiaryId(''); setOffset(0); }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs">Clear</button>}
    </form>
    {status === 'loading' || status === 'empty' || status === 'error' || status === 'denied' || status === 'unavailable'
      ? <StateMessage status={status} message={message} onRetry={() => setReload((value) => value + 1)} />
      : page && <>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Measurement ID</th><th className="p-3">Beneficiary ID</th><th className="p-3">Centre ID</th><th className="p-3">Measured on</th><th className="p-3">Weight</th><th className="p-3">Height</th><th className="p-3">MUAC (cm)</th><th className="p-3">Baseline</th></tr></thead>
            <tbody>{page.items.map((record) => <tr key={record.measurement_id} className="border-t border-slate-100"><td className="p-3 font-mono">{record.measurement_id}</td><td className="p-3 font-mono">{record.beneficiary_id}</td><td className="p-3 font-mono">{record.centre_id}</td><td className="p-3">{record.measured_on}</td><td className="p-3">{record.weight_value || 'Blank in source'} {record.weight_value ? record.weight_unit : ''}</td><td className="p-3">{record.height_value || 'Blank in source'} {record.height_value ? record.height_unit : ''}</td><td className="p-3">{record.muac_cm || 'Blank in source'}</td><td className="p-3">{record.is_baseline === '1' ? 'Yes' : 'No'}</td></tr>)}</tbody>
          </table>
        </div>
        <Pager page={page} onOffset={setOffset} />
        <p className="mt-3 text-[11px] text-slate-500">Measurement fields are source values only. No evaluation, flag, or treatment result is inferred.</p>
      </>}
  </section>;
}
