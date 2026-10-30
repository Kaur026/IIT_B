import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runCategorySpecificScreening,
  explainCase,
  getBeneficiaryHistorySummary,
  suggestNextAction,
  generateDailyBriefing,
} from './aiScreeningService.ts';
import { mockStore, type BeneficiaryCase, type BeneficiaryRecord } from '../store/mockStore.ts';
import { getTodayISODate } from '../utils/casework.ts';

// ============================================================================
// PART 8 — TEST CASES FOR EVERY BENEFICIARY CATEGORY
// ============================================================================

test('Category 1: Children 0–6 months screening logic', () => {
  // 1. Normal complete infant record
  const normal = runCategorySpecificScreening({
    beneficiaryId: 'TEST-INF-01',
    category: 'child_under_6',
    dob: '2025-12-01', // ~2 months old
    gender: 'Female',
    currentWeightKg: 5.2,
    currentHeightCm: 57.5,
    birthWeightKg: 3.1,
    previousRecord: { weightKg: 4.5, heightCm: 55.0, date: '2026-01-01' },
    measurementDate: '2026-02-01',
  });
  assert.equal(normal.subcategory, 'child_0_6m');
  assert.equal(normal.screeningStatus, 'Normal');
  assert.equal(normal.flags.length, 0);
  assert.equal(normal.humanReviewRequired, false);

  // 2. Missing weight or length
  const missing = runCategorySpecificScreening({
    beneficiaryId: 'TEST-INF-02',
    category: 'child_under_6',
    dob: '2025-12-15',
    gender: 'Male',
    currentWeightKg: undefined,
    currentHeightCm: 54.0,
  });
  assert.equal(missing.screeningStatus, 'Insufficient Data');
  assert.ok(missing.missingFields.includes('weightKg'));

  // 3. Low Birth Weight intake (< 2.5 kg)
  const lbw = runCategorySpecificScreening({
    beneficiaryId: 'TEST-INF-03',
    category: 'child_under_6',
    dob: '2026-01-10',
    gender: 'Female',
    currentWeightKg: 3.2,
    currentHeightCm: 49.0,
    birthWeightKg: 2.1,
    measurementDate: '2026-02-01',
  });
  assert.equal(lbw.subcategory, 'child_0_6m');
  assert.equal(lbw.screeningStatus, 'Needs Attention');
  assert.ok(lbw.triggeredRuleIds.includes('INF-01-LBW'));
  assert.match(lbw.explanation, /Low Birth Weight/);

  // 4. Early infancy weight faltering (zero gain across 30 days)
  const falter = runCategorySpecificScreening({
    beneficiaryId: 'TEST-INF-04',
    category: 'child_under_6',
    dob: '2025-10-15',
    gender: 'Male',
    currentWeightKg: 4.8,
    currentHeightCm: 58.0,
    previousRecord: { weightKg: 4.8, heightCm: 57.0, date: '2025-12-15' },
    measurementDate: '2026-01-15',
  });
  assert.equal(falter.screeningStatus, 'Urgent');
  assert.ok(falter.triggeredRuleIds.includes('INF-02-FALTER'));

  // 5. Acute infant biomarker depletion (rapid drop)
  const depletion = runCategorySpecificScreening({
    beneficiaryId: 'TEST-INF-05',
    category: 'child_under_6',
    dob: '2025-11-01',
    gender: 'Female',
    currentWeightKg: 4.1,
    currentHeightCm: 56.0,
    previousRecord: { weightKg: 4.6, heightCm: 56.0, date: '2026-01-01' },
    measurementDate: '2026-01-20',
  });
  assert.equal(depletion.screeningStatus, 'Urgent');
  assert.ok(depletion.triggeredRuleIds.includes('INF-03-DEPLETION'));
  assert.equal(depletion.suggestedNextAction.actionCode, 'clinical_referral');
});

