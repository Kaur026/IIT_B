/**
 * Small client boundary for the B2 child-registry API.
 *
 * This client does not authenticate users or decide their roles/scopes. A
 * caller must supply a bearer token from a future trusted sign-in flow; B2
 * must resolve that identity and enforce the requested centre on the server.
 * The current simulated frontend login is deliberately not accepted here.
 */

export interface B2Beneficiary {
  beneficiary_id: string;
  centre_id: string;
  assigned_worker_id: string;
  [key: string]: unknown;
}

export interface B2ListBeneficiariesResponse {
  centre_id: string;
  beneficiaries: B2Beneficiary[];
  label?: string;
}

export interface B2CreateBeneficiaryInput {
  beneficiary_id?: string;
  date_of_birth: string;
  sex: 'M' | 'F';
  caregiver_kinship?: string;
}

export interface B2CreateBeneficiaryResponse {
  beneficiary: B2Beneficiary;
  label?: string;
}

export interface B2MeasurementEvaluation {
  colour: 'RED' | 'AMBER' | 'GREEN' | 'GREY' | string;
  reasons?: unknown[];
  [key: string]: unknown;
}

export interface B2Measurement {
  measurement_id: string;
  beneficiary_id: string;
  centre_id: string;
  source: string;
  recorded_at: string;
  measurement_date?: string;
  weight_kg?: number;
  height_cm?: number;
  muac_mm?: number;
  evaluation: B2MeasurementEvaluation;
  [key: string]: unknown;
}

export interface B2Flag {
  flag_id: string;
  beneficiary_id: string;
  centre_id: string;
  measurement_id: string;
  colour: string;
  created_at: string;
  [key: string]: unknown;
}

export interface B2ListMeasurementsResponse {
  beneficiary_id: string;
  centre_id: string;
  measurements: B2Measurement[];
  flags: B2Flag[];
  label?: string;
}

export type B2TaskStatus = 'open' | 'assigned' | 'acknowledged' | 'in_progress' | 'escalated' | 'closed';

export interface B2TaskEvent {
  event: string;
  actor_id: string;
  at: string;
  details: Record<string, unknown>;
}

export interface B2Task {
  task_id: string;
  beneficiary_id: string;
  centre_id: string;
  flag_id: string;
  child_id: string;
  status: B2TaskStatus;
  owner_id: string | null;
  owner_role: string;
  alert_level: string;
  colour: string;
  created_on: string;
  due_on: string;
  escalation_level: number;
  events: B2TaskEvent[];
  [key: string]: unknown;
}

export interface B2ListTasksResponse {
  centre_id: string;
  tasks: B2Task[];
  label?: string;
}

export type B2TaskAction = 'acknowledge' | 'start' | 'record_progress';

export interface B2TaskProgressSnapshot {
  progressNotes: unknown[];
  events: unknown[];
}

export type B2TaskProgressReadback = 'committed' | 'not_committed' | 'ambiguous';
export interface B2TaskProgressAttempt {
  status: B2TaskProgressReadback;
  phase: 'post' | 'readback' | 'verification';
  before: B2TaskProgressSnapshot;
  task?: B2Task;
  tasks?: B2Task[];
}

export function snapshotTaskProgress(task: B2Task): B2TaskProgressSnapshot {
  return {
    progressNotes: Array.isArray(task.progress_notes) ? [...task.progress_notes] : [],
    events: [...task.events],
  };
}

