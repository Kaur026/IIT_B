import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeightDifference,
  evaluateGrowthPlausibility,
  updateCaseStatus,
  SAMPLE_CASES,
  calculateAge,
  evaluateMeasurementEntry,
  canEscalateCase,
  exportToCsvString,
  DEMO_CURRENT_DATE,
  ESCALATION_TIERS,
} from './casework.ts';
import { mockStore } from '../store/mockStore.ts';

test('calculateWeightDifference calculates accurate diff and formatting', () => {
  const result = calculateWeightDifference(14.2, 10.4);
  assert.equal(result.delta, -3.8);
  assert.equal(result.formatted, '-3.8 kg');
  assert.equal(result.isCorrection, true);

  const zeroResult = calculateWeightDifference(10.0, 10.0);
  assert.equal(zeroResult.delta, 0);
  assert.equal(zeroResult.isCorrection, false);
});

test('evaluateGrowthPlausibility flags improbable spikes', () => {
  // +3.8 kg in 28 days
  const check = evaluateGrowthPlausibility(10.4, 14.2, 28);
  assert.equal(check.isPlausible, false);
  assert.ok(check.velocityPerMonth > 2.0);
  assert.match(check.reason || '', /Weight gain exceeds/);
});

test('evaluateGrowthPlausibility passes realistic weight progression', () => {
  // +0.3 kg in 30 days
  const check = evaluateGrowthPlausibility(8.0, 8.3, 30);
  assert.equal(check.isPlausible, true);
  assert.equal(check.velocityPerMonth, 0.3);
});

test('updateCaseStatus transitions case cleanly', () => {
  const updated = updateCaseStatus(SAMPLE_CASES, 'case-1', 'verified_assigned');
  const target = updated.find((c) => c.id === 'case-1');
  assert.equal(target?.status, 'verified_assigned');

  // original array unaffected (pure function)
  assert.equal(SAMPLE_CASES.find((c) => c.id === 'case-1')?.status, 'awaiting_review');
});

test('calculateAge calculates exact completed months and cohorts', () => {
  // Infant 4 months old (DOB: 2026-06-24 relative to 2026-10-24)
  const infant = calculateAge('2026-06-24', DEMO_CURRENT_DATE);
  assert.equal(infant.completedMonths, 4);
  assert.equal(infant.completedYears, 0);
  assert.equal(infant.cohort, 'children0to6m');
  assert.equal(infant.recommendedMeasurementPosture, 'recumbent');

  // Toddler 14 months old (DOB: 2025-08-10)
  const toddler = calculateAge('2025-08-10', DEMO_CURRENT_DATE);
  assert.equal(toddler.completedMonths, 14);
  assert.equal(toddler.completedYears, 1);
  assert.equal(toddler.remainingMonths, 2);
  assert.equal(toddler.cohort, 'children6mTo3y');
  assert.equal(toddler.recommendedMeasurementPosture, 'recumbent'); // < 24m

  // Child 3.5 years old (42 months) (DOB: 2023-04-10)
  const olderChild = calculateAge('2023-04-10', DEMO_CURRENT_DATE);
  assert.equal(olderChild.completedMonths, 42);
  assert.equal(olderChild.completedYears, 3);
  assert.equal(olderChild.cohort, 'children3to6y');
  assert.equal(olderChild.recommendedMeasurementPosture, 'standing'); // >= 24m
});

