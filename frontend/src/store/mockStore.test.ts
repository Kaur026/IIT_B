import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_BENEFICIARY_COUNTS,
  DEMO_TODAY,
  DEMO_AWW_CENTRES,
  mockStore,
} from './mockStore.ts';
import { canPerformAction } from '../utils/permissions.ts';
import { calculateAge, getDaysUntilDate, getTodayISODate } from '../utils/casework.ts';

test('canonical seed has the exact configured beneficiary cohort and unique, complete records', () => {
  mockStore.resetToDemoSeed();
  const beneficiaries = mockStore.getBeneficiaries();
  const ids = beneficiaries.map((beneficiary) => beneficiary.id);

  assert.equal(beneficiaries.length, 600);
  assert.deepEqual(
    Object.fromEntries([...new Set(beneficiaries.map((beneficiary) => beneficiary.category))]
      .map((category) => [category, beneficiaries.filter((beneficiary) => beneficiary.category === category).length])),
    DEMO_BENEFICIARY_COUNTS,
  );
  assert.equal(new Set(ids).size, ids.length);
  const adolescentGirls = beneficiaries.filter((beneficiary) => beneficiary.category === 'adolescent');
  assert.equal(adolescentGirls.length, 50);
  assert.ok(adolescentGirls.every((beneficiary) =>
    beneficiary.gender === 'Female'
      && calculateAge(beneficiary.dob, DEMO_TODAY, beneficiary.category, beneficiary.gender).cohort === 'adolescentGirls'
  ));
  assert.ok(beneficiaries.every((beneficiary) => beneficiary.name.trim()));
  assert.ok(beneficiaries.every((beneficiary) => beneficiary.dob <= beneficiary.registrationDate));
  assert.ok(beneficiaries.every((beneficiary) => beneficiary.registrationDate <= DEMO_TODAY));
  assert.ok(beneficiaries.every((beneficiary) => DEMO_AWW_CENTRES[beneficiary.assignedAww] === beneficiary.centreCode));
  assert.equal(mockStore.getMetrics().total, 600);
  assert.equal(mockStore.getMetrics().totalChildren, 322);
  assert.equal(mockStore.getMetrics().adolescentGirls, 50);
  assert.equal(mockStore.getMetrics().children0to6m, 24);
  assert.equal(mockStore.getMetrics().children6mTo3y, 146);
  assert.equal(mockStore.getMetrics().children3to6y, 152);
  assert.equal(mockStore.getMetrics().pregnantWomen, 137);
  assert.equal(mockStore.getMetrics().lactatingMothers, 91);
  assert.equal(
    mockStore.getMetrics().children0to6m
      + mockStore.getMetrics().children6mTo3y
      + mockStore.getMetrics().children3to6y,
    322,
  );
  assert.equal(mockStore.getCohortSummaries().reduce((total, cohort) => total + cohort.count, 0), 600);
});