/** The current API has no progress-event ID or idempotency key. */
export function verifyTaskProgressReadback(
  before: B2TaskProgressSnapshot,
  after: B2Task,
  note: string,
): B2TaskProgressReadback {
  const progressNotes = Array.isArray(after.progress_notes) ? after.progress_notes : [];
  const events = after.events;
  const same = (left: unknown[], right: unknown[]) => JSON.stringify(left) === JSON.stringify(right);
  if (same(before.progressNotes, progressNotes) && same(before.events, events)) return 'not_committed';

  const appendedNote = progressNotes.at(-1) as Record<string, unknown> | undefined;
  const appendedEvent = events.at(-1) as unknown as Record<string, unknown> | undefined;
  const eventDetails = appendedEvent?.details as Record<string, unknown> | undefined;
  const exactSingleAppend = progressNotes.length === before.progressNotes.length + 1
    && events.length === before.events.length + 1
    && same(before.progressNotes, progressNotes.slice(0, -1))
    && same(before.events, events.slice(0, -1))
    && appendedNote?.note === note
    && appendedEvent?.event === 'progress_recorded'
    && eventDetails?.note === note;
  return exactSingleAppend ? 'committed' : 'ambiguous';
}

export async function submitAndVerifyTaskProgress(
  task: B2Task,
  note: string,
  submit: () => Promise<B2Task>,
  readFresh: () => Promise<B2Task[]>,
): Promise<B2TaskProgressAttempt> {
  const before = snapshotTaskProgress(task);
  let saved: B2Task;
  try {
    saved = await submit();
  } catch {
    return { status: 'ambiguous', phase: 'post', before };
  }
  let tasks: B2Task[];
  try {
    tasks = await readFresh();
  } catch {
    return { status: 'ambiguous', phase: 'readback', before };
  }
  const persisted = tasks.find((item) => item.task_id === task.task_id);
  if (!persisted || saved.status !== 'in_progress') {
    return { status: 'ambiguous', phase: 'verification', before, task: persisted };
  }
  return {
    status: verifyTaskProgressReadback(before, persisted, note),
    phase: 'verification',
    before,
    task: persisted,
    tasks,
  };
}

export function measurementMatchesSubmission(
  persisted: B2Measurement,
  flag: B2Flag,
  input: B2RecordMeasurementInput,
  centreId: string,
): boolean {
  const expected = input.measurement;
  const sourceValues = typeof flag.source_values === 'object' && flag.source_values !== null
    ? flag.source_values as Record<string, unknown> : null;
  const sourceValuesMatch = !sourceValues || [
    'measurement_date', 'weight_kg', 'height_cm', 'muac_mm', 'oedema', 'danger_sign',
  ].every((field) => !(field in sourceValues)
    || (sourceValues[field] == null && persisted[field] == null)
    || sourceValues[field] === persisted[field]);
  return persisted.beneficiary_id === input.beneficiary_id
    && persisted.centre_id === centreId
    && persisted.recorded_at === input.recorded_at
    && persisted.measurement_date === expected.measurement_date
    && persisted.weight_kg === expected.weight_kg
    && persisted.height_cm === expected.height_cm
    && (expected.muac_mm === undefined ? persisted.muac_mm == null : persisted.muac_mm === expected.muac_mm)
    && (expected.oedema === undefined ? persisted.oedema == null : persisted.oedema === expected.oedema)
    && (expected.danger_sign === undefined ? persisted.danger_sign == null : persisted.danger_sign === expected.danger_sign)
    && flag.measurement_id === persisted.measurement_id
    && flag.beneficiary_id === persisted.beneficiary_id
    && flag.centre_id === persisted.centre_id
    && flag.colour === persisted.evaluation.colour
    && sourceValuesMatch
    && (!('who' in flag) || flag.who === persisted.evaluation.who)
    && (!('reasons' in flag) || JSON.stringify(flag.reasons) === JSON.stringify(persisted.evaluation.reasons))
    && (!('confidence' in flag) || flag.confidence === persisted.evaluation.confidence)
    && (!('confidence_note' in flag) || flag.confidence_note === persisted.evaluation.confidence_note);
}