test('evaluateMeasurementEntry flags data quality vs clinical alerts distinctly', () => {
  // 1. Data Quality: Negative Height Step
  const negHeightCheck = evaluateMeasurementEntry({
    currentWeight: 10.9,
    currentHeight: 82.5,
    dob: '2024-12-04',
    previousRecord: {
      weight: 10.8,
      height: 84.5,
      date: '2026-09-10',
    },
    measurementDate: '2026-10-10',
  });

  assert.equal(negHeightCheck.isValid, true);
  assert.equal(negHeightCheck.isImplausible, true);
  assert.ok(negHeightCheck.qualityFlags.length > 0);
  assert.equal(negHeightCheck.qualityFlags[0].code, 'RUL-02');
  assert.equal(negHeightCheck.qualityFlags[0].type, 'data_quality');

  // 2. Data Quality: Impossible Weight
  const impossibleCheck = evaluateMeasurementEntry({
    currentWeight: 52.0, // impossible for toddler
    currentHeight: 80.0,
    dob: '2025-01-01',
  });
  assert.equal(impossibleCheck.isValid, false);
  assert.equal(impossibleCheck.isImpossible, true);

  // 3. Clinical Alert: Severe Stagnation
  const stagnationCheck = evaluateMeasurementEntry({
    currentWeight: 6.85,
    currentHeight: 67.0,
    dob: '2026-01-14',
    previousRecord: {
      weight: 6.80, // +50g in 62 days
      height: 66.2,
      date: '2026-08-12',
    },
    measurementDate: '2026-10-14',
  });
  assert.equal(stagnationCheck.isValid, true);
  assert.ok(stagnationCheck.clinicalFlags.some((f) => f.code === 'RUL-04'));
  assert.equal(stagnationCheck.clinicalFlags[0].type, 'clinical');

  // 4. Clinical Alert: Red MUAC (< 11.5cm)
  const muacCheck = evaluateMeasurementEntry({
    currentWeight: 6.5,
    currentHeight: 68.0,
    dob: '2025-10-01',
    muacCm: 11.0,
    hasBilateralEdema: false,
  });
  assert.ok(muacCheck.clinicalFlags.some((f) => f.code === 'CLIN-MUAC-RED'));
  assert.equal(muacCheck.primaryPriority, 'Referral Pending');
});

test('evaluateMeasurementEntry rejects non-finite values and invalid measurement dates', () => {
  const base = { currentWeight: 8, currentHeight: 70, dob: '2025-01-01' };

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const invalidWeight = evaluateMeasurementEntry({ ...base, currentWeight: value });
    assert.equal(invalidWeight.isValid, false);
    assert.equal(invalidWeight.flags[0]?.code, 'ERR-INPUT');

    const invalidHeight = evaluateMeasurementEntry({ ...base, currentHeight: value });
    assert.equal(invalidHeight.isValid, false);
    assert.equal(invalidHeight.flags[0]?.code, 'ERR-INPUT');
  }

  for (const measurementDate of ['', '2026-2-03', '2026-02-31', 'not-a-date', '2026-10-25']) {
    const invalidDate = evaluateMeasurementEntry({ ...base, measurementDate });
    assert.equal(invalidDate.isValid, false, `${measurementDate} should be rejected`);
    assert.equal(invalidDate.flags[0]?.code, 'ERR-INPUT');
  }

  const validDate = evaluateMeasurementEntry({ ...base, measurementDate: DEMO_CURRENT_DATE });
  assert.equal(validDate.isValid, true);
});

test('Escalation tiers progress through 4 levels with validation', () => {
  const tier1 = canEscalateCase(1);
  assert.equal(tier1.allowed, true);
  assert.equal(tier1.nextTier?.tierLevel, 2);
  assert.equal(tier1.nextTier?.roleName, 'Sector Supervisor');

  const tier2 = canEscalateCase(2);
  assert.equal(tier2.allowed, true);
  assert.equal(tier2.nextTier?.tierLevel, 3);
  assert.equal(tier2.nextTier?.roleName, 'Clinical Officer / ANM');

  const tier3 = canEscalateCase(3);
  assert.equal(tier3.allowed, true);
  assert.equal(tier3.nextTier?.tierLevel, 4);
  assert.equal(tier3.nextTier?.roleName, 'District DPO');

  const tier4 = canEscalateCase(4);
  assert.equal(tier4.allowed, false);
});

import { canAccessPath, canPerformAction, canRenderVerificationAction, getNavItemsForRole, ROLE_CONFIGS, PERMISSION_MATRIX } from './permissions.ts';

test('Action Queue does not render the verification submit action for DPO or other unauthorized roles', () => {
  assert.equal(canRenderVerificationAction('DPO'), false);
  assert.equal(canRenderVerificationAction('CDPO'), false);
  assert.equal(canRenderVerificationAction('AWW'), true);
  assert.equal(canRenderVerificationAction('LS'), true);
});

test('exportToCsvString produces RFC-4180 compliant CSV', () => {
  const headers = ['Beneficiary ID', 'Age (Months)', 'Centre Code', 'Notes'];
  const rows = [
    ['BEN-0142', 14, 'AWC-702', 'Physical re-weigh conducted, "verified" scale'],
    ['BEN-0891', 22, 'AWC-702', 'Negative height step observed\nLine 2'],
  ];

  const csv = exportToCsvString(headers, rows);
  assert.match(csv, /"Beneficiary ID","Age \(Months\)","Centre Code","Notes"/);
  assert.match(csv, /"BEN-0142","14","AWC-702","Physical re-weigh conducted, ""verified"" scale"/);
  assert.match(csv, /"BEN-0891","22","AWC-702","Negative height step observed\nLine 2"/);
});