test('generated measurements, tasks, referrals, visits, maternal profiles, and services have valid links', () => {
  mockStore.resetToDemoSeed();
  const beneficiaries = mockStore.getBeneficiaries();
  const beneficiaryById = new Map(beneficiaries.map((beneficiary) => [beneficiary.id, beneficiary]));
  const centres = new Set(mockStore.getCentres().map((centre) => centre.id));
  const workers = new Map(mockStore.getWorkers().map((worker) => [worker.id, worker]));
  const measurements = mockStore.getMeasurements();
  const tasks = mockStore.getTasks();
  const referrals = mockStore.getReferrals();
  const homeVisits = mockStore.getHomeVisits();
  const maternalProfiles = mockStore.getMaternalProfiles();
  const serviceRecords = mockStore.getServiceRecords();

  for (const [label, records] of [
    ['measurement', measurements],
    ['task', tasks],
    ['referral', referrals],
    ['home visit', homeVisits],
    ['maternal profile', maternalProfiles],
    ['service', serviceRecords],
  ] as const) {
    const recordIds = records.map((record) => record.id);
    assert.equal(new Set(recordIds).size, recordIds.length, `${label} IDs must be unique`);
    assert.ok(records.every((record) => beneficiaryById.has(record.beneficiaryId)), `${label} has an orphan beneficiary`);
  }

  assert.ok(measurements.length >= 372);
  assert.ok(measurements.every((measurement) => beneficiaryById.get(measurement.beneficiaryId)?.category === 'child_under_6'));
  assert.ok(measurements.every((measurement) => workers.has(measurement.recordedBy)));
  assert.equal(tasks.length, mockStore.getCases().length);
  assert.ok(tasks.every((task) => centres.has(task.centreCode) && workers.get(task.ownerId)?.centreCode === task.centreCode));
  assert.ok(referrals.every((referral) => workers.has(referral.owner)));
  assert.equal(maternalProfiles.length, 137 + 91);
  assert.ok(maternalProfiles.every((profile) => {
    const beneficiary = beneficiaryById.get(profile.beneficiaryId);
    return centres.has(profile.centreCode)
      && beneficiary?.centreCode === profile.centreCode
      && (beneficiary.category === 'pregnant' || beneficiary.category === 'lactating')
      && profile.stage === beneficiary.category;
  }));
  assert.ok(homeVisits.every((visit) => {
    const beneficiary = beneficiaryById.get(visit.beneficiaryId);
    return centres.has(visit.centreCode)
      && beneficiary?.centreCode === visit.centreCode
      && workers.get(visit.workerId)?.centreCode === visit.centreCode
      && beneficiary.assignedAww === visit.workerId;
  }));
  assert.equal(serviceRecords.length, 600);
  assert.ok(serviceRecords.every((record) => {
    const beneficiary = beneficiaryById.get(record.beneficiaryId);
    return centres.has(record.centreCode)
      && beneficiary?.centreCode === record.centreCode
      && workers.get(record.workerId)?.centreCode === record.centreCode
      && beneficiary.assignedAww === record.workerId;
  }));
  assert.ok(measurements.every((measurement) => {
    const beneficiary = beneficiaryById.get(measurement.beneficiaryId);
    return beneficiary?.centreCode && workers.get(measurement.recordedBy)?.centreCode === beneficiary.centreCode;
  }));
});