test('Category 2: Children 6 months–3 years screening logic', () => {
  // 1. Normal complete toddler record
  const normal = runCategorySpecificScreening({
    beneficiaryId: 'TEST-TOD-01',
    category: 'child_under_6',
    dob: '2024-08-15', // ~18 months old
    gender: 'Male',
    currentWeightKg: 10.8,
    currentHeightCm: 81.5,
    muacCm: 14.2,
    hasBilateralEdema: false,
    previousRecord: { weightKg: 10.5, heightCm: 80.0, date: '2026-01-01' },
    measurementDate: '2026-02-01',
  });
  assert.equal(normal.subcategory, 'child_6m_3y');
  assert.equal(normal.screeningStatus, 'Normal');

  // 2. Missing MUAC in toddler
  const missingMuac = runCategorySpecificScreening({
    beneficiaryId: 'TEST-TOD-02',
    category: 'child_under_6',
    dob: '2024-06-01',
    gender: 'Female',
    currentWeightKg: 9.8,
    currentHeightCm: 78.0,
  });
  assert.equal(missingMuac.screeningStatus, 'Insufficient Data');
  assert.ok(missingMuac.missingFields.includes('muacCm'));

  // 3. Negative length / height step (RUL-02)
  const negativeHeight = runCategorySpecificScreening({
    beneficiaryId: 'TEST-TOD-03',
    category: 'child_under_6',
    dob: '2024-05-10',
    gender: 'Female',
    currentWeightKg: 9.5,
    currentHeightCm: 76.5,
    muacCm: 13.5,
    previousRecord: { weightKg: 9.4, heightCm: 78.0, date: '2026-01-01' },
    measurementDate: '2026-02-01',
  });
  assert.equal(negativeHeight.screeningStatus, 'Needs Attention');
  assert.ok(negativeHeight.triggeredRuleIds.includes('RUL-02'));
  assert.equal(negativeHeight.suggestedNextAction.actionCode, 'supervisor_verification');
  assert.equal(negativeHeight.suggestedNextAction.targetRole, 'LS');

  // 4. SAM by MUAC (< 11.5 cm)
  const sam = runCategorySpecificScreening({
    beneficiaryId: 'TEST-TOD-04',
    category: 'child_under_6',
    dob: '2024-03-01',
    gender: 'Male',
    currentWeightKg: 7.8,
    currentHeightCm: 77.0,
    muacCm: 11.2,
    previousRecord: { weightKg: 8.5, heightCm: 76.5, date: '2026-01-01' },
    measurementDate: '2026-02-01',
  });
  assert.equal(sam.screeningStatus, 'Urgent');
  assert.ok(sam.triggeredRuleIds.includes('CLIN-MUAC-RED'));
  assert.equal(sam.suggestedNextAction.actionCode, 'clinical_referral');

  // 5. Bilateral Edema
  const edema = runCategorySpecificScreening({
    beneficiaryId: 'TEST-TOD-05',
    category: 'child_under_6',
    dob: '2024-04-01',
    gender: 'Female',
    currentWeightKg: 8.2,
    currentHeightCm: 76.0,
    muacCm: 12.8,
    hasBilateralEdema: true,
  });
  assert.equal(edema.screeningStatus, 'Urgent');
  assert.ok(edema.triggeredRuleIds.includes('CLIN-EDEMA'));
});