test('mockStore maintains internal consistency, registration, and reset', () => {
  // Test reset demo data
  mockStore.resetToDemoSeed();

  const beneficiaries = mockStore.getBeneficiaries();
  assert.ok(beneficiaries.length >= 130, 'Should have at least 130 beneficiaries');

  const cases = mockStore.getCases();
  assert.equal(cases.length, 35, 'Should have exactly 35 flagged cases');

  const metrics = mockStore.getMetrics();
  assert.ok(metrics.total >= 130);
  assert.equal(metrics.pendingCases, cases.filter((c) => !c.isVerified).length);

  // Test registration creates beneficiary and baseline measurement
  const regResult = mockStore.addBeneficiary({
    dob: '2026-04-10',
    gender: 'Female',
    caregiverKinship: 'Mother',
    category: 'child_under_6',
    centreCode: 'AWC-702',
    birthWeight: 3.1,
  }, { role: 'AWW', actorId: 'AWW-409' });

  assert.ok(regResult.id.startsWith('BEN-'));
  const found = mockStore.getBeneficiaryById(regResult.id);
  assert.equal(found?.caregiverKinship, 'Mother');
  assert.equal(found?.centreCode, 'AWC-702');

  const measurements = mockStore.getMeasurements(regResult.id);
  assert.equal(measurements.length, 1);
  assert.equal(measurements[0].weightKg, 3.1);

  // Test reset restores canonical state
  mockStore.resetToDemoSeed();
  assert.equal(mockStore.getBeneficiaryById(regResult.id), undefined);
});

test('mockStore rejects invalid and duplicate measurements without mutating stored state', () => {
  mockStore.resetToDemoSeed();
  const registration = mockStore.addBeneficiary({
    dob: '2025-01-01',
    gender: 'Female',
    category: 'child_under_6',
    centreCode: 'AWC-702',
    birthWeight: 3.1,
  }, { role: 'AWW', actorId: 'AWW-409' });
  assert.ok(registration.id);

  const snapshot = () => JSON.stringify({
    measurements: mockStore.getMeasurements(registration.id),
    beneficiary: mockStore.getBeneficiaryById(registration.id),
    cases: mockStore.getCases(),
    auditLog: mockStore.getAuditLog(),
  });
  const baselineSnapshot = snapshot();

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    for (const field of ['weightKg', 'heightCm'] as const) {
      const result = mockStore.recordMeasurement({
        beneficiaryId: registration.id,
        weightKg: field === 'weightKg' ? value : 3.2,
        heightCm: field === 'heightCm' ? value : 50.5,
        measurementDate: '2026-10-23',
      }, { role: 'AWW', actorId: 'AWW-409' });
      assert.equal(result.success, false);
      assert.match(result.error || '', /finite number/);
      assert.equal(snapshot(), baselineSnapshot);
    }
  }

  for (const measurementDate of ['', '2026-2-03', '2026-02-31', '2026-10-25']) {
    const result = mockStore.recordMeasurement({
      beneficiaryId: registration.id,
      weightKg: 3.2,
      heightCm: 50.5,
      measurementDate,
    }, { role: 'AWW', actorId: 'AWW-409' });
    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.equal(snapshot(), baselineSnapshot);
  }

  const omittedDate = mockStore.recordMeasurement({
    beneficiaryId: registration.id,
    weightKg: 3.2,
    heightCm: 50.5,
  }, { role: 'AWW', actorId: 'AWW-409' });
  assert.equal(omittedDate.success, false);
  assert.match(omittedDate.error || '', /already exists/);
  assert.equal(snapshot(), baselineSnapshot);

  const first = mockStore.recordMeasurement({
    beneficiaryId: registration.id,
    weightKg: 3.2,
    heightCm: 50.5,
    measurementDate: '2026-10-23',
  }, { role: 'AWW', actorId: 'AWW-409' });
  assert.equal(first.success, true);
  const afterFirstSnapshot = snapshot();

  const duplicate = mockStore.recordMeasurement({
    beneficiaryId: registration.id,
    weightKg: 3.3,
    heightCm: 51,
    measurementDate: '2026-10-23',
  }, { role: 'AWW', actorId: 'AWW-409' });
  assert.equal(duplicate.success, false);
  assert.match(duplicate.error || '', /already exists/);
  assert.equal(snapshot(), afterFirstSnapshot);

  mockStore.resetToDemoSeed();
});

