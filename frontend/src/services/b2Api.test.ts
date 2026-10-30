import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { B2ApiError, beneficiaryMatchesRegistration, createB2ApiClient, measurementMatchesSubmission, snapshotTaskProgress, submitAndVerifyTaskProgress, verifyTaskProgressReadback } from './b2Api.ts';

test('getMyProfile reads the server-resolved profile with a supplied bearer token', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const client = createB2ApiClient('https://api.example.test', async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return Response.json({
      subject_id: 'd4f2a64c-9cf9-4e2f-87c3-916a9c07af22',
      role: 'AWW', scopes: [{ type: 'centre', id: 'CTR-1' }],
      is_active: true, identity_mode: 'supabase', demo: false,
    });
  });

  const profile = await client.getMyProfile('provider-issued-test-token');
  assert.equal(seenUrl, 'https://api.example.test/api/me');
  assert.equal(new Headers(seenInit?.headers).get('Authorization'), 'Bearer provider-issued-test-token');
  assert.equal(profile.role, 'AWW');
  assert.deepEqual(profile.scopes, [{ type: 'centre', id: 'CTR-1' }]);
  assert.equal(profile.demo, false);
});

test('getMyProfile rejects missing credentials and malformed profile payloads', async () => {
  const client = createB2ApiClient('https://api.example.test', async () => Response.json({
    subject_id: null, role: 'DPO', scopes: [{ type: 'district', id: 'DST-1' }],
    is_active: true, identity_mode: 'supabase', demo: false,
  }));
  await assert.rejects(client.getMyProfile(''), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'unauthorized');
  await assert.rejects(client.getMyProfile('test-token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');
});

test('list uses the B2 endpoint and bearer identity without sending role or scope claims', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const client = createB2ApiClient('http://localhost:8000/', async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return Response.json({ centre_id: 'CTR-1', beneficiaries: [], label: 'synthetic' });
  });

  const response = await client.listBeneficiaries('CTR-1', 'test-access-token');

  assert.equal(response.beneficiaries.length, 0);
  assert.equal(seenUrl, 'http://localhost:8000/api/beneficiaries?centre_id=CTR-1');
  assert.equal(new Headers(seenInit?.headers).get('Authorization'), 'Bearer test-access-token');
  assert.equal(seenInit?.credentials, 'omit');
  assert.equal(seenInit?.redirect, 'error');
  assert.ok(seenInit?.signal instanceof AbortSignal);
  assert.equal(JSON.stringify(seenInit).includes('role'), false);
  assert.equal(JSON.stringify(seenInit).includes('worker'), false);
});