test('Category 3: Children 3–6 years screening logic', () => {
  // 1. Normal preschool child
  const normal = runCategorySpecificScreening({
    beneficiaryId: 'TEST-PRE-01',
    category: 'child_under_6',
    dob: '2022-01-15', // ~4 years old
    gender: 'Female',
    currentWeightKg: 15.6,
    currentHeightCm: 101.5,
    previousRecord: { weightKg: 15.3, heightCm: 100.5, date: '2026-01-01' },
    measurementDate: '2026-02-01',
  });
  assert.equal(normal.subcategory, 'child_3_6y');
  assert.equal(normal.screeningStatus, 'Normal');

  // 2. Supra-Physiological Stature Delta (RUL-05)
  const supra = runCategorySpecificScreening({
    beneficiaryId: 'TEST-PRE-02',
    category: 'child_under_6',
    dob: '2022-03-01',
    gender: 'Male',
    currentWeightKg: 16.0,
    currentHeightCm: 108.0,
    previousRecord: { weightKg: 15.8, heightCm: 102.0, date: '2026-01-01' }, // +6.0 cm in 31 days
    measurementDate: '2026-02-01',
  });
  assert.equal(supra.screeningStatus, 'Needs Attention');
  assert.ok(supra.triggeredRuleIds.includes('RUL-05'));

  // 3. Multi-month growth stagnation across 60 days
  const stag = runCategorySpecificScreening({
    beneficiaryId: 'TEST-PRE-03',
    category: 'child_under_6',
    dob: '2021-11-01',
    gender: 'Female',
    currentWeightKg: 14.5,
    currentHeightCm: 99.0,
    previousRecord: { weightKg: 14.5, heightCm: 98.5, date: '2025-11-20' }, // 73 days, 0 gain
    measurementDate: '2026-02-01',
  });
  assert.equal(stag.screeningStatus, 'Needs Attention');
  assert.ok(stag.triggeredRuleIds.includes('RUL-04'));
});

test('Category 4: Adolescent Girls (10–19 years) screening logic', () => {
  // 1. Normal complete adolescent girl
  const normal = runCategorySpecificScreening({
    beneficiaryId: 'TEST-ADOL-01',
    category: 'adolescent',
    dob: '2012-05-15', // ~13.5 years old
    gender: 'Female',
    currentWeightKg: 46.0,
    currentHeightCm: 152.0, // BMI = 19.9 (normal)
    hemoglobinGdl: 12.8,
  });
  assert.equal(normal.subcategory, 'adolescent');
  assert.equal(normal.screeningStatus, 'Normal');

  // 2. Severe Adolescent Thinness (BMI < 16.0)
  const thin = runCategorySpecificScreening({
    beneficiaryId: 'TEST-ADOL-02',
    category: 'adolescent',
    dob: '2011-02-10', // 15 years old
    gender: 'Female',
    currentWeightKg: 32.0,
    currentHeightCm: 155.0, // BMI = 32 / (1.55^2) = 13.3
    hemoglobinGdl: 12.0,
  });
  assert.equal(thin.screeningStatus, 'Urgent');
  assert.ok(thin.triggeredRuleIds.includes('ADOL-01-THIN'));

  // 3. Mild Anemia in Adolescent Girl (Hb 10.5 g/dL)
  const anemia = runCategorySpecificScreening({
    beneficiaryId: 'TEST-ADOL-03',
    category: 'adolescent',
    dob: '2013-01-01',
    gender: 'Female',
    currentWeightKg: 39.0,
    currentHeightCm: 148.0,
    hemoglobinGdl: 10.5,
  });
  assert.equal(anemia.screeningStatus, 'Needs Attention');
  assert.ok(anemia.triggeredRuleIds.includes('ADOL-04-ANEMIA-MILD'));
  assert.equal(anemia.suggestedNextAction.actionCode, 'wifs_supplementation');
});