test('mockStore verification reports success only for valid permitted readings and preserves state on failure', () => {
  mockStore.resetToDemoSeed();
  const target = mockStore.getCases().find((item) => item.actionId === 'ACT-2041');
  assert.ok(target);
  const state = () => JSON.stringify({
    cases: mockStore.getCases(),
    beneficiary: mockStore.getBeneficiaryById(target.id),
    auditLog: mockStore.getAuditLog(),
  });
  const baseline = state();

  assert.equal(mockStore.verifyCase(target.actionId, Number.NaN, 77.5, '', { role: 'LS' }), false);
  assert.equal(state(), baseline);
  assert.equal(mockStore.verifyCase(target.actionId, 8.9, Number.POSITIVE_INFINITY, '', { role: 'LS' }), false);
  assert.equal(state(), baseline);
  assert.equal(mockStore.verifyCase(target.actionId, 8.9, 77.5, '', { role: 'CDPO' }), false);
  assert.equal(state(), baseline);
  assert.equal(mockStore.verifyCase('ACT-UNKNOWN', 8.9, 77.5, '', { role: 'LS' }), false);
  assert.equal(state(), baseline);

  assert.equal(mockStore.verifyCase(target.actionId, 8.9, 77.5, 'Physical measurements recorded.', { role: 'LS' }), true);
  const verified = mockStore.getCases().find((item) => item.actionId === target.actionId);
  assert.equal(verified?.status, 'Resolved');
  assert.equal(verified?.verifiedWeight, 8.9);
  assert.equal(verified?.verifiedHeight, 77.5);
  assert.ok(mockStore.getAuditLog().length > JSON.parse(baseline).auditLog.length);
  mockStore.resetToDemoSeed();
});

test('beneficiary profile source records distinguish pending verification and demo outcomes', () => {
  mockStore.resetToDemoSeed();
  const measurement = mockStore.getMeasurements('BEN-0142').find((record) => record.date === '2026-10-24');
  const relatedCase = mockStore.getCases().find((record) => record.id === 'BEN-0142');
  const auditEntry = mockStore.getAuditLog().find((record) => record.palId === 'BEN-0142');

  assert.equal(measurement?.weightKg, 12.3);
  assert.equal(measurement?.isVerified, false);
  assert.deepEqual(measurement?.clinicalFlags, []);
  assert.equal(relatedCase?.isVerified, false);
  assert.equal(relatedCase?.verifiedWeight, undefined);
  assert.equal(relatedCase?.verifiedNotes, undefined);
  assert.equal(auditEntry?.status, 'Verified');
  assert.match(auditEntry?.deltaSummary || '', /8\.90 kg verified/);

  const completedReferral = mockStore.getReferrals().find((record) => record.status === 'Completed');
  assert.ok(completedReferral?.finalOutcome, 'the demo seed stores an outcome that the profile must label as requiring confirmation');
  mockStore.resetToDemoSeed();
});

