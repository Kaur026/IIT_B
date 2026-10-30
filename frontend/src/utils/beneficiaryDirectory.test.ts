import assert from 'node:assert/strict';
import test from 'node:test';
import { mockStore } from '../store/mockStore.ts';
import { filterBeneficiaries, paginateBeneficiaries } from './beneficiaryDirectory.ts';

test('beneficiary search and cohort/status filters cover all 600 synthetic records', () => {
  mockStore.resetToDemoSeed();
  const beneficiaries = mockStore.getBeneficiaries();
  assert.equal(beneficiaries.length, 600);

  const idMatch = filterBeneficiaries(beneficiaries, {
    search: 'BEN-10000', cohort: 'all', status: 'all', monitoring: 'all',
  });
  assert.equal(idMatch.length, 1);
  assert.equal(idMatch[0].id, 'BEN-10000');

  const nameMatch = filterBeneficiaries(beneficiaries, {
    search: beneficiaries[599].name, cohort: 'all', status: 'all', monitoring: 'all',
  });
  assert.ok(nameMatch.some((beneficiary) => beneficiary.id === beneficiaries[599].id));
  assert.equal(filterBeneficiaries(beneficiaries, {
    search: '', cohort: 'pregnant', status: 'all', monitoring: 'all',
  }).length, 137);
  assert.equal(filterBeneficiaries(beneficiaries, {
    search: '', cohort: 'lactating', status: 'all', monitoring: 'all',
  }).length, 91);
  const adolescentGirls = filterBeneficiaries(beneficiaries, {
    search: '', cohort: 'adolescentGirls', status: 'all', monitoring: 'all',
  });
  assert.equal(adolescentGirls.length, 50);
  assert.ok(adolescentGirls.every((beneficiary) => beneficiary.category === 'adolescent' && beneficiary.gender === 'Female'));
  assert.ok(filterBeneficiaries(beneficiaries, {
    search: '', cohort: 'all', status: 'Under Monitoring', monitoring: 'flagged',
  }).every((beneficiary) => beneficiary.status === 'Under Monitoring' && beneficiary.hasActiveFlag));
  assert.ok(filterBeneficiaries(beneficiaries, {
    search: '', cohort: 'all', status: 'all', monitoring: 'stale',
  }).every((beneficiary) => beneficiary.category === 'child_under_6'));
});

test('pagination traverses the complete filtered dataset exactly once', () => {
  mockStore.resetToDemoSeed();
  const beneficiaries = mockStore.getBeneficiaries();
  const pages = Array.from({ length: Math.ceil(beneficiaries.length / 12) }, (_, index) =>
    paginateBeneficiaries(beneficiaries, index + 1, 12));
  const paginated = pages.flat();
  assert.equal(paginated.length, 600);
  assert.deepEqual(paginated.map((beneficiary) => beneficiary.id), beneficiaries.map((beneficiary) => beneficiary.id));
  assert.equal(new Set(paginated.map((beneficiary) => beneficiary.id)).size, 600);
  assert.deepEqual(paginateBeneficiaries(beneficiaries, 51, 12), []);
});