export function beneficiaryMatchesRegistration(
  saved: B2Beneficiary,
  persisted: B2Beneficiary,
  input: B2CreateBeneficiaryInput,
  centreId: string,
): boolean {
  const caregiver = input.caregiver_kinship?.trim() || '';
  return Boolean(saved.beneficiary_id)
    && persisted.beneficiary_id === saved.beneficiary_id
    && saved.centre_id === centreId
    && persisted.centre_id === centreId
    && Boolean(saved.assigned_worker_id)
    && persisted.assigned_worker_id === saved.assigned_worker_id
    && saved.date_of_birth === input.date_of_birth
    && persisted.date_of_birth === input.date_of_birth
    && saved.sex === input.sex
    && persisted.sex === input.sex
    && saved.caregiver_kinship === caregiver
    && persisted.caregiver_kinship === caregiver;
}

export interface B2Referral {
  referral_id: string;
  beneficiary_id: string;
  centre_id: string;
  task_id: string;
  referral_kind: 'general' | 'deic';
  destination: string;
  reason_code: string;
  status: 'sent' | 'acknowledged' | 'attended' | 'outcome_recorded' | 'not_needed';
  created_at: string;
  sent_by: string;
  due_on: string | null;
  timeline: unknown[];
  [key: string]: unknown;
}

export interface B2ListReferralsResponse {
  centre_id: string;
  as_of: string;
  referrals: B2Referral[];
  label?: string;
}

export interface B2AccessException {
  exception_id: string;
  beneficiary_id: string;
  centre_id: string;
  task_id: string;
  exception_type: string;
  status: 'open' | 'resolved';
  opened_by: string;
  opened_at: string;
  resolution_code: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  [key: string]: unknown;
}

export interface B2ListAccessExceptionsResponse {
  centre_id: string;
  exceptions: B2AccessException[];
  label?: string;
}

export interface B2BriefingResponse {
  centre_id?: string;
  scope?: string;
  as_of: string;
  counts: Record<string, unknown>;
  counts_source?: string;
  label?: string;
}

export type B2ReferralAction = 'acknowledge' | 'attend' | 'record_outcome';

export interface B2RecordMeasurementInput {
  beneficiary_id: string;
  measurement: {
    measurement_date: string;
    weight_kg: number;
    height_cm: number;
    muac_mm?: number;
    oedema?: 'yes' | 'no';
    danger_sign?: 'yes' | 'no';
  };
  recorded_at: string;
}

export interface B2RecordMeasurementResponse {
  measurement: B2Measurement;
  flag: B2Flag;
  history_link: string;
  label?: string;
}

export type B2ApplicationRole =
  | 'User'
  | 'AWW'
  | 'LS'
  | 'CDPO'
  | 'DPO'
  | 'System Administrator'
  | 'Rule Administrator';

export type B2OrganizationScopeType = 'centre' | 'sector' | 'project' | 'district';

export interface B2MyProfile {
  subject_id: string | null;
  role: B2ApplicationRole;
  scopes: Array<{ type: B2OrganizationScopeType; id: string }>;
  is_active: boolean;
  identity_mode: 'supabase' | 'demo';
  demo: boolean;
  label?: string;
}

export type B2ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'service_unavailable'
  | 'server_error'
  | 'network_error';

const SAFE_MESSAGES: Record<B2ApiErrorCode, string> = {
  unauthorized: 'Sign-in is required to use the B2 registry.',
  forbidden: 'Your assigned role or organization scope does not allow this action.',
  not_found: 'The requested record was not found.',
  invalid_request: 'The request could not be accepted. Check the entered fields.',
  service_unavailable: 'Authorization is temporarily unavailable. Please try again shortly.',
  server_error: 'The B2 service could not complete the request.',
  network_error: 'The B2 service could not be reached.',
};

export class B2ApiError extends Error {
  readonly status: number;
  readonly code: B2ApiErrorCode;