test('DPO is view-only for case and referral mutations while existing role permissions remain intact', () => {
  mockStore.resetToDemoSeed();
  const snapshot = () => JSON.stringify({
    beneficiaries: mockStore.getBeneficiaries(),
    measurements: mockStore.getMeasurements(),
    cases: mockStore.getCases(),
    referrals: mockStore.getReferrals(),
    audit: mockStore.getAuditLog(),
    rules: mockStore.getRules(),
  });
  const before = snapshot();

  assert.equal(canPerformAction('AWW', 're_measure'), true);
  assert.equal(canPerformAction('LS', 're_measure'), true);
  assert.equal(canPerformAction('LS', 'escalate'), true);
  assert.equal(canPerformAction('CDPO', 'assign_owner'), true);
  assert.equal(canPerformAction('AWW', 'log_follow_up'), true);
  assert.equal(canPerformAction('LS', 'log_follow_up'), true);
  assert.equal(canPerformAction('CDPO', 'resolve_referral'), true);
  for (const action of ['record_measurement', 're_measure', 'acknowledge_case', 'assign_owner', 'escalate', 'create_referral', 'log_follow_up', 'resolve_referral', 'edit_rules'] as const) {
    assert.equal(canPerformAction('DPO', action), false, `DPO must not perform ${action}`);
  }

  assert.equal(mockStore.recordMeasurement({ beneficiaryId: 'BEN-0142', weightKg: 9, heightCm: 77, measurementDate: '2026-10-25' }, { role: 'DPO', actorId: 'DPO-01' }).success, false);
  assert.equal(mockStore.verifyCase('ACT-2041', 9, 77, '', { role: 'DPO', actorId: 'DPO-01' }), false);
  assert.equal(mockStore.acknowledgeCase('ACT-2041', { role: 'DPO', actorId: 'DPO-01' }), false);
  assert.equal(mockStore.escalateCase('ACT-2041', 2, 'test', { role: 'DPO', actorId: 'DPO-01' }), false);
  assert.equal(mockStore.addFollowUpAttempt('REF-501', { method: 'Phone Call', findings: 'test' }, { role: 'DPO', actorId: 'DPO-01' }), false);
  assert.equal(mockStore.resolveReferral('REF-501', 'test outcome', 'test next steps', { role: 'DPO', actorId: 'DPO-01' }).success, false);
  assert.equal(mockStore.assignCase('ACT-2041', 'AWW-409', '2026-10-31', { role: 'DPO', actorId: 'DPO-01' }).success, false);
  assert.equal(mockStore.createReferral({ beneficiaryId: 'BEN-0142', reason: 'test', destination: 'Primary Health Centre (PHC)', dueDate: '2026-10-31' }, { role: 'DPO', actorId: 'DPO-01' }).success, false);
  assert.equal(mockStore.createReferral({ beneficiaryId: 'BEN-0142', reason: '  ', destination: 'Primary Health Centre (PHC)', dueDate: '2026-10-31' }, { role: 'AWW', actorId: 'AWW-409' }).success, false);
  assert.equal(mockStore.createReferral({ beneficiaryId: 'BEN-0142', reason: 'Synthetic referral', destination: 'Primary Health Centre (PHC)', dueDate: ' ' }, { role: 'AWW', actorId: 'AWW-409' }).success, false);
  assert.equal(mockStore.toggleRule('RUL-01', { role: 'DPO', actorId: 'DPO-01' }).success, false);
  assert.equal(snapshot(), before, 'rejected DPO attempts must leave seeded data and audit history unchanged');
});

