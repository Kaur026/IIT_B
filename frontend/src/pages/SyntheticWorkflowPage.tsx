import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { B2ApiError, beneficiaryMatchesRegistration, createB2ApiClient, measurementMatchesSubmission, type B2Beneficiary, type B2ListMeasurementsResponse } from '../services/b2Api';

const SYNTHETIC_LABEL = 'SYNTHETIC DATA · DEVELOPMENT ONLY';

export const SyntheticWorkflowPage: React.FC = () => {
  const {
    supabaseSession,
    backendProfile,
    profileStatus,
    authInitializing,
    authMessage,
  } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<B2Beneficiary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [measurements, setMeasurements] = useState<B2ListMeasurementsResponse | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [muacMm, setMuacMm] = useState('');
  const [registrationDateOfBirth, setRegistrationDateOfBirth] = useState('');
  const [registrationSex, setRegistrationSex] = useState<'F' | 'M'>('F');
  const [registrationKinship, setRegistrationKinship] = useState('');
  const [oedema, setOedema] = useState<'yes' | 'no'>('no');
  const [dangerSign, setDangerSign] = useState<'yes' | 'no'>('no');
  const [apiConfigurationError, setApiConfigurationError] = useState<string | null>(null);

  const accessToken = supabaseSession?.access_token || '';
  const centreScopes = backendProfile?.scopes.filter((scope) => scope.type === 'centre') || [];
  const centreId = centreScopes.length === 1 ? centreScopes[0].id : '';
  const eligibleProfile = backendProfile?.identity_mode === 'supabase'
    && backendProfile.demo === false
    && backendProfile.is_active
    && backendProfile.role === 'AWW'
    && Boolean(centreId);

  const api = useMemo(() => {
    const baseUrl = import.meta.env.VITE_B2_API_URL?.trim();
    if (!baseUrl) return null;
    try {
      return createB2ApiClient(baseUrl);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.VITE_B2_API_URL?.trim()) {
      setApiConfigurationError('VITE_B2_API_URL is not configured.');
      return;
    }
    try {
      createB2ApiClient(import.meta.env.VITE_B2_API_URL.trim());
      setApiConfigurationError(null);
    } catch {
      setApiConfigurationError('VITE_B2_API_URL must be HTTPS, or HTTP on a loopback development host.');
    }
  }, []);

  const refreshBeneficiaries = useCallback(async () => {
    if (!api || !accessToken || !centreId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.listBeneficiaries(centreId, accessToken);
      setBeneficiaries(response.beneficiaries);
      setSelectedId((current) => response.beneficiaries.some((item) => item.beneficiary_id === current)
        ? current
        : response.beneficiaries[0]?.beneficiary_id || '');
      setRefreshRevision((revision) => revision + 1);
    } catch (cause) {
      setBeneficiaries([]);
      setSelectedId('');
      setMeasurements(null);
      setError(cause instanceof Error ? cause.message : 'The B2 service could not load beneficiaries.');
    } finally {
      setLoading(false);
    }
  }, [api, accessToken, centreId]);

  useEffect(() => {
    if (profileStatus === 'ready' && eligibleProfile) void refreshBeneficiaries();
    else {
      setBeneficiaries([]);
      setSelectedId('');
      setMeasurements(null);
    }
  }, [profileStatus, eligibleProfile, refreshBeneficiaries]);

  useEffect(() => {
    if (!api || !accessToken || !selectedId || !eligibleProfile) {
      setMeasurements(null);
      return;
    }
    let active = true;
    setMeasurements(null);
    setError(null);
    void api.listMeasurements(selectedId, accessToken).then((response) => {
      if (active) setMeasurements(response);
    }).catch((cause: unknown) => {
      if (active) {
        setMeasurements(null);
        setError(cause instanceof Error ? cause.message : 'Saved measurements could not be loaded from B2.');
      }
    });
    return () => { active = false; };
  }, [api, accessToken, selectedId, eligibleProfile, refreshRevision]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!api || !accessToken || !selectedId) return;
    if (measurements?.measurements.length) {
      setError('A first measurement is already saved. Use the separate authorized remeasurement workflow.');
      return;
    }
    const weight = Number(weightKg);
    const height = Number(heightCm);
    const muac = muacMm.trim() ? Number(muacMm) : undefined;
    if (!measurementDate || !Number.isFinite(weight) || weight <= 0
        || !Number.isFinite(height) || height <= 0
        || (muac !== undefined && (!Number.isFinite(muac) || muac <= 0))) {
      setError('Enter a date and positive finite measurement values. B2 will perform the authoritative validation.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.recordFirstMeasurement({
        beneficiary_id: selectedId,
        measurement: {
          measurement_date: measurementDate,
          weight_kg: weight,
          height_cm: height,
          ...(muac === undefined ? {} : { muac_mm: muac }),
          oedema,
          danger_sign: dangerSign,
        },
        recorded_at: measurementDate,
      }, accessToken);
      setNotice(`B2 accepted measurement ${result.measurement.measurement_id}; verifying values and persisted evaluation…`);
      let refreshed: B2ListMeasurementsResponse;
      try {
        refreshed = await api.listMeasurements(selectedId, accessToken);
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : 'B2 could not reload saved records.';
        setError(`B2 accepted the request, but fresh read-back verification failed: ${reason} Persistence is unverified; refresh before continuing.`);
        setNotice(null);
        return;
      }
      const persistedMeasurement = refreshed.measurements.find(
        (item) => item.measurement_id === result.measurement.measurement_id,
      );
      const persistedFlags = refreshed.flags.filter(
        (item) => item.measurement_id === result.measurement.measurement_id,
      );
      if (!persistedMeasurement || persistedFlags.length !== 1
          || !measurementMatchesSubmission(persistedMeasurement, persistedFlags[0], {
            beneficiary_id: selectedId,
            measurement: {
              measurement_date: measurementDate,
              weight_kg: weight,
              height_cm: height,
              ...(muac === undefined ? {} : { muac_mm: muac }),
              oedema,
              danger_sign: dangerSign,
            },
            recorded_at: measurementDate,
          }, centreId)
          || persistedMeasurement.evaluation.colour !== result.measurement.evaluation.colour
          || persistedFlags[0].flag_id !== result.flag.flag_id
          || persistedFlags[0].beneficiary_id !== persistedMeasurement.beneficiary_id
          || persistedFlags[0].centre_id !== persistedMeasurement.centre_id
          || persistedFlags[0].colour !== persistedMeasurement.evaluation.colour) {
        setMeasurements(refreshed);
        setError('B2 accepted the write, but fresh history did not confirm the saved measurement and its matching persisted flag. Treat the result as unverified and refresh before continuing.');
        setNotice(null);
        return;
      }
      setMeasurements(refreshed);
      setNotice('B2 confirmed the measurement and evaluation/flag are persisted. This is synthetic data.');
      setWeightKg('');
      setHeightCm('');
      setMuacMm('');
    } catch (cause) {
      const message = cause instanceof B2ApiError
        ? cause.message
        : cause instanceof Error ? cause.message : 'The B2 service could not save or reload this measurement.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterBeneficiary = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!api || !accessToken || !registrationDateOfBirth) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.registerBeneficiary({
        date_of_birth: registrationDateOfBirth,
        sex: registrationSex,
        ...(registrationKinship.trim() ? { caregiver_kinship: registrationKinship.trim() } : {}),
      }, accessToken);
      const refreshed = await api.listBeneficiaries(centreId, accessToken);
      const persisted = refreshed.beneficiaries.find((item) => item.beneficiary_id === saved.beneficiary.beneficiary_id);
      const registrationInput = {
        date_of_birth: registrationDateOfBirth,
        sex: registrationSex,
        ...(registrationKinship.trim() ? { caregiver_kinship: registrationKinship.trim() } : {}),
      };
      if (!persisted || !beneficiaryMatchesRegistration(saved.beneficiary, persisted, registrationInput, centreId)) {
        setError('B2 accepted the registration, but a fresh read did not verify all contract fields (identity, assigned worker, centre, date of birth, sex, and caregiver kinship). The result is unverified; refresh before retrying.');
        return;
      }
      setBeneficiaries(refreshed.beneficiaries);
      setSelectedId(persisted.beneficiary_id);
      setRefreshRevision((revision) => revision + 1);
      setNotice(`B2 confirmed beneficiary ${persisted.beneficiary_id} in the persisted list for this centre.`);
      setRegistrationDateOfBirth('');
      setRegistrationKinship('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'B2 could not confirm beneficiary registration.');
    } finally {
      setSaving(false);
    }
  };

  if (!import.meta.env.DEV) {
    return <UnavailableCard message="This synthetic workflow is available only in a development build." />;
  }

  if (authInitializing || profileStatus === 'loading') {
    return <UnavailableCard message="Waiting for a provider session and server-resolved B2 profile…" />;
  }

  if (!supabaseSession) {
    return <UnavailableCard message="A provider session is required. The local demo persona does not authenticate to B2." />;
  }

  if (!api || apiConfigurationError) {
    return <UnavailableCard message={apiConfigurationError || 'The B2 API client is unavailable.'} />;
  }

  if (profileStatus !== 'ready' || !eligibleProfile) {
    return <UnavailableCard message={apiConfigurationError || authMessage || 'B2 has not returned an active AWW profile with one server-assigned centre scope. Protected data remains unavailable.'} />;
  }

  return (
    <main className="min-h-screen bg-[#F5F9FC] px-4 py-8 text-[#0E1B2B] sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <header className="rounded-3xl border border-amber-300 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">{SYNTHETIC_LABEL}</p>
          <h1 className="mt-2 text-2xl font-semibold">Beneficiary and first-measurement workflow</h1>
          <p className="mt-2 text-sm text-amber-950">B2 is the source of truth for this view. No frontend demo records are used. Every request is re-authorized by the backend.</p>
          <p className="mt-2 font-mono text-xs text-amber-900">Server-assigned centre: {centreId}</p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="beneficiary-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="beneficiary-heading" className="text-lg font-semibold">B2 beneficiaries</h2>
              <p className="text-xs text-slate-500">IDs and scope are displayed exactly as returned by B2.</p>
            </div>
            <button type="button" onClick={() => void refreshBeneficiaries()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh from B2
            </button>
          </div>

          {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          {notice && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}
          <details className="mt-4 rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Register a beneficiary in B2</summary>
            <form onSubmit={(event) => void handleRegisterBeneficiary(event)} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Date of birth<input required type="date" value={registrationDateOfBirth} onChange={(event) => setRegistrationDateOfBirth(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
              <label className="text-sm">Sex<select value={registrationSex} onChange={(event) => setRegistrationSex(event.target.value as 'F' | 'M')} className="mt-1 block w-full rounded-lg border bg-white p-2"><option value="F">F</option><option value="M">M</option></select></label>
              <label className="text-sm">Caregiver kinship (optional)<input maxLength={80} value={registrationKinship} onChange={(event) => setRegistrationKinship(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
              <button type="submit" disabled={saving || !registrationDateOfBirth || Boolean(error)} className="self-end rounded-lg bg-[#0E1B2B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Register and verify from B2</button>
            </form>
            <p className="mt-2 text-xs text-slate-500">B2 assigns the beneficiary ID, worker, and centre from the authorized server principal. The browser sends no role or scope.</p>
          </details>
          {loading && <p className="mt-4 text-sm text-slate-500">Loading beneficiaries from B2…</p>}
          {!loading && !error && beneficiaries.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">B2 returned no beneficiaries for this server-assigned centre.</p>}
          {beneficiaries.length > 0 && (
            <label className="mt-4 block text-sm font-medium">
              Beneficiary
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm">
                {beneficiaries.map((beneficiary) => <option key={beneficiary.beneficiary_id} value={beneficiary.beneficiary_id}>{beneficiary.beneficiary_id} · {beneficiary.centre_id}</option>)}
              </select>
            </label>
          )}
        </section>

        {selectedId && (
          <section className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold">Record first measurement</h2>
                <p className="text-xs text-slate-500">B2 validates and saves the measurement with its evaluation and flag.</p>
              </div>
              <label className="block text-sm">Measurement date<input required type="date" value={measurementDate} onChange={(event) => setMeasurementDate(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">Weight (kg)<input required type="number" min="0.01" step="0.01" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2" /></label>
                <label className="block text-sm">Height (cm)<input required type="number" min="0.01" step="0.1" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2" /></label>
              </div>
              <label className="block text-sm">MUAC (mm, optional)<input type="number" min="0.01" step="0.1" value={muacMm} onChange={(event) => setMuacMm(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2" /></label>
              <div className="grid grid-cols-2 gap-3">
                <YesNo label="Oedema" value={oedema} onChange={setOedema} />
                <YesNo label="Danger sign" value={dangerSign} onChange={setDangerSign} />
              </div>
              {measurements?.measurements.length ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">A first measurement is already present; this Phase 1 view will not overwrite or append one.</p> : null}
              <button type="submit" disabled={saving || !selectedId || !measurements || Boolean(error) || Boolean(measurements.measurements.length)} className="w-full rounded-xl bg-[#0E1B2B] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Saving and confirming with B2…' : 'Save first measurement to B2'}
              </button>
            </form>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="history-heading">
              <h2 id="history-heading" className="text-lg font-semibold">Persisted measurement and evaluation</h2>
              <p className="text-xs text-slate-500">Reload this page or refresh the list to confirm records are read back from B2.</p>
              {!measurements && <p className="mt-4 text-sm text-slate-500">Loading saved measurements from B2…</p>}
              {measurements?.measurements.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No first measurement has been saved for this beneficiary.</p>}
              {measurements?.measurements.map((measurement) => {
                const flag = measurements.flags.find((item) => item.measurement_id === measurement.measurement_id);
                return (
                  <article key={measurement.measurement_id} className="mt-4 rounded-2xl border border-slate-200 p-4">
                    <p className="font-mono text-xs text-slate-500">{measurement.measurement_id} · {measurement.recorded_at}</p>
                    <p className="mt-2 text-sm">{String(measurement.weight_kg ?? '—')} kg · {String(measurement.height_cm ?? '—')} cm{measurement.muac_mm === undefined ? '' : ` · ${String(measurement.muac_mm)} mm MUAC`}</p>
                    <p className="mt-2 text-sm font-semibold">Evaluation: {measurement.evaluation.colour}</p>
                    <p className="mt-1 text-xs text-slate-600">Flag: {flag ? `${flag.flag_id} · ${flag.colour} · ${flag.needs_human_verification === true ? 'human verification required' : 'review flag'}` : 'No matching persisted flag returned'}</p>
                  </article>
                );
              })}
            </section>
          </section>
        )}
      </div>
    </main>
  );
};

const YesNo: React.FC<{ label: string; value: 'yes' | 'no'; onChange: (value: 'yes' | 'no') => void }> = ({ label, value, onChange }) => (
  <label className="block text-sm">{label}<select value={value} onChange={(event) => onChange(event.target.value as 'yes' | 'no')} className="mt-1 block w-full rounded-xl border px-3 py-2"><option value="no">No</option><option value="yes">Yes</option></select></label>
);

const UnavailableCard: React.FC<{ message: string }> = ({ message }) => (
  <main className="min-h-screen bg-[#F5F9FC] p-6 text-[#0E1B2B]">
    <section className="mx-auto mt-12 max-w-2xl rounded-3xl border border-amber-300 bg-white p-8 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-800">{SYNTHETIC_LABEL}</p>
      <h1 className="mt-3 text-2xl font-semibold">Backend workflow unavailable</h1>
      <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>
      <p className="mt-3 flex gap-2 text-xs text-slate-500"><ShieldAlert className="h-4 w-4 shrink-0" />No local demo records are used as a substitute.</p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm text-blue-700"><ArrowLeft className="h-4 w-4" /> Return home</Link>
    </section>
  </main>
);