  constructor(status: number, code: B2ApiErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = 'B2ApiError';
    this.status = status;
    this.code = code;
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isBeneficiary(value: unknown): value is B2Beneficiary {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.beneficiary_id === 'string'
    && typeof record.centre_id === 'string'
    && typeof record.assigned_worker_id === 'string';
}

function isMeasurement(value: unknown): value is B2Measurement {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.measurement_id === 'string' && Boolean(record.measurement_id)
    && typeof record.beneficiary_id === 'string' && Boolean(record.beneficiary_id)
    && typeof record.centre_id === 'string' && Boolean(record.centre_id)
    && typeof record.source === 'string' && typeof record.recorded_at === 'string'
    && typeof record.evaluation === 'object' && record.evaluation !== null
    && typeof (record.evaluation as Record<string, unknown>).colour === 'string';
}

function isFlag(value: unknown): value is B2Flag {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.flag_id === 'string' && Boolean(record.flag_id)
    && typeof record.beneficiary_id === 'string' && Boolean(record.beneficiary_id)
    && typeof record.centre_id === 'string' && Boolean(record.centre_id)
    && typeof record.measurement_id === 'string' && Boolean(record.measurement_id)
    && typeof record.colour === 'string' && typeof record.created_at === 'string';
}

const TASK_STATUSES: readonly string[] = ['open', 'assigned', 'acknowledged', 'in_progress', 'escalated', 'closed'];
const REFERRAL_STATUSES: readonly string[] = ['sent', 'acknowledged', 'attended', 'outcome_recorded', 'not_needed'];

function isTask(value: unknown): value is B2Task {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Record<string, unknown>;
  const validEvents = Array.isArray(task.events) && task.events.every((value) => {
    if (typeof value !== 'object' || value === null) return false;
    const event = value as unknown as Record<string, unknown>;
    return typeof event.event === 'string' && typeof event.actor_id === 'string'
      && typeof event.at === 'string' && typeof event.details === 'object'
      && event.details !== null && !Array.isArray(event.details);
  });
  return typeof task.task_id === 'string' && Boolean(task.task_id)
    && typeof task.beneficiary_id === 'string' && Boolean(task.beneficiary_id)
    && typeof task.centre_id === 'string' && Boolean(task.centre_id)
    && typeof task.flag_id === 'string' && Boolean(task.flag_id)
    && typeof task.child_id === 'string' && Boolean(task.child_id)
    && TASK_STATUSES.includes(String(task.status))
    && (task.owner_id === null || typeof task.owner_id === 'string')
    && typeof task.owner_role === 'string'
    && typeof task.alert_level === 'string'
    && typeof task.colour === 'string'
    && typeof task.created_on === 'string' && typeof task.due_on === 'string'
    && typeof task.escalation_level === 'number' && Number.isInteger(task.escalation_level)
    && validEvents;
}

function isReferral(value: unknown): value is B2Referral {
  if (typeof value !== 'object' || value === null) return false;
  const referral = value as Record<string, unknown>;
  return typeof referral.referral_id === 'string' && Boolean(referral.referral_id)
    && typeof referral.beneficiary_id === 'string' && Boolean(referral.beneficiary_id)
    && typeof referral.centre_id === 'string' && Boolean(referral.centre_id)
    && typeof referral.task_id === 'string'
    && ['general', 'deic'].includes(String(referral.referral_kind))
    && typeof referral.destination === 'string' && typeof referral.reason_code === 'string'
    && REFERRAL_STATUSES.includes(String(referral.status))
    && typeof referral.created_at === 'string' && typeof referral.sent_by === 'string'
    && (referral.due_on === null || typeof referral.due_on === 'string')
    && Array.isArray(referral.timeline);
}

function isAccessException(value: unknown): value is B2AccessException {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.exception_id === 'string' && Boolean(record.exception_id)
    && typeof record.beneficiary_id === 'string' && Boolean(record.beneficiary_id)
    && typeof record.centre_id === 'string' && Boolean(record.centre_id)
    && typeof record.task_id === 'string' && typeof record.exception_type === 'string'
    && ['open', 'resolved'].includes(String(record.status))
    && typeof record.opened_by === 'string' && typeof record.opened_at === 'string'
    && (record.resolution_code === null || typeof record.resolution_code === 'string')
    && (record.resolved_by === null || typeof record.resolved_by === 'string')
    && (record.resolved_at === null || typeof record.resolved_at === 'string');
}

function isMyProfile(value: unknown): value is B2MyProfile {
  if (typeof value !== 'object' || value === null) return false;
  const profile = value as Record<string, unknown>;
  const roles: readonly string[] = [
    'User', 'AWW', 'LS', 'CDPO', 'DPO', 'System Administrator', 'Rule Administrator',
  ];
  const scopeTypes: readonly string[] = ['centre', 'sector', 'project', 'district'];
  if (!roles.includes(String(profile.role))
      || !Array.isArray(profile.scopes)
      || profile.is_active !== true
      || !['supabase', 'demo'].includes(String(profile.identity_mode))
      || typeof profile.demo !== 'boolean'
      || profile.demo !== (profile.identity_mode === 'demo')) return false;
  if (profile.identity_mode === 'supabase' && (typeof profile.subject_id !== 'string' || !profile.subject_id)) return false;
  if (profile.identity_mode === 'demo' && profile.subject_id !== null) return false;
  return profile.scopes.every((scope) => {
    if (typeof scope !== 'object' || scope === null) return false;
    const entry = scope as Record<string, unknown>;
    return scopeTypes.includes(String(entry.type)) && typeof entry.id === 'string' && Boolean(entry.id);
  });
}

function responseError(status: number): B2ApiError {
  if (status === 401) return new B2ApiError(status, 'unauthorized');
  if (status === 403) return new B2ApiError(status, 'forbidden');
  if (status === 404) return new B2ApiError(status, 'not_found');
  if (status === 400 || status === 409 || status === 422) {
    return new B2ApiError(status, 'invalid_request');
  }
  if (status === 503) return new B2ApiError(status, 'service_unavailable');
  return new B2ApiError(status, 'server_error');
}

function parseResponse<T>(body: unknown, key?: string): T {
  if (typeof body !== 'object' || body === null) {
    throw new B2ApiError(502, 'server_error');
  }
  if (key !== undefined) {
    const value = (body as Record<string, unknown>)[key];
    if (value === undefined) throw new B2ApiError(502, 'server_error');
    return value as T;
  }
  return body as T;
}

export function createB2ApiClient(baseUrl: string, fetchImpl: FetchLike = fetch) {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TypeError('A valid B2 API base URL is required.');
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const secureTransport = parsed.protocol === 'https:'
    || (parsed.protocol === 'http:' && loopbackHosts.has(parsed.hostname));
  if (!secureTransport || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError('The B2 API URL must use HTTPS (HTTP is allowed only on loopback) and omit credentials/query data.');
  }
  const root = parsed.toString().replace(/\/$/, '');

  async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    if (typeof accessToken !== 'string' || !accessToken.trim()) {
      throw new B2ApiError(401, 'unauthorized');
    }
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        ...init,
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...init.headers,
        },
      });
    } catch {
      throw new B2ApiError(0, 'network_error');
    }
    if (!response.ok) throw responseError(response.status);
    try {
      return await response.json() as T;
    } catch {
      throw new B2ApiError(502, 'server_error');
    }
  }

  return {
    async getMyProfile(accessToken: string): Promise<B2MyProfile> {
      const body = await request<unknown>('/api/me', accessToken);
      if (!isMyProfile(body)) throw new B2ApiError(502, 'server_error');
      return body;
    },

    async listBeneficiaries(centreId: string, accessToken: string): Promise<B2ListBeneficiariesResponse> {
      if (!centreId.trim()) throw new TypeError('A centre ID is required for the list request.');
      const query = new URLSearchParams({ centre_id: centreId });
      const body = await request<unknown>(`/api/beneficiaries?${query}`, accessToken);
      const result = parseResponse<B2ListBeneficiariesResponse>(body);
      if (!Array.isArray(result.beneficiaries)
          || !result.beneficiaries.every(isBeneficiary)
          || result.centre_id !== centreId
          || result.beneficiaries.some((beneficiary) => beneficiary.centre_id !== centreId)) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async listMeasurements(beneficiaryId: string, accessToken: string): Promise<B2ListMeasurementsResponse> {
      if (!beneficiaryId.trim()) throw new TypeError('A beneficiary ID is required for the measurement request.');
      const body = await request<unknown>(`/api/beneficiaries/${encodeURIComponent(beneficiaryId)}/measurements`, accessToken);
      const result = parseResponse<B2ListMeasurementsResponse>(body);
      if (result.beneficiary_id !== beneficiaryId
          || typeof result.centre_id !== 'string' || !result.centre_id
          || !Array.isArray(result.measurements) || !result.measurements.every(isMeasurement)
          || !Array.isArray(result.flags) || !result.flags.every(isFlag)
          || result.measurements.some((record) => record.beneficiary_id !== beneficiaryId || record.centre_id !== result.centre_id)
          || result.flags.some((flag) => flag.beneficiary_id !== beneficiaryId || flag.centre_id !== result.centre_id)) {
        throw new B2ApiError(502, 'server_error');
      }
      const measurementIds = new Set(result.measurements.map((record) => record.measurement_id));
      const measurementsById = new Map(result.measurements.map((record) => [record.measurement_id, record]));
      const flagsByMeasurement = new Map<string, B2Flag[]>();
      for (const flag of result.flags) {
        const matching = flagsByMeasurement.get(flag.measurement_id) || [];
        matching.push(flag);
        flagsByMeasurement.set(flag.measurement_id, matching);
      }
      if (result.measurements.some((measurement) => flagsByMeasurement.get(measurement.measurement_id)?.length !== 1)
          || result.flags.some((flag) => {
        const measurement = measurementsById.get(flag.measurement_id);
        return !measurement || !measurementIds.has(flag.measurement_id)
          || measurement.beneficiary_id !== flag.beneficiary_id
          || measurement.centre_id !== flag.centre_id
          || measurement.evaluation.colour !== flag.colour
          || ('who' in flag && measurement.evaluation.who !== flag.who)
          || ('reasons' in flag && JSON.stringify(measurement.evaluation.reasons) !== JSON.stringify(flag.reasons))
          || ('confidence' in flag && measurement.evaluation.confidence !== flag.confidence)
          || ('confidence_note' in flag && measurement.evaluation.confidence_note !== flag.confidence_note);
      })) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async recordFirstMeasurement(input: B2RecordMeasurementInput, accessToken: string): Promise<B2RecordMeasurementResponse> {
      if (!input.beneficiary_id.trim()) throw new TypeError('A beneficiary ID is required for the measurement request.');
      const payload: B2RecordMeasurementInput = {
        beneficiary_id: input.beneficiary_id,
        measurement: {
          measurement_date: input.measurement.measurement_date,
          weight_kg: input.measurement.weight_kg,
          height_cm: input.measurement.height_cm,
          ...(input.measurement.muac_mm === undefined ? {} : { muac_mm: input.measurement.muac_mm }),
          ...(input.measurement.oedema === undefined ? {} : { oedema: input.measurement.oedema }),
          ...(input.measurement.danger_sign === undefined ? {} : { danger_sign: input.measurement.danger_sign }),
        },
        recorded_at: input.recorded_at,
      };
      const body = await request<unknown>('/api/measurements', accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const record = parseResponse<B2RecordMeasurementResponse>(body);
      if (!isMeasurement(record.measurement) || !isFlag(record.flag)
          || record.measurement.beneficiary_id !== input.beneficiary_id
          || record.flag.beneficiary_id !== input.beneficiary_id
          || record.flag.measurement_id !== record.measurement.measurement_id
          || record.flag.centre_id !== record.measurement.centre_id
          || record.flag.colour !== record.measurement.evaluation.colour
          || typeof record.history_link !== 'string') {
        throw new B2ApiError(502, 'server_error');
      }
      return record;
    },

    async getBriefing(centreId: string | undefined, accessToken: string): Promise<B2BriefingResponse> {
      const query = centreId ? `?${new URLSearchParams({ centre_id: centreId })}` : '';
      const body = await request<unknown>(`/api/briefing${query}`, accessToken);
      const result = parseResponse<B2BriefingResponse>(body);
      const counts = result.counts;
      if (typeof result.as_of !== 'string' || !counts || typeof counts !== 'object'
          || !Number.isFinite(counts.flags) || !Number.isFinite(counts.tasks)
          || !Number.isFinite(counts.active_tasks)
          || (centreId !== undefined && result.centre_id !== centreId)
          || (result.scope !== undefined && typeof result.scope !== 'string')) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async listTasks(centreId: string, accessToken: string): Promise<B2ListTasksResponse> {
      if (!centreId.trim()) throw new TypeError('A centre ID is required for the task list request.');
      const query = new URLSearchParams({ centre_id: centreId });
      const body = await request<unknown>(`/api/tasks?${query}`, accessToken);
      const result = parseResponse<B2ListTasksResponse>(body);
      if (!Array.isArray(result.tasks) || !result.tasks.every(isTask)
          || result.centre_id !== centreId
          || result.tasks.some((task) => task.centre_id !== centreId)) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async applyTaskAction(taskId: string, action: B2TaskAction, accessToken: string,
                          details: { notes?: string; on?: string } = {}): Promise<{ task: B2Task; label?: string }> {
      if (!taskId.trim()) throw new TypeError('A task ID is required for the action request.');
      if (action === 'record_progress' && !details.notes?.trim()) {
        throw new TypeError('Progress notes are required for this task action.');
      }
      const body = await request<unknown>(`/api/tasks/${encodeURIComponent(taskId)}/actions`, accessToken, {
        method: 'POST',
        body: JSON.stringify({
          action,
          ...(details.notes === undefined ? {} : { notes: details.notes }),
          ...(details.on === undefined ? {} : { on: details.on }),
        }),
      });
      const result = parseResponse<{ task: B2Task; label?: string }>(body);
      if (!isTask(result.task) || result.task.task_id !== taskId) throw new B2ApiError(502, 'server_error');
      return result;
    },

    async listReferrals(centreId: string, accessToken: string): Promise<B2ListReferralsResponse> {
      if (!centreId.trim()) throw new TypeError('A centre ID is required for the referral list request.');
      const query = new URLSearchParams({ centre_id: centreId });
      const body = await request<unknown>(`/api/referrals?${query}`, accessToken);
      const result = parseResponse<B2ListReferralsResponse>(body);
      if (result.centre_id !== centreId || typeof result.as_of !== 'string'
          || !Array.isArray(result.referrals) || !result.referrals.every(isReferral)
          || result.referrals.some((referral) => referral.centre_id !== centreId)) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async createReferral(input: {
      beneficiary_id: string;
      referral_kind: 'general' | 'deic';
      destination: string;
      reason_code: string;
      task_id?: string;
      due_on?: string;
    }, accessToken: string): Promise<{ referral: B2Referral; label?: string }> {
      const payload = {
        beneficiary_id: input.beneficiary_id,
        referral_kind: input.referral_kind,
        destination: input.destination,
        reason_code: input.reason_code,
        ...(input.task_id ? { task_id: input.task_id } : {}),
        ...(input.due_on ? { due_on: input.due_on } : {}),
      };
      const body = await request<unknown>('/api/referrals', accessToken, { method: 'POST', body: JSON.stringify(payload) });
      const result = parseResponse<{ referral: B2Referral; label?: string }>(body);
      if (!isReferral(result.referral) || result.referral.beneficiary_id !== input.beneficiary_id
          || (input.task_id && result.referral.task_id !== input.task_id)) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async applyReferralAction(referralId: string, action: B2ReferralAction, accessToken: string,
                              outcomeCode?: string): Promise<{ referral: B2Referral; label?: string }> {
      if (!referralId.trim()) throw new TypeError('A referral ID is required for the action request.');
      if (action === 'record_outcome' && !outcomeCode?.trim()) {
        throw new TypeError('An outcome code is required to record a referral outcome.');
      }
      const body = await request<unknown>(`/api/referrals/${encodeURIComponent(referralId)}/actions`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ action, ...(outcomeCode === undefined ? {} : { outcome_code: outcomeCode }) }),
      });
      const result = parseResponse<{ referral: B2Referral; label?: string }>(body);
      if (!isReferral(result.referral) || result.referral.referral_id !== referralId) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async listAccessExceptions(centreId: string, accessToken: string): Promise<B2ListAccessExceptionsResponse> {
      if (!centreId.trim()) throw new TypeError('A centre ID is required for the exception list request.');
      const query = new URLSearchParams({ centre_id: centreId });
      const body = await request<unknown>(`/api/access-exceptions?${query}`, accessToken);
      const result = parseResponse<B2ListAccessExceptionsResponse>(body);
      if (result.centre_id !== centreId || !Array.isArray(result.exceptions)
          || !result.exceptions.every(isAccessException)
          || result.exceptions.some((record) => record.centre_id !== centreId)) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async createAccessException(input: {
      beneficiary_id: string;
      exception_type: string;
      task_id?: string;
    }, accessToken: string): Promise<{ exception: B2AccessException; label?: string }> {
      const body = await request<unknown>('/api/access-exceptions', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          beneficiary_id: input.beneficiary_id,
          exception_type: input.exception_type,
          ...(input.task_id ? { task_id: input.task_id } : {}),
        }),
      });
      const result = parseResponse<{ exception: B2AccessException; label?: string }>(body);
      if (!isAccessException(result.exception) || result.exception.beneficiary_id !== input.beneficiary_id
          || result.exception.exception_type !== input.exception_type) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async resolveAccessException(exceptionId: string, resolutionCode: string,
                                  accessToken: string): Promise<{ exception: B2AccessException; label?: string }> {
      if (!exceptionId.trim() || !resolutionCode.trim()) throw new TypeError('An exception ID and resolution code are required.');
      const body = await request<unknown>(`/api/access-exceptions/${encodeURIComponent(exceptionId)}/resolve`, accessToken, {
        method: 'POST', body: JSON.stringify({ resolution_code: resolutionCode }),
      });
      const result = parseResponse<{ exception: B2AccessException; label?: string }>(body);
      if (!isAccessException(result.exception) || result.exception.exception_id !== exceptionId
          || result.exception.status !== 'resolved' || result.exception.resolution_code !== resolutionCode) {
        throw new B2ApiError(502, 'server_error');
      }
      return result;
    },

    async registerBeneficiary(input: B2CreateBeneficiaryInput, accessToken: string): Promise<B2CreateBeneficiaryResponse> {
      // Explicitly construct the backend contract. Browser role, centre, and
      // worker values are never copied into this request.
      const payload: B2CreateBeneficiaryInput = {
        ...(input.beneficiary_id === undefined ? {} : { beneficiary_id: input.beneficiary_id }),
        date_of_birth: input.date_of_birth,
        sex: input.sex,
        ...(input.caregiver_kinship === undefined ? {} : { caregiver_kinship: input.caregiver_kinship }),
      };
      const body = await request<unknown>('/api/beneficiaries', accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const beneficiary = parseResponse<B2Beneficiary>(body, 'beneficiary');
      if (!isBeneficiary(beneficiary)) {
        throw new B2ApiError(502, 'server_error');
      }
      const label = (body as Record<string, unknown>).label;
      return {
        beneficiary,
        ...(typeof label === 'string' ? { label } : {}),
      };
    },
  };
}

/** Authenticated operational API surface; distinct from B1 and browser-demo sources. */
export type B2OperationalApi = ReturnType<typeof createB2ApiClient>;