test('Category 5: Pregnant Women screening logic', () => {
  // 1. Normal complete pregnancy record
  const normal = runCategorySpecificScreening({
    beneficiaryId: 'TEST-PW-01',
    category: 'pregnant',
    dob: '2001-04-10', // 24 years old
    gender: 'Female',
    currentWeightKg: 55.0,
    currentHeightCm: 156.0,
    hemoglobinGdl: 11.8,
    previousRecord: { weightKg: 53.5, heightCm: 156.0, date: '2026-01-01' }, // +1.5 kg gain
    measurementDate: '2026-02-01',
  });
  assert.equal(normal.subcategory, 'pregnant');
  assert.equal(normal.screeningStatus, 'Normal');

  // 2. Short Maternal Stature (< 145 cm)
  const shortStature = runCategorySpecificScreening({
    beneficiaryId: 'TEST-PW-02',
    category: 'pregnant',
    dob: '2003-08-15',
    gender: 'Female',
    currentWeightKg: 46.0,
    currentHeightCm: 142.0,
    hemoglobinGdl: 11.5,
  });
  assert.equal(shortStature.screeningStatus, 'Needs Attention');
  assert.ok(shortStature.triggeredRuleIds.includes('MAT-01-SHORT-STATURE'));

  // 3. Inadequate Gestational Weight Gain (< 1.0 kg/month)
  const lowGain = runCategorySpecificScreening({
    beneficiaryId: 'TEST-PW-03',
    category: 'pregnant',
    dob: '2002-01-01',
    gender: 'Female',
    currentWeightKg: 48.2,
    currentHeightCm: 150.0,
    hemoglobinGdl: 11.2,
    previousRecord: { weightKg: 48.0, heightCm: 150.0, date: '2026-01-01' }, // +0.2 kg in 31 days
    measurementDate: '2026-02-01',
  });
  assert.equal(lowGain.screeningStatus, 'Needs Attention');
  assert.ok(lowGain.triggeredRuleIds.includes('MAT-02-LOW-WEIGHT-GAIN'));

  // 4. Severe Maternal Anemia (Hb < 7.0 g/dL)
  const severeAnemia = runCategorySpecificScreening({
    beneficiaryId: 'TEST-PW-04',
    category: 'pregnant',
    dob: '2000-09-20',
    gender: 'Female',
    currentWeightKg: 52.0,
    currentHeightCm: 153.0,
    hemoglobinGdl: 6.4,
  });
  assert.equal(severeAnemia.screeningStatus, 'Urgent');
  assert.ok(severeAnemia.triggeredRuleIds.includes('MAT-04-ANEMIA-SEVERE'));
});

test('Category 6: Lactating Mothers screening logic', () => {
  // 1. Normal lactating mother record
  const normal = runCategorySpecificScreening({
    beneficiaryId: 'TEST-LM-01',
    category: 'lactating',
    dob: '2002-07-15', // 23 years old
    gender: 'Female',
    currentWeightKg: 52.0,
    currentHeightCm: 154.0, // BMI = 21.9
    hemoglobinGdl: 12.2,
  });
  assert.equal(normal.subcategory, 'lactating');
  assert.equal(normal.screeningStatus, 'Normal');

  // 2. Maternal Postpartum Undernutrition (BMI < 18.5)
  const undernutrition = runCategorySpecificScreening({
    beneficiaryId: 'TEST-LM-02',
    category: 'lactating',
    dob: '2004-03-10',
    gender: 'Female',
    currentWeightKg: 38.0,
    currentHeightCm: 152.0, // BMI = 16.4
    hemoglobinGdl: 12.0,
  });
  assert.equal(undernutrition.screeningStatus, 'Needs Attention');
  assert.ok(undernutrition.triggeredRuleIds.includes('LAC-01-UNDERWEIGHT'));

  // 3. Severe Postpartum Anemia (Hb < 8.0 g/dL)
  const severeAnemia = runCategorySpecificScreening({
    beneficiaryId: 'TEST-LM-03',
    category: 'lactating',
    dob: '2001-11-20',
    gender: 'Female',
    currentWeightKg: 49.0,
    currentHeightCm: 151.0,
    hemoglobinGdl: 7.2,
  });
  assert.equal(severeAnemia.screeningStatus, 'Urgent');
  assert.ok(severeAnemia.triggeredRuleIds.includes('LAC-02-ANEMIA-SEVERE'));
});