test('measurement history validates beneficiary, centre, measurement, and flag linkage', async () => {
  let seenUrl = '';
  const measurement = {
    measurement_id: 'PAL-IT-MEA-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', source: 'initial', recorded_at: '2026-10-15',
    weight_kg: 7, height_cm: 64, evaluation: { colour: 'RED', reasons: ['synthetic test reason'] },
  };
  const flag = {
    flag_id: 'PAL-IT-FLAG-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', measurement_id: measurement.measurement_id,
    colour: 'RED', created_at: '2026-10-15',
  };
  const client = createB2ApiClient('http://localhost:8000', async (url) => {
    seenUrl = String(url);
    return Response.json({
      beneficiary_id: 'PAL-IT-BEN-001', centre_id: 'PAL-IT-CENTRE-001',
      measurements: [measurement], flags: [flag], label: 'synthetic',
    });
  });

  const result = await client.listMeasurements('PAL-IT-BEN-001', 'test-access-token');
  assert.equal(seenUrl, 'http://localhost:8000/api/beneficiaries/PAL-IT-BEN-001/measurements');
  assert.equal(result.measurements[0].evaluation.colour, 'RED');
  assert.equal(result.flags[0].measurement_id, result.measurements[0].measurement_id);

  const mismatched = createB2ApiClient('http://localhost:8000', async () => Response.json({
    beneficiary_id: 'PAL-IT-BEN-001', centre_id: 'PAL-IT-CENTRE-001',
    measurements: [measurement], flags: [{ ...flag, measurement_id: 'unrelated-measurement' }],
  }));
  await assert.rejects(mismatched.listMeasurements('PAL-IT-BEN-001', 'test-access-token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');
});

test('fresh measurement verification compares every submitted value and persisted flag linkage', () => {
  const measurement = {
    measurement_id: 'PAL-IT-MEA-VERIFY', beneficiary_id: 'PAL-IT-BEN-001', centre_id: 'PAL-IT-CENTRE-001',
    source: 'initial', recorded_at: '2026-10-15', measurement_date: '2026-10-15',
    weight_kg: 7, height_cm: 64, muac_mm: 115, oedema: 'no', danger_sign: 'yes',
    evaluation: { colour: 'RED', who: 'child', reasons: ['synthetic reason'], confidence: 0.8, confidence_note: 'review' },
  };
  const flag = {
    flag_id: 'PAL-IT-FLAG-VERIFY', beneficiary_id: measurement.beneficiary_id,
    centre_id: measurement.centre_id, measurement_id: measurement.measurement_id,
    colour: 'RED', created_at: '2026-10-15', who: 'child', reasons: ['synthetic reason'],
    confidence: 0.8, confidence_note: 'review',
    source_values: { measurement_date: '2026-10-15', weight_kg: 7, height_cm: 64, muac_mm: 115, oedema: 'no', danger_sign: 'yes' },
  };
  const input = {
    beneficiary_id: measurement.beneficiary_id,
    measurement: { measurement_date: '2026-10-15', weight_kg: 7, height_cm: 64, muac_mm: 115, oedema: 'no' as const, danger_sign: 'yes' as const },
    recorded_at: '2026-10-15',
  };
  assert.equal(measurementMatchesSubmission(measurement, flag, input, 'PAL-IT-CENTRE-001'), true);
  const altered: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ['beneficiary', { ...measurement, beneficiary_id: 'PAL-IT-BEN-OTHER' }, flag],
    ['centre', { ...measurement, centre_id: 'PAL-IT-CENTRE-OTHER' }, flag],
    ['weight', { ...measurement, weight_kg: 7.1 }, flag],
    ['height', { ...measurement, height_cm: 64.1 }, flag],
    ['MUAC', { ...measurement, muac_mm: 116 }, flag],
    ['date', { ...measurement, measurement_date: undefined }, flag],
    ['missing required weight', { ...measurement, weight_kg: undefined }, flag],
    ['missing required height', { ...measurement, height_cm: undefined }, flag],
    ['oedema', { ...measurement, oedema: 'yes' }, flag],
    ['danger sign', { ...measurement, danger_sign: 'no' }, flag],
    ['flag ID linkage', measurement, { ...flag, measurement_id: 'PAL-IT-MEA-OTHER' }],
    ['flag beneficiary linkage', measurement, { ...flag, beneficiary_id: 'PAL-IT-BEN-OTHER' }],
    ['flag centre linkage', measurement, { ...flag, centre_id: 'PAL-IT-CENTRE-OTHER' }],
    ['flag evaluation detail', measurement, { ...flag, reasons: ['different'] }],
    ['flag source values', measurement, { ...flag, source_values: { ...flag.source_values, weight_kg: 8 } }],
  ];
  for (const [name, candidate, candidateFlag] of altered) {
    assert.equal(measurementMatchesSubmission(candidate as never, candidateFlag as never, input, 'PAL-IT-CENTRE-001'), false, name);
  }
});