test('centre and worker distributions are varied and scoped access stays within existing role boundaries', () => {
  mockStore.resetToDemoSeed();
  const beneficiaries = mockStore.getBeneficiaries();
  const centreCounts = mockStore.getCentres().map((centre) => beneficiaries.filter((item) => item.centreCode === centre.id).length);
  const workerCounts = mockStore.getWorkers()
    .filter((worker) => worker.role === 'AWW')
    .map((worker) => beneficiaries.filter((item) => item.assignedAww === worker.id).length);
  assert.equal(centreCounts.reduce((sum, count) => sum + count, 0), 600);
  assert.ok(centreCounts.every((count) => count > 0));
  assert.ok(Math.max(...centreCounts) > Math.min(...centreCounts));
  assert.ok(Math.max(...workerCounts) > Math.min(...workerCounts));

  const awwScope = { role: 'AWW' as const, actorId: 'AWW-409', centreCode: 'AWC-702' };
  const awwBeneficiaries = mockStore.getBeneficiaries(awwScope);
  assert.equal(awwBeneficiaries.length, 225);
  assert.equal(mockStore.getBeneficiaries({ role: 'AWW', actorId: 'AWW-405', centreCode: 'AWC-703' }).length, 134);
  assert.equal(mockStore.getBeneficiaries({ role: 'AWW', actorId: 'AWW-410', centreCode: 'AWC-704' }).length, 106);
  assert.equal(mockStore.getBeneficiaries({ role: 'AWW', actorId: 'AWW-417', centreCode: 'AWC-705' }).length, 84);
  assert.equal(mockStore.getBeneficiaries({ role: 'AWW', actorId: 'AWW-421', centreCode: 'AWC-706' }).length, 51);
  assert.ok(awwBeneficiaries.every((beneficiary) => beneficiary.centreCode === 'AWC-702'));
  assert.deepEqual(mockStore.getBeneficiaries({ ...awwScope, centreCode: 'AWC-703' }), []);
  assert.equal(mockStore.getBeneficiaryById(beneficiaries.find((item) => item.centreCode !== 'AWC-702')!.id, awwScope), undefined);
  assert.ok(mockStore.getMeasurements(undefined, awwScope).every((record) => beneficiaryByCentre(record.beneficiaryId, 'AWC-702')));
  assert.ok(mockStore.getCases(awwScope).every((record) => record.centreCode === 'AWC-702'));
  assert.ok(mockStore.getCases(awwScope).every((record) => record.assignedAww === awwScope.actorId));
  assert.ok(mockStore.getReferrals(awwScope).every((record) => beneficiaryByCentre(record.beneficiaryId, 'AWC-702')));
  assert.ok(mockStore.getHomeVisits(awwScope).every((record) => record.centreCode === 'AWC-702'));
  assert.ok(mockStore.getServiceRecords(awwScope).every((record) => record.centreCode === 'AWC-702'));

  const sectorBeneficiaries = mockStore.getBeneficiaries({ role: 'LS', sectorCode: 'Sector-4' });
  const projectBeneficiaries = mockStore.getBeneficiaries({ role: 'CDPO', projectCode: 'Project-Central' });
  assert.ok(sectorBeneficiaries.every((beneficiary) => ['AWC-702', 'AWC-703', 'AWC-704'].includes(beneficiary.centreCode)));
  assert.equal(projectBeneficiaries.length, 600);
  assert.deepEqual(mockStore.getBeneficiaries({ role: 'DPO' }), []);
  assert.equal(mockStore.getMetrics({ role: 'DPO' }).total, 600);
  assert.equal(canPerformAction('AWW', 'record_measurement'), true);
  assert.equal(canPerformAction('AWW', 're_measure'), false);
  assert.equal(canPerformAction('LS', 're_measure'), true);
  assert.equal(canPerformAction('CDPO', 'record_measurement'), false);
  assert.equal(canPerformAction('DPO', 'resolve_referral'), false);

  const caseToAcknowledge = mockStore.getCases(awwScope).find((caseItem) => !caseItem.acknowledgedAt);
  assert.ok(caseToAcknowledge);
  assert.equal(mockStore.acknowledgeCase(caseToAcknowledge.actionId, awwScope), true);
  assert.equal(mockStore.getTasks(awwScope).find((task) => task.id === `TASK-${caseToAcknowledge.actionId}`)?.status, 'acknowledged');
  const otherWorkerCase = mockStore.getCases().find((caseItem) => caseItem.centreCode === awwScope.centreCode && caseItem.assignedAww !== awwScope.actorId);
  if (otherWorkerCase) {
    assert.equal(mockStore.getCaseById(otherWorkerCase.id, awwScope), undefined);
    assert.equal(mockStore.acknowledgeCase(otherWorkerCase.actionId, awwScope), false);
  }

  function beneficiaryByCentre(beneficiaryId: string, centreCode: string): boolean {
    return mockStore.getBeneficiaryById(beneficiaryId)?.centreCode === centreCode;
  }
});