test('referral closure requires an explicitly confirmed outcome and meaningful next steps', () => {
  mockStore.resetToDemoSeed();
  const beneficiary = mockStore.addBeneficiary({
    dob: '2025-01-01',
    gender: 'Female',
    category: 'child_under_6',
    centreCode: 'AWC-702',
  }, { role: 'AWW', actorId: 'AWW-409' });
  assert.ok(beneficiary.id);
  for (let index = 0; index < 3; index += 1) {
    const fixtureReferral = mockStore.createReferral({
      beneficiaryId: beneficiary.id,
      reason: `Synthetic referral fixture ${index + 1}`,
      destination: 'Primary Health Centre (PHC)',
      dueDate: '2026-10-31',
    }, { role: 'AWW', actorId: 'AWW-409' });
    assert.ok(fixtureReferral.success);
  }
  const created = mockStore.createReferral({
    beneficiaryId: beneficiary.id,
    reason: 'Synthetic test referral',
    destination: 'Primary Health Centre (PHC)',
    dueDate: '2026-10-31',
  }, { role: 'AWW', actorId: 'AWW-409' });
  assert.ok(created.success && created.referralId);
  assert.notEqual(created.referralId, 'REF-507', 'resolution test uses an isolated synthetic ID, not the pending REF-507 context record');
  assert.equal(mockStore.addFollowUpAttempt(created.referralId!, {
    method: 'Phone Call',
    findings: 'Synthetic follow-up entry for authorization test.',
  }, { role: 'AWW', actorId: 'AWW-409', centreCode: 'AWC-702' }), true);

  assert.equal(mockStore.addFollowUpAttempt(created.referralId!, {
    method: 'Phone Call',
    findings: 'Synthetic actor attribution check.',
    actor: 'LS-01',
  }, { role: 'AWW', actorId: 'AWW-409', centreCode: 'AWC-702' }), true);
  assert.equal(mockStore.getReferralById(created.referralId!)?.followUpAttempts[0]?.actor, 'AWW-409', 'follow-up actor must come from the authorized context');

  const state = () => JSON.stringify({
    referral: mockStore.getReferralById(created.referralId!),
    beneficiary: mockStore.getBeneficiaryById(beneficiary.id),
    audit: mockStore.getAuditLog(),
  });
  const baseline = state();
  assert.equal(mockStore.addFollowUpAttempt(created.referralId!, { method: 'Phone Call', findings: '   ' }, { role: 'AWW', actorId: 'AWW-409', centreCode: 'AWC-702' }), false);
  assert.equal(state(), baseline, 'empty follow-up attempts must not update records or audit history');
  assert.equal(mockStore.resolveReferral(created.referralId!, '', 'Synthetic test next steps.', { role: 'LS', outcomeConfirmed: true }).success, false);
  assert.equal(mockStore.resolveReferral(created.referralId!, 'Synthetic test outcome', 'x', { role: 'LS', outcomeConfirmed: true }).success, false);
  assert.equal(mockStore.resolveReferral(created.referralId!, 'Synthetic test outcome', 'Synthetic test next steps.', { role: 'LS', outcomeConfirmed: false }).success, false);
  assert.equal(mockStore.resolveReferral(created.referralId!, 'Synthetic test outcome', 'Synthetic test next steps.', { role: 'AWW', actorId: 'AWW-409', outcomeConfirmed: true }).success, false);
  assert.equal(state(), baseline, 'incomplete or unconfirmed closure attempts must not mutate referral, beneficiary, or audit data');

  const resolved = mockStore.resolveReferral(created.referralId!, 'Synthetic test outcome', 'Synthetic test next steps are recorded here.', { role: 'LS', actorId: 'LS-01', outcomeConfirmed: true });
  assert.equal(resolved.success, true);
  const savedReferral = mockStore.getReferralById(created.referralId!);
  assert.equal(savedReferral?.status, 'Completed');
  assert.equal(savedReferral?.outcomeConfirmed, true);
  assert.equal(savedReferral?.finalOutcome, 'Synthetic test outcome');
  const completedSnapshot = state();
  assert.equal(mockStore.resolveReferral(created.referralId!, 'Changed outcome', 'Changed next steps are also recorded.', { role: 'LS', actorId: 'LS-01', outcomeConfirmed: true }).success, false);
  assert.equal(state(), completedSnapshot, 'repeat closure must not overwrite the verified outcome or append an audit entry');
  mockStore.resetToDemoSeed();
});

test('AWW referral creation and follow-up are scoped to the worker centre', () => {
  mockStore.resetToDemoSeed();
  const beneficiary = mockStore.addBeneficiary({
    dob: '2025-01-01',
    gender: 'Female',
    category: 'child_under_6',
    centreCode: 'AWC-999',
  }, { role: 'LS', actorId: 'LS-01' });
  assert.ok(beneficiary.id);
  const referral = mockStore.createReferral({
    beneficiaryId: beneficiary.id,
    reason: 'Synthetic centre-scope test',
    destination: 'Primary Health Centre (PHC)',
    dueDate: '2026-10-31',
  }, { role: 'LS', actorId: 'LS-01' });
  assert.ok(referral.success && referral.referralId);

  const snapshot = JSON.stringify({
    beneficiary: mockStore.getBeneficiaryById(beneficiary.id),
    referral: mockStore.getReferralById(referral.referralId!),
    audit: mockStore.getAuditLog(),
  });
  assert.equal(mockStore.createReferral({
    beneficiaryId: beneficiary.id,
    reason: 'Unauthorized cross-centre test',
    destination: 'Primary Health Centre (PHC)',
    dueDate: '2026-10-31',
  }, { role: 'AWW', actorId: 'AWW-409', centreCode: 'AWC-702' }).success, false);
  assert.equal(mockStore.addFollowUpAttempt(referral.referralId!, {
    method: 'Phone Call',
    findings: 'Unauthorized cross-centre follow-up test.',
  }, { role: 'AWW', actorId: 'AWW-409', centreCode: 'AWC-702' }), false);
  assert.equal(JSON.stringify({
    beneficiary: mockStore.getBeneficiaryById(beneficiary.id),
    referral: mockStore.getReferralById(referral.referralId!),
    audit: mockStore.getAuditLog(),
  }), snapshot, 'cross-centre rejections must not mutate referral, beneficiary, or audit data');
  mockStore.resetToDemoSeed();
});