test('registration verification requires every promised demographic field and server assignment', () => {
  const input = { date_of_birth: '2025-01-01', sex: 'F' as const, caregiver_kinship: 'Mother' };
  const record = {
    beneficiary_id: 'PAL-IT-BEN-REGISTERED', centre_id: 'PAL-IT-CENTRE-001', assigned_worker_id: 'PAL-IT-WORKER-001',
    date_of_birth: input.date_of_birth, sex: input.sex, caregiver_kinship: input.caregiver_kinship,
  };
  assert.equal(beneficiaryMatchesRegistration(record, record, input, 'PAL-IT-CENTRE-001'), true);
  assert.equal(beneficiaryMatchesRegistration(record, { ...record, date_of_birth: undefined }, input, 'PAL-IT-CENTRE-001'), false);
  assert.equal(beneficiaryMatchesRegistration(record, { ...record, sex: 'M' }, input, 'PAL-IT-CENTRE-001'), false);
  assert.equal(beneficiaryMatchesRegistration(record, { ...record, caregiver_kinship: undefined }, input, 'PAL-IT-CENTRE-001'), false);
  assert.equal(beneficiaryMatchesRegistration({ ...record, assigned_worker_id: '' }, record, input, 'PAL-IT-CENTRE-001'), false);
  assert.equal(beneficiaryMatchesRegistration(record, { ...record, beneficiary_id: 'PAL-IT-BEN-OTHER' }, input, 'PAL-IT-CENTRE-001'), false);
  assert.equal(beneficiaryMatchesRegistration(record, { ...record, centre_id: 'PAL-IT-CENTRE-OTHER' }, input, 'PAL-IT-CENTRE-001'), false);
});