test('Cross-category isolation and determinism', () => {
  // Determinism check: same inputs produce strictly identical results
  const inputParams: Parameters<typeof runCategorySpecificScreening>[0] = {
    beneficiaryId: 'DET-01',
    category: 'child_under_6',
    dob: '2024-01-01',
    gender: 'Female',
    currentWeightKg: 8.5,
    currentHeightCm: 74.0,
    muacCm: 11.2,
  };
  const r1 = runCategorySpecificScreening(inputParams);
  const r2 = runCategorySpecificScreening(inputParams);
  assert.deepEqual(r1.flags, r2.flags);
  assert.equal(r1.screeningStatus, r2.screeningStatus);

  // Child rules never run on maternal record
  const maternalInput: Parameters<typeof runCategorySpecificScreening>[0] = {
    beneficiaryId: 'MAT-ISO-01',
    category: 'pregnant',
    dob: '2000-01-01',
    gender: 'Female',
    currentWeightKg: 50.0,
    currentHeightCm: 140.0, // Short stature (< 145)
    previousRecord: { weightKg: 50.5, heightCm: 140.0, date: '2026-01-01' }, // -0.5 kg
    measurementDate: '2026-02-01',
  };
  const maternalResult = runCategorySpecificScreening(maternalInput);
  assert.ok(!maternalResult.triggeredRuleIds.includes('RUL-02'));
  assert.ok(!maternalResult.triggeredRuleIds.includes('RUL-03'));
  assert.ok(maternalResult.triggeredRuleIds.includes('MAT-01-SHORT-STATURE'));

  // Maternal rules never run on child record
  const childInput: Parameters<typeof runCategorySpecificScreening>[0] = {
    beneficiaryId: 'CHILD-ISO-01',
    category: 'child_under_6',
    dob: '2024-01-01',
    gender: 'Male',
    currentWeightKg: 10.0,
    currentHeightCm: 80.0,
    muacCm: 14.0,
  };
  const childResult = runCategorySpecificScreening(childInput);
  assert.ok(!childResult.triggeredRuleIds.some((id) => id.startsWith('MAT-') || id.startsWith('LAC-') || id.startsWith('ADOL-')));
});

test('AI Feature 1: Explain Case explains height in cm for RUL-02 and weight in kg for RUL-03', () => {
  mockStore.resetToDemoSeed();
  const heightCase = mockStore.getCaseById('BEN-1019');
  assert.ok(heightCase);
  assert.equal(heightCase.ruleCode, 'RUL-02');

  const explanation = explainCase({ caseItem: heightCase });
  assert.equal(explanation.measurementUnits.type, 'height');
  assert.equal(explanation.measurementUnits.unit, 'cm');
  assert.match(explanation.comparison.previousValue, /cm/);
  assert.match(explanation.comparison.flaggedValue, /cm/);
  assert.match(explanation.whyNeedsAttention, /Stature cannot decrease/);
  assert.equal(explanation.humanReviewRequired, true);

  const weightCase = mockStore.getCaseById('BEN-1038');
  assert.ok(weightCase);
  assert.equal(weightCase.ruleCode, 'RUL-03');

  const weightExplanation = explainCase({ caseItem: weightCase });
  assert.equal(weightExplanation.measurementUnits.type, 'weight');
  assert.equal(weightExplanation.measurementUnits.unit, 'kg');
  assert.match(weightExplanation.comparison.previousValue, /kg/);
  assert.match(weightExplanation.whyNeedsAttention, /Rapid weight loss/);
});

test('AI Feature 2: Beneficiary History Summary derives from stored records', () => {
  mockStore.resetToDemoSeed();
  const beneficiary = mockStore.getBeneficiaryById('BEN-1019');
  assert.ok(beneficiary);

  const measurements = mockStore.getMeasurements(beneficiary.id);
  const cases = mockStore.getCases().filter((c) => c.id === beneficiary.id);
  const referrals = mockStore.getReferrals().filter((r) => r.beneficiaryId === beneficiary.id);

  const summary = getBeneficiaryHistorySummary({
    beneficiary,
    measurements,
    cases,
    referrals,
  });

  assert.equal(summary.beneficiaryId, beneficiary.id);
  assert.equal(summary.totalMeasurements, measurements.length);
  assert.ok(summary.narrativeSummary.includes(beneficiary.name));
  assert.ok(summary.disclaimer.includes('Not a medical diagnosis'));
});