test('AWW casework is worker scoped and generated case deltas match their linked readings', () => {
  mockStore.resetToDemoSeed();
  const awwScope = { role: 'AWW' as const, actorId: 'AWW-409', centreCode: 'AWC-702' };
  const allCentreCases = mockStore.getCases().filter((caseItem) => caseItem.centreCode === awwScope.centreCode);
  const assignedCases = mockStore.getCases(awwScope);
  assert.ok(assignedCases.length <= allCentreCases.length);
  assert.ok(assignedCases.every((caseItem) => caseItem.assignedAww === awwScope.actorId));
  assert.equal(mockStore.getMetrics(awwScope).pendingCases, assignedCases.filter((caseItem) => !caseItem.isVerified).length);
  assert.equal(mockStore.getMetrics(awwScope).openTasks, mockStore.getTasks(awwScope).filter((task) => task.status !== 'closed').length);
  const centreReferral = mockStore.getReferrals(awwScope)[0];
  assert.ok(centreReferral);
  assert.equal(mockStore.addFollowUpAttempt(centreReferral.id, {
    method: 'Phone Call',
    findings: 'Follow-up identity must come from the logged-in worker.',
  }, { role: 'AWW', centreCode: awwScope.centreCode }), false);

  const heightCase = mockStore.getCaseById('BEN-1019');
  assert.equal(heightCase?.ruleCode, 'RUL-02');
  assert.equal(Number((heightCase!.flaggedHeight - heightCase!.prevHeight).toFixed(1)), -1.5);
  assert.match(heightCase!.weightDelta, /-1\.5 cm \(Height\)/);
  const weightCase = mockStore.getCaseById('BEN-1038');
  assert.equal(weightCase?.ruleCode, 'RUL-03');
  assert.equal(Number((weightCase!.flaggedWeight - weightCase!.prevWeight).toFixed(2)), -0.85);
  assert.match(weightCase!.weightDelta, /-0\.85 kg/);
});

test('new registrations receive unique IDs without fabricated baseline measurements', () => {
  mockStore.resetToDemoSeed();
  const scope = { role: 'AWW' as const, actorId: 'AWW-409', centreCode: 'AWC-702' };
  const measurementsBefore = mockStore.getMeasurements().length;
  const registration = mockStore.addBeneficiary({
    dob: '2025-01-01',
    gender: 'Female',
    category: 'child_under_6',
    birthWeight: 3.1,
  }, scope);
  assert.ok(registration.id);
  assert.equal(mockStore.getBeneficiaryById(registration.id)?.registrationDate, getTodayISODate());
  assert.equal(mockStore.getMeasurements().length, measurementsBefore);
  assert.equal(new Set(mockStore.getBeneficiaries().map((beneficiary) => beneficiary.id)).size, mockStore.getBeneficiaries().length);

  const measurement = mockStore.recordMeasurement({
    beneficiaryId: registration.id,
    weightKg: 8.2,
    heightCm: 78,
    measurementDate: getTodayISODate(),
  }, scope);
  assert.equal(measurement.success, true);
  assert.equal(measurement.caseCreated, undefined);
  assert.equal(mockStore.getMeasurements(registration.id)[0]?.isVerified, true);
  assert.equal(mockStore.recordMeasurement({
    beneficiaryId: mockStore.getBeneficiaries().find((beneficiary) => beneficiary.category === 'pregnant')!.id,
    weightKg: 60,
    heightCm: 160,
    measurementDate: getTodayISODate(),
  }, scope).success, false);
});

test('task and referral date summaries are evaluated relative to today', () => {
  assert.equal(getDaysUntilDate(getTodayISODate()), 0);
  assert.equal(getDaysUntilDate('Within 24 Hours'), 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  assert.equal(getDaysUntilDate(tomorrowIso), 1);
});

test('resetting the browser-local seed reproduces the same records and summaries', () => {
  mockStore.resetToDemoSeed();
  const snapshot = JSON.stringify({
    beneficiaries: mockStore.getBeneficiaries(),
    measurements: mockStore.getMeasurements(),
    tasks: mockStore.getTasks(),
    referrals: mockStore.getReferrals(),
    visits: mockStore.getHomeVisits(),
    profiles: mockStore.getMaternalProfiles(),
    services: mockStore.getServiceRecords(),
    metrics: mockStore.getMetrics(),
  });
  mockStore.resetToDemoSeed();
  assert.equal(JSON.stringify({
    beneficiaries: mockStore.getBeneficiaries(),
    measurements: mockStore.getMeasurements(),
    tasks: mockStore.getTasks(),
    referrals: mockStore.getReferrals(),
    visits: mockStore.getHomeVisits(),
    profiles: mockStore.getMaternalProfiles(),
    services: mockStore.getServiceRecords(),
    metrics: mockStore.getMetrics(),
  }), snapshot);
});