test('task progress read-back distinguishes existing duplicate text, one append, and stale or concurrent data', () => {
  const task = {
    task_id: 'PAL-IT-TASK-PROGRESS', child_id: 'PAL-IT-BEN-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', flag_id: 'PAL-IT-FLAG-001', status: 'in_progress' as const,
    owner_id: 'PAL-IT-WORKER-001', owner_role: 'worker', alert_level: 'urgent', colour: 'RED',
    created_on: '2026-10-15', due_on: '2026-10-17', escalation_level: 0,
    progress_notes: [{ actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', note: 'same note' }],
    events: [{ event: 'started', actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', details: {} }],
  };
  const before = snapshotTaskProgress(task);
  const appended = {
    ...task,
    progress_notes: [...task.progress_notes, { actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', note: 'same note' }],
    events: [...task.events, { event: 'progress_recorded', actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', details: { note: 'same note' } }],
  };
  assert.equal(verifyTaskProgressReadback(before, appended, 'same note'), 'committed');
  assert.equal(verifyTaskProgressReadback(before, task, 'same note'), 'not_committed');
  assert.equal(verifyTaskProgressReadback(before, { ...appended, events: [...appended.events, { event: 'other', actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', details: {} }] }, 'same note'), 'ambiguous');
  assert.equal(verifyTaskProgressReadback(before, {
    ...appended,
    progress_notes: [...appended.progress_notes, { note: 'same note' }],
    events: [...appended.events, { event: 'progress_recorded', actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', details: { note: 'same note' } }],
  }, 'same note'), 'ambiguous');
});

test('task progress POST failure and read-back failure stay ambiguous; a fresh read can reconcile', async () => {
  const task = {
    task_id: 'PAL-IT-TASK-AMBIGUOUS', child_id: 'PAL-IT-BEN-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', flag_id: 'PAL-IT-FLAG-001', status: 'in_progress' as const,
    owner_id: 'PAL-IT-WORKER-001', owner_role: 'worker', alert_level: 'urgent', colour: 'RED',
    created_on: '2026-10-15', due_on: '2026-10-17', escalation_level: 0,
    events: [{ event: 'started', actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', details: {} }],
    progress_notes: [],
  };
  const appended = {
    ...task,
    events: [...task.events, { event: 'progress_recorded', actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', details: { note: 'completed home visit' } }],
    progress_notes: [{ actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', note: 'completed home visit' }],
  };
  const postFailure = await submitAndVerifyTaskProgress(task, 'completed home visit', async () => {
    throw new Error('transport failure');
  }, async () => [task]);
  assert.equal(postFailure.status, 'ambiguous');
  assert.equal(postFailure.phase, 'post');

  const readFailure = await submitAndVerifyTaskProgress(task, 'completed home visit', async () => appended, async () => {
    throw new Error('read failed after successful post');
  });
  assert.equal(readFailure.status, 'ambiguous');
  assert.equal(readFailure.phase, 'readback');

  const recovered = await submitAndVerifyTaskProgress(task, 'completed home visit', async () => appended, async () => [appended]);
  assert.equal(recovered.status, 'committed');
  assert.equal(recovered.task?.task_id, task.task_id);

  const stale = await submitAndVerifyTaskProgress(task, 'completed home visit', async () => appended, async () => [task]);
  assert.equal(stale.status, 'not_committed');
});

test('task progress UI locks ambiguous submissions and requires manual refresh reconciliation', () => {
  const page = readFileSync(new URL('../pages/SyntheticOperationsPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /taskActionsInFlight\.current\.has/);
  assert.match(page, /pendingProgressRef\.current\[task\.task_id\]/);
  assert.match(page, /B2 did not confirm the progress request/);
  assert.match(page, /B2 accepted the progress request, but read-back failed/);
  assert.match(page, /refresh\(true\)/);
  assert.match(page, /locked=\{Boolean\(pendingProgress\[task\.task_id\]\)\}/);
  assert.match(page, /Do not retry yet/);
});

test('measurement history requires exactly one matching persisted flag per measurement', async () => {
  const measurement = {
    measurement_id: 'PAL-IT-MEA-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', source: 'initial', recorded_at: '2026-10-15',
    evaluation: { colour: 'RED' },
  };
  const secondMeasurement = {
    ...measurement, measurement_id: 'PAL-IT-MEA-002', evaluation: { colour: 'AMBER' },
  };
  const flag = {
    flag_id: 'PAL-IT-FLAG-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', measurement_id: measurement.measurement_id,
    colour: 'RED', created_at: '2026-10-15',
  };
  const secondFlag = {
    ...flag, flag_id: 'PAL-IT-FLAG-002', measurement_id: secondMeasurement.measurement_id, colour: 'AMBER',
  };
  const clientFor = (measurements: unknown[], flags: unknown[]) => createB2ApiClient(
    'http://localhost:8000',
    async () => Response.json({
      beneficiary_id: 'PAL-IT-BEN-001', centre_id: 'PAL-IT-CENTRE-001', measurements, flags,
    }),
  );
  const read = (measurements: unknown[], flags: unknown[]) =>
    clientFor(measurements, flags).listMeasurements('PAL-IT-BEN-001', 'test-access-token');

  const valid = await read([measurement], [flag]);
  assert.equal(valid.flags[0].measurement_id, valid.measurements[0].measurement_id);

  // The current API contract permits an empty history, represented by two empty arrays.
  const empty = await read([], []);
  assert.deepEqual(empty.measurements, []);
  assert.deepEqual(empty.flags, []);

  const invalidCases: Array<[string, unknown[], unknown[]]> = [
    ['no flags for an existing measurement', [measurement], []],
    ['partially missing flags', [measurement, secondMeasurement], [flag]],
    ['flag for an unknown measurement', [measurement], [{ ...flag, measurement_id: 'PAL-IT-MEA-UNKNOWN' }]],
    ['duplicate flags for one measurement', [measurement], [flag, { ...flag, flag_id: 'PAL-IT-FLAG-DUPLICATE' }]],
    ['flag beneficiary mismatch', [measurement], [{ ...flag, beneficiary_id: 'PAL-IT-BEN-OTHER' }]],
    ['flag centre mismatch', [measurement], [{ ...flag, centre_id: 'PAL-IT-CENTRE-OTHER' }]],
    ['flag evaluation mismatch', [measurement], [{ ...flag, colour: 'GREEN' }]],
    ['flag reasons mismatch', [measurement], [{ ...flag, reasons: ['different persisted reason'] }]],
    ['flag evaluation subject mismatch', [measurement], [{ ...flag, who: 'mother' }]],
  ];
  for (const [description, measurements, flags] of invalidCases) {
    await assert.rejects(read(measurements, flags), (error: unknown) =>
      error instanceof B2ApiError && error.code === 'server_error', description);
  }
});

test('first measurement request sends only the contract fields and validates saved evaluation linkage', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const measurement = {
    measurement_id: 'PAL-IT-MEA-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', source: 'initial', recorded_at: '2026-10-15',
    measurement_date: '2026-10-15', weight_kg: 7, height_cm: 64,
    evaluation: { colour: 'RED' },
  };
  const flag = {
    flag_id: 'PAL-IT-FLAG-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', measurement_id: measurement.measurement_id,
    colour: 'RED', created_at: '2026-10-15', needs_human_verification: true,
  };
  const client = createB2ApiClient('http://localhost:8000', async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return Response.json({ measurement, flag, history_link: '/api/beneficiaries/PAL-IT-BEN-001/measurements', label: 'synthetic' });
  });
  const result = await client.recordFirstMeasurement({
    beneficiary_id: 'PAL-IT-BEN-001',
    measurement: { measurement_date: '2026-10-15', weight_kg: 7, height_cm: 64, danger_sign: 'yes' },
    recorded_at: '2026-10-15',
  }, 'test-access-token');

  assert.equal(seenUrl, 'http://localhost:8000/api/measurements');
  assert.equal(seenInit?.method, 'POST');
  assert.equal(new Headers(seenInit?.headers).get('Authorization'), 'Bearer test-access-token');
  assert.deepEqual(JSON.parse(String(seenInit?.body)), {
    beneficiary_id: 'PAL-IT-BEN-001',
    measurement: { measurement_date: '2026-10-15', weight_kg: 7, height_cm: 64, danger_sign: 'yes' },
    recorded_at: '2026-10-15',
  });
  assert.equal(result.flag.measurement_id, result.measurement.measurement_id);
  assert.equal(result.measurement.evaluation.colour, result.flag.colour);

  const malformed = createB2ApiClient('http://localhost:8000', async () => Response.json({
    measurement, flag: { ...flag, beneficiary_id: 'another-beneficiary' }, history_link: '/history',
  }));
  await assert.rejects(malformed.recordFirstMeasurement({
    beneficiary_id: 'PAL-IT-BEN-001',
    measurement: { measurement_date: '2026-10-15', weight_kg: 7, height_cm: 64 },
    recorded_at: '2026-10-15',
  }, 'test-access-token'), (error: unknown) => error instanceof B2ApiError && error.code === 'server_error');
});

test('task, referral, and briefing methods validate B2 contracts without browser authorization claims', async () => {
  const task = {
    task_id: 'PAL-IT-TASK-001', child_id: 'PAL-IT-BEN-001', beneficiary_id: 'PAL-IT-BEN-001',
    centre_id: 'PAL-IT-CENTRE-001', flag_id: 'PAL-IT-FLAG-001', status: 'assigned',
    owner_id: 'PAL-IT-WORKER-001', owner_role: 'worker', alert_level: 'urgent', colour: 'RED',
    created_on: '2026-10-15', due_on: '2026-10-17', escalation_level: 0,
    events: [{ event: 'created', actor_id: 'system', at: '2026-10-15', details: {} }],
  };
  const referral = {
    referral_id: 'PAL-IT-REF-001', beneficiary_id: 'PAL-IT-BEN-001', centre_id: 'PAL-IT-CENTRE-001',
    task_id: task.task_id, referral_kind: 'general', destination: 'PAL-IT-SERVICE',
    reason_code: 'case_follow_up', status: 'sent', created_at: '2026-10-15', sent_by: 'PAL-IT-WORKER-001',
    due_on: null, timeline: [],
  };
  const exception = {
    exception_id: 'PAL-IT-EX-001', beneficiary_id: 'PAL-IT-BEN-001', centre_id: 'PAL-IT-CENTRE-001',
    task_id: task.task_id, exception_type: 'document_unavailable', status: 'open',
    opened_by: 'PAL-IT-WORKER-001', opened_at: '2026-10-15', resolution_code: null, resolved_by: null, resolved_at: null,
  };
  const briefing = {
    centre_id: 'PAL-IT-CENTRE-001', as_of: '2026-10-15',
    counts: { flags: 1, by_colour: { red: 1 }, tasks: 1, by_task_status: { assigned: 1 }, active_tasks: 1 },
  };
  const seen: Array<{ url: string; body: string }> = [];
  const client = createB2ApiClient('http://localhost:8000', async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    seen.push({ url, body });
    if (url.endsWith('/api/briefing?centre_id=PAL-IT-CENTRE-001')) return Response.json(briefing);
    if (url.endsWith('/api/tasks?centre_id=PAL-IT-CENTRE-001')) return Response.json({ centre_id: 'PAL-IT-CENTRE-001', tasks: [task] });
    if (url.endsWith('/api/referrals?centre_id=PAL-IT-CENTRE-001')) return Response.json({ centre_id: 'PAL-IT-CENTRE-001', as_of: '2026-10-15', referrals: [referral] });
    if (url.endsWith('/api/tasks/PAL-IT-TASK-001/actions')) return Response.json({ task: { ...task, status: 'acknowledged' } });
    if (url.endsWith('/api/referrals')) return Response.json({ referral });
    if (url.endsWith('/api/referrals/PAL-IT-REF-001/actions')) return Response.json({ referral: { ...referral, status: 'acknowledged' } });
    if (url.endsWith('/api/access-exceptions?centre_id=PAL-IT-CENTRE-001')) return Response.json({ centre_id: 'PAL-IT-CENTRE-001', exceptions: [exception] });
    if (url.endsWith('/api/access-exceptions')) return Response.json({ exception });
    if (url.endsWith('/api/access-exceptions/PAL-IT-EX-001/resolve')) return Response.json({ exception: { ...exception, status: 'resolved', resolution_code: 'manual_review_completed', resolved_by: 'PAL-IT-SUPERVISOR-001', resolved_at: '2026-10-15' } });
    return Response.json({}, { status: 404 });
  });

  assert.equal((await client.getBriefing('PAL-IT-CENTRE-001', 'token')).counts.tasks, 1);
  assert.equal((await client.listTasks('PAL-IT-CENTRE-001', 'token')).tasks[0].task_id, task.task_id);
  assert.equal((await client.listReferrals('PAL-IT-CENTRE-001', 'token')).referrals[0].referral_id, referral.referral_id);
  assert.equal((await client.applyTaskAction(task.task_id, 'acknowledge', 'token')).task.status, 'acknowledged');
  assert.equal((await client.createReferral({
    beneficiary_id: referral.beneficiary_id, referral_kind: 'general', destination: 'PAL-IT-SERVICE', reason_code: 'case_follow_up',
  }, 'token')).referral.referral_id, referral.referral_id);
  assert.equal((await client.applyReferralAction(referral.referral_id, 'acknowledge', 'token')).referral.status, 'acknowledged');
  assert.equal((await client.listAccessExceptions('PAL-IT-CENTRE-001', 'token')).exceptions[0].status, 'open');
  assert.equal((await client.createAccessException({ beneficiary_id: exception.beneficiary_id, exception_type: exception.exception_type }, 'token')).exception.exception_id, exception.exception_id);
  assert.equal((await client.resolveAccessException(exception.exception_id, 'manual_review_completed', 'token')).exception.status, 'resolved');
  const mutationBodies = seen.filter((item) => item.body).map((item) => JSON.parse(item.body) as Record<string, unknown>);
  assert.deepEqual(mutationBodies[0], { action: 'acknowledge' });
  assert.deepEqual(mutationBodies[1], {
    beneficiary_id: referral.beneficiary_id, referral_kind: 'general', destination: 'PAL-IT-SERVICE', reason_code: 'case_follow_up',
  });
  assert.deepEqual(mutationBodies[2], { action: 'acknowledge' });
  assert.deepEqual(mutationBodies[3], { beneficiary_id: exception.beneficiary_id, exception_type: exception.exception_type });
  assert.deepEqual(mutationBodies[4], { resolution_code: 'manual_review_completed' });
  assert.ok(mutationBodies.every((body) => !('role' in body) && !('centre_id' in body) && !('owner_id' in body)));
});

test('task and referral APIs reject malformed, mismatched, and unauthorized responses safely', async () => {
  const badTask = createB2ApiClient('http://localhost:8000', async () => Response.json({
    centre_id: 'PAL-IT-CENTRE-001', tasks: [{ task_id: 'x', status: 'made_up', centre_id: 'PAL-IT-CENTRE-001' }],
  }));
  await assert.rejects(badTask.listTasks('PAL-IT-CENTRE-001', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');

  const malformedTaskHistory = createB2ApiClient('http://localhost:8000', async () => Response.json({
    centre_id: 'PAL-IT-CENTRE-001', tasks: [{
      task_id: 'PAL-IT-TASK-001', child_id: 'PAL-IT-BEN-001', beneficiary_id: 'PAL-IT-BEN-001',
      centre_id: 'PAL-IT-CENTRE-001', flag_id: 'PAL-IT-FLAG-001', status: 'assigned', owner_id: null,
      owner_role: 'worker', alert_level: 'watch', colour: 'AMBER', created_on: '2026-10-15',
      due_on: '2026-10-17', escalation_level: 0,
      events: [{ event: 'progress_recorded', actor_id: 'PAL-IT-WORKER-001', at: '2026-10-15', details: [] }],
    }],
  }));
  await assert.rejects(malformedTaskHistory.listTasks('PAL-IT-CENTRE-001', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');

  const wrongCentre = createB2ApiClient('http://localhost:8000', async () => Response.json({
    centre_id: 'PAL-IT-CENTRE-OTHER', tasks: [],
  }));
  await assert.rejects(wrongCentre.listTasks('PAL-IT-CENTRE-001', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');

  const malformedBriefing = createB2ApiClient('http://localhost:8000', async () => Response.json({
    centre_id: 'PAL-IT-CENTRE-001', as_of: '2026-10-15', counts: { tasks: '1', flags: 1, active_tasks: 1 },
  }));
  await assert.rejects(malformedBriefing.getBriefing('PAL-IT-CENTRE-001', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');

  const unauthorized = createB2ApiClient('http://localhost:8000', async () => Response.json({}, { status: 403 }));
  await assert.rejects(unauthorized.listTasks('PAL-IT-CENTRE-001', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'forbidden');
  const unavailable = createB2ApiClient('http://localhost:8000', async () => { throw new Error('private transport detail'); });
  await assert.rejects(unavailable.listReferrals('PAL-IT-CENTRE-001', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'network_error' && !error.message.includes('private'));

  const wrongTaskAction = createB2ApiClient('http://localhost:8000', async () => Response.json({
    task: { task_id: 'PAL-IT-TASK-OTHER' },
  }));
  await assert.rejects(wrongTaskAction.applyTaskAction('PAL-IT-TASK-001', 'acknowledge', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');

  const duplicateAction = createB2ApiClient('http://localhost:8000', async () => Response.json({}, { status: 409 }));
  await assert.rejects(duplicateAction.applyReferralAction('PAL-IT-REF-001', 'acknowledge', 'token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'invalid_request');
});

test('synthetic operations view does not read mockStore or accept browser-supplied scope as authority', () => {
  const page = readFileSync(new URL('../pages/SyntheticOperationsPage.tsx', import.meta.url), 'utf8');
  assert.equal(page.includes('mockStore'), false);
  assert.match(page, /backendProfile\?\.scopes/);
  assert.match(page, /api\.listTasks\(centreId, accessToken\)/);
  assert.match(page, /api\.listReferrals\(centreId, accessToken\)/);
  assert.match(page, /No local demo records are used as a substitute/);
  assert.match(page, /fresh task-list read did not confirm/);
  assert.match(page, /fresh referral-list read did not confirm/);
  assert.match(page, /B2 task history/);
  assert.match(page, /Escalation level \{task\.escalation_level\}/);
  assert.match(page, /setNotice\(`B2 confirmed/);
});

test('API authorization and network failures propagate; the API client has no mock-store fallback', async () => {
  for (const status of [401, 403]) {
    const client = createB2ApiClient('http://localhost:8000', async () => new Response(null, { status }));
    await assert.rejects(client.listBeneficiaries('PAL-IT-CENTRE-001', 'test-access-token'), (error: unknown) =>
      error instanceof B2ApiError && error.status === status);
  }

  const client = createB2ApiClient('http://localhost:8000', async () => { throw new Error('network unavailable'); });
  await assert.rejects(client.listBeneficiaries('PAL-IT-CENTRE-001', 'test-access-token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'network_error');
});

test('synthetic API-backed page contains no local demo-store fallback', () => {
  const pageSource = readFileSync(new URL('../pages/SyntheticWorkflowPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(pageSource, /mockStore/);
  assert.match(pageSource, /listBeneficiaries/);
  assert.match(pageSource, /recordFirstMeasurement/);
  assert.match(pageSource, /handleRegisterBeneficiary/);
  assert.match(pageSource, /fresh read did not verify all contract fields/);
  assert.match(pageSource, /measurementMatchesSubmission/);
  assert.match(pageSource, /B2 accepted the request, but fresh read-back verification failed/);
});

test('registration sends only the supported child fields', async () => {
  let seenInit: RequestInit | undefined;
  const client = createB2ApiClient('https://api.example.test', async (_url, init) => {
    seenInit = init;
    return Response.json({ beneficiary: { beneficiary_id: 'BEN-1', centre_id: 'CTR-1', assigned_worker_id: 'W1' }, label: 'synthetic' });
  });

  const input = {
    beneficiary_id: 'BEN-1', date_of_birth: '2025-01-01', sex: 'F',
    caregiver_kinship: 'Mother',
    role: 'System Administrator', centre_id: 'CTR-9', assigned_worker_id: 'W9',
  } as Parameters<typeof client.registerBeneficiary>[0];
  const result = await client.registerBeneficiary(input, 'test-access-token');

  assert.equal(result.beneficiary.beneficiary_id, 'BEN-1');
  assert.equal(result.label, 'synthetic');
  assert.equal(seenInit?.method, 'POST');
  assert.deepEqual(JSON.parse(String(seenInit?.body)), {
    beneficiary_id: 'BEN-1', date_of_birth: '2025-01-01', sex: 'F', caregiver_kinship: 'Mother',
  });
});

test('missing token and protected API errors fail with safe messages', async () => {
  const client = createB2ApiClient('http://localhost:8000', async () => new Response(null, { status: 403 }));
  await assert.rejects(client.listBeneficiaries('CTR-1', ''), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'unauthorized');
  await assert.rejects(client.listBeneficiaries('CTR-1', 'test-token'), (error: unknown) =>
    error instanceof B2ApiError && error.status === 403 && !error.message.includes('test-token'));

  const unavailableClient = createB2ApiClient('http://localhost:8000', async () => new Response(null, { status: 503 }));
  await assert.rejects(unavailableClient.listBeneficiaries('CTR-1', 'test-token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'service_unavailable');
});

test('network and malformed successful responses return generic errors', async () => {
  const networkClient = createB2ApiClient('http://localhost:8000', async () => { throw new Error('sensitive transport detail'); });
  await assert.rejects(networkClient.listBeneficiaries('CTR-1', 'test-token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'network_error' && !error.message.includes('sensitive'));

  const malformedClient = createB2ApiClient('http://localhost:8000', async () => Response.json({ beneficiaries: [null], centre_id: 'CTR-1' }));
  await assert.rejects(malformedClient.listBeneficiaries('CTR-1', 'test-token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');
  const malformedRegistration = createB2ApiClient('http://localhost:8000', async () => Response.json({ beneficiary: null }));
  await assert.rejects(malformedRegistration.registerBeneficiary({ date_of_birth: '2025-01-01', sex: 'F' }, 'test-token'), (error: unknown) =>
    error instanceof B2ApiError && error.code === 'server_error');
});

test('invalid base URLs are rejected', () => {
  assert.throws(() => createB2ApiClient('javascript:alert(1)'), TypeError);
  assert.throws(() => createB2ApiClient('https://user:password@api.example.test'), TypeError);
  assert.throws(() => createB2ApiClient('http://api.example.test'), TypeError);
});