test('AI Feature 3 & 4: Suggest Next Action & Decision RBAC enforcement', () => {
  mockStore.resetToDemoSeed();
  const heightCase = mockStore.getCaseById('BEN-1019');
  assert.ok(heightCase);

  const suggestion = suggestNextAction({ caseItem: heightCase });
  assert.equal(suggestion.actionCode, 'supervisor_verification');
  assert.equal(suggestion.requiresSupervisorRole, true);

  // AWW cannot accept supervisor_verification
  const awwAttempt = mockStore.recordAIDecision({
    beneficiaryId: heightCase.id,
    caseActionId: heightCase.actionId,
    suggestionId: suggestion.suggestionId,
    decision: 'accept',
    actionCode: suggestion.actionCode,
    centreCode: heightCase.centreCode,
  }, { role: 'AWW', actorId: 'AWW-409', centreCode: 'AWC-702' });
  assert.equal(awwAttempt.success, false);
  assert.match(awwAttempt.error || '', /Lady Supervisor \(LS\) or CDPO role is required/);

  // DPO cannot record decisions (view-only)
  const dpoAttempt = mockStore.recordAIDecision({
    beneficiaryId: heightCase.id,
    caseActionId: heightCase.actionId,
    suggestionId: suggestion.suggestionId,
    decision: 'accept',
    actionCode: 're_measure',
    centreCode: heightCase.centreCode,
  }, { role: 'DPO', actorId: 'DPO-01' });
  assert.equal(dpoAttempt.success, false);
  assert.match(dpoAttempt.error || '', /view-only/);

  // LS can accept supervisor_verification
  const lsAttempt = mockStore.recordAIDecision({
    beneficiaryId: heightCase.id,
    caseActionId: heightCase.actionId,
    suggestionId: suggestion.suggestionId,
    decision: 'accept',
    actionCode: suggestion.actionCode,
    centreCode: heightCase.centreCode,
  }, { role: 'LS', actorId: 'LS-01', sectorCode: 'Sector-4' });
  assert.equal(lsAttempt.success, true);
  assert.ok(lsAttempt.id);

  const savedDecisions = mockStore.getAIDecisions();
  assert.ok(savedDecisions.some((d) => d.id === lsAttempt.id));
});

test('AI Feature 5: Daily AI Briefing scoping across roles', () => {
  mockStore.resetToDemoSeed();

  // AWW Briefing: strictly scoped to AWC-702 (225 beneficiaries)
  const awwScope = { role: 'AWW' as const, actorId: 'AWW-409', centreCode: 'AWC-702' };
  const awwBens = mockStore.getBeneficiaries(awwScope);
  const awwCases = mockStore.getCases(awwScope);
  const awwReferrals = mockStore.getReferrals(awwScope);
  const awwTasks = mockStore.getTasks(awwScope);
  const awwMeasurements = mockStore.getMeasurements(undefined, awwScope);

  const awwBriefing = generateDailyBriefing({
    scope: awwScope,
    beneficiaries: awwBens,
    cases: awwCases,
    referrals: awwReferrals,
    tasks: awwTasks,
    measurements: awwMeasurements,
  });
  assert.equal(awwBriefing.totalBeneficiaries, 225);
  assert.match(awwBriefing.scopeSummary, /AWC-702/);

  // CDPO Briefing: project-wide scope (all 600 beneficiaries)
  const cdpoScope = { role: 'CDPO' as const, actorId: 'CDPO-01', projectCode: 'Project-Central' };
  const cdpoBens = mockStore.getBeneficiaries(cdpoScope);
  const cdpoCases = mockStore.getCases(cdpoScope);
  const cdpoReferrals = mockStore.getReferrals(cdpoScope);
  const cdpoTasks = mockStore.getTasks(cdpoScope);
  const cdpoMeasurements = mockStore.getMeasurements(undefined, cdpoScope);

  const cdpoBriefing = generateDailyBriefing({
    scope: cdpoScope,
    beneficiaries: cdpoBens,
    cases: cdpoCases,
    referrals: cdpoReferrals,
    tasks: cdpoTasks,
    measurements: cdpoMeasurements,
  });
  assert.equal(cdpoBriefing.totalBeneficiaries, 600);
  assert.match(cdpoBriefing.scopeSummary, /Project-Central/);
});