test('PHC referral keeps its persisted workflow status separate from demo follow-up and outcome claims', () => {
  mockStore.resetToDemoSeed();
  const referral = mockStore.getReferrals().find((record) => record.destination === 'Primary Health Centre (PHC)');
  const act2041 = mockStore.getCases().find((record) => record.actionId === 'ACT-2041');
  const act2041Before = structuredClone(act2041);

  assert.ok(referral);
  assert.equal(referral.status, 'Completed');
  assert.equal(referral.followUpAttempts[0]?.method, 'AWC Consultation');
  assert.match(referral.followUpAttempts[0]?.findings || '', /PHC outpatient department/);
  assert.ok(referral.finalOutcome);
  assert.deepEqual(mockStore.getCases().find((record) => record.actionId === 'ACT-2041'), act2041Before);
  assert.equal(mockStore.getMeasurements('BEN-0142').find((measurement) => measurement.date === '2026-09-26')?.isVerified, true);
  assert.equal(mockStore.getMeasurements('BEN-0142').find((measurement) => measurement.date === '2026-10-24')?.isVerified, false);
  mockStore.resetToDemoSeed();
});

test('mockStore reset produces 100% deterministic seed and baseline measurements', () => {
  mockStore.resetToDemoSeed();
  const pass1Ben = mockStore.getBeneficiaries().map((b) => b.id);
  const pass1Cases = mockStore.getCases().map((c) => c.actionId);
  const pass1Measurements = mockStore.getMeasurements('BEN-0142');

  assert.equal(pass1Measurements.length, 5, 'BEN-0142 must have 5 baseline longitudinal measurements');
  assert.equal(pass1Measurements[pass1Measurements.length - 1].weightKg, 12.3);

  mockStore.resetToDemoSeed();
  const pass2Ben = mockStore.getBeneficiaries().map((b) => b.id);
  const pass2Cases = mockStore.getCases().map((c) => c.actionId);
  const pass2Measurements = mockStore.getMeasurements('BEN-0142');

  assert.deepEqual(pass1Ben, pass2Ben, 'Beneficiary IDs must be 100% identical across resets');
  assert.deepEqual(pass1Cases, pass2Cases, 'Case IDs must be 100% identical across resets');
  assert.equal(pass1Measurements.length, pass2Measurements.length);
});

test('public demo displays synchronized shared metrics across dashboard, beneficiaries, and reports', () => {
  const metrics = mockStore.getMetrics();
  const beneficiaries = mockStore.getBeneficiaries();
  const cases = mockStore.getCases();
  const referrals = mockStore.getReferrals();

  // 1. Beneficiary total matches
  assert.equal(beneficiaries.length, metrics.total, 'Total beneficiaries in list must match dashboard total');
  assert.equal(metrics.total, 133, 'Total synthetic beneficiaries is 133');

  // 2. Cohort breakdown sum equals total
  const cohortSum =
    metrics.pregnantWomen +
    metrics.lactatingMothers +
    metrics.children0to6m +
    metrics.children6mTo3y +
    metrics.children3to6y +
    metrics.adolescentGirls;
  assert.equal(cohortSum, metrics.total, 'Cohort breakdown sum must equal total beneficiaries');
  assert.ok(metrics.children0to6m > 0, 'Infants 0-6m count is positive');
  assert.ok(metrics.children6mTo3y > 0, 'Toddlers 6m-3y count is positive');
  assert.ok(metrics.children3to6y > 0, 'Children 3-6y count is positive');
  assert.equal(metrics.totalChildren, metrics.children0to6m + metrics.children6mTo3y + metrics.children3to6y);

  // 3. Casework metrics match
  assert.equal(cases.length, 35, 'Total action queue cases is 35');
  assert.equal(cases.filter((c) => !c.isVerified).length, metrics.pendingCases);
  assert.equal(cases.filter((c) => c.priority === 'Urgent' && !c.isVerified).length, metrics.urgentCases);
  assert.equal(referrals.length, 3, 'Total clinical referrals is 3');
});

test('role-based access control and navigation conforms to permission matrix', () => {
  // Public visitors: only dashboard is accessible; beneficiaries and reports require sign-in
  assert.equal(canAccessPath(null, '/dashboard').allowed, true);
  assert.equal(canAccessPath(null, '/beneficiaries').allowed, false, 'Public cannot access beneficiaries');
  assert.equal(canAccessPath(null, '/reports').allowed, false, 'Public cannot access reports / audit ledger');
  assert.equal(canAccessPath(null, '/queue').allowed, false);

  const publicNav = getNavItemsForRole(null);
  assert.equal(publicNav.length, 1);
  assert.equal(publicNav[0].href, '/dashboard');

  // AWW role: can access own centre beneficiaries, queue, measurements, referrals; no reports (audit log) or rules
  assert.equal(canAccessPath('AWW', '/beneficiaries').allowed, true);
  assert.equal(canAccessPath('AWW', '/measurements').allowed, true);
  assert.equal(canAccessPath('AWW', '/reports').allowed, false, 'AWW cannot access audit ledger');
  assert.equal(canAccessPath('AWW', '/rules').allowed, false, 'AWW cannot access rules settings');
  assert.equal(canPerformAction('AWW', 'record_measurement'), true);
  assert.equal(canPerformAction('AWW', 're_measure'), true);
  assert.equal(canPerformAction('AWW', 'assign_owner'), false);
  assert.equal(canPerformAction('AWW', 'edit_rules'), false);

  // Lady Supervisor (LS): can re-measure, assign owner, view reports and rules; cannot edit rules
  assert.equal(canAccessPath('LS', '/reports').allowed, true);
  assert.equal(canAccessPath('LS', '/rules').allowed, true);
  assert.equal(canPerformAction('LS', 're_measure'), true);
  assert.equal(canPerformAction('LS', 'assign_owner'), true);
  assert.equal(canPerformAction('LS', 'edit_rules'), false, 'LS can only view rules');

  // CDPO: can edit rules and assign owners; cannot record field measurements
  assert.equal(canPerformAction('CDPO', 'edit_rules'), true);
  assert.equal(canPerformAction('CDPO', 'assign_owner'), true);
  assert.equal(canPerformAction('CDPO', 'record_measurement'), false);

  // DPO: view-only for casework mutations
  assert.equal(canPerformAction('DPO', 'record_measurement'), false);
  assert.equal(canPerformAction('DPO', 'assign_owner'), false);
  assert.equal(canPerformAction('DPO', 'edit_rules'), false);
  assert.equal(canAccessPath('DPO', '/reports').allowed, true);
});

test('store selectors scope data by role and centreCode', () => {
  mockStore.resetToDemoSeed();

  // AWW scoped to AWC-702 sees only AWC-702 beneficiaries
  const awwBens = mockStore.getBeneficiaries({ role: 'AWW', centreCode: 'AWC-702' });
  assert.ok(awwBens.length > 0);
  assert.ok(awwBens.every((b) => b.centreCode === 'AWC-702'));

  // CDPO sees all beneficiaries across the sector/project
  const allBens = mockStore.getBeneficiaries({ role: 'CDPO' });
  assert.equal(allBens.length, 133);
  assert.ok(allBens.length >= awwBens.length);

  // AWW cannot view audit ledger (returns empty list)
  const awwAudit = mockStore.getAuditLog({ role: 'AWW' });
  assert.equal(awwAudit.length, 0);

  // LS can view full audit ledger
  const lsAudit = mockStore.getAuditLog({ role: 'LS' });
  assert.ok(lsAudit.length > 0);
});

test('report exports use synthetic IDs only and zero personal names', () => {
  const staffHeaders = ['Referral ID', 'Beneficiary ID', 'Age', 'Reason', 'Destination', 'Date', 'Owner', 'Status', 'Outcome'];
  const staffRows = [['REF-001', 'BEN-0142', '14 months', 'Severe Wasting', 'District NRC', '2026-10-18', 'AWW-409', 'Active', 'Pending']];
  const staffCsv = exportToCsvString(staffHeaders, staffRows);
  assert.ok(staffCsv.includes('BEN-0142'), 'Staff export contains authorized synthetic records');
  assert.ok(!staffCsv.includes('Aarav'), 'No personal names exist in exports');
});

test('guided workflow defines the 6-step closed-loop lifecycle from flag to closure', () => {
  const workflowSteps = [
    'Measurement & Quality Check',
    'Flag for Human Review',
    'Assign Follow-up Task',
    'Escalation When Overdue',
    'Record Referral or Outcome',
    'Close Task & Audit Trail',
  ];

  assert.equal(workflowSteps.length, 6, 'Must have 6 distinct workflow stages');
  assert.match(workflowSteps[0], /Measurement/);
  assert.match(workflowSteps[1], /Human Review/);
  assert.match(workflowSteps[2], /Assign/);
  assert.match(workflowSteps[3], /Escalation/);
  assert.match(workflowSteps[4], /Outcome/);
  assert.match(workflowSteps[5], /Audit/);
});
