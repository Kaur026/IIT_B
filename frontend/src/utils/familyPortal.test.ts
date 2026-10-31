import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_CONFIGS,
  isValidDemoPersona,
  getNavItemsForRole,
  canAccessPath,
  canPerformAction,
  type UserRole,
} from './permissions.ts';
import { mockStore, type DemoScope } from '../store/mockStore.ts';

test('Parent/Family role configuration and persona validation', () => {
  const config = ROLE_CONFIGS['Parent/Family'];
  assert.ok(config, 'Parent/Family role config must exist');
  assert.equal(config.role, 'Parent/Family');
  assert.equal(config.label, 'Parent / Family Member');
  assert.equal(config.scopeLevel, 'Family');
  assert.equal(config.defaultId, 'FAM-0142');

  // Valid persona
  assert.equal(
    isValidDemoPersona({
      id: 'FAM-0142',
      role: 'Parent/Family',
      roleLabel: 'Parent / Family Member',
      signedInAt: '2026-10-31T00:00:00.000Z',
    }),
    true,
    'Standard family demo persona must be valid'
  );

  // Custom family ID with FAM- prefix
  assert.equal(
    isValidDemoPersona({
      id: 'FAM-0999',
      role: 'Parent/Family',
      roleLabel: 'Parent / Family Member',
      signedInAt: '2026-10-31T00:00:00.000Z',
    }),
    true,
    'Custom family persona with FAM- prefix must be valid'
  );

  // Invalid persona (wrong roleLabel)
  assert.equal(
    isValidDemoPersona({
      id: 'FAM-0142',
      role: 'Parent/Family',
      roleLabel: 'Administrator',
      signedInAt: '2026-10-31T00:00:00.000Z',
    }),
    false,
    'Persona with mismatched roleLabel must be rejected'
  );
});

test('Parent/Family navigation items are scoped and oriented to child growth', () => {
  const navItems = getNavItemsForRole('Parent/Family');
  assert.equal(navItems.length, 6, 'Parent/Family should receive exactly 6 navigation items');

  const ids = navItems.map((item) => item.id);
  assert.deepEqual(ids, [
    'dashboard',
    'child-profile',
    'growth-tracking',
    'nutrition-care',
    'history',
    'profile',
  ]);

  const hrefs = navItems.map((item) => item.href);
  assert.ok(hrefs.includes('/dashboard'));
  assert.ok(hrefs.includes('/dashboard#child-profile'));
  assert.ok(hrefs.includes('/dashboard#growth-tracking'));
  assert.ok(hrefs.includes('/dashboard#nutrition-care'));
  assert.ok(hrefs.includes('/dashboard#history'));
  assert.ok(hrefs.includes('/profile'));
});

test('Parent/Family route RBAC blocks frontline staff screens and permits family portal', () => {
  // Permitted paths
  assert.equal(canAccessPath('Parent/Family', '/dashboard').allowed, true);
  assert.equal(canAccessPath('Parent/Family', '/family').allowed, true);
  assert.equal(canAccessPath('Parent/Family', '/profile').allowed, true);
  assert.equal(canAccessPath('Parent/Family', '/signin').allowed, true);
  assert.equal(canAccessPath('Parent/Family', '/').allowed, true);

  // Restricted frontline staff paths
  const blockedPaths = [
    '/beneficiaries',
    '/beneficiaries/register',
    '/centres',
    '/measurements',
    '/queue',
    '/referrals',
    '/reports',
    '/rules',
  ];

  for (const path of blockedPaths) {
    const access = canAccessPath('Parent/Family', path);
    assert.equal(access.allowed, false, `Path ${path} must be blocked for Parent/Family`);
    assert.ok(access.reason?.includes('restricted to authorized field staff'), `Reason must explain staff restriction for ${path}`);
  }
});

test('Parent/Family data isolation in mockStore prevents cross-family data leakage', () => {
  const familyScope: DemoScope = {
    role: 'Parent/Family',
    familyId: 'FAM-0142',
    linkedBeneficiaryIds: ['BEN-0142'],
  };

  // 1. Beneficiaries query: should return ONLY 1 record (not all 600)
  const bens = mockStore.getBeneficiaries(familyScope);
  assert.equal(bens.length, 1, 'Family user must strictly view only their linked beneficiary');
  assert.equal(bens[0].id, 'BEN-0142');
  assert.equal(bens[0].name, 'Aarav Sharma');

  // 2. Direct ID lookup for own child
  const ownChild = mockStore.getBeneficiaryById('BEN-0142', familyScope);
  assert.ok(ownChild, 'Parent must be able to view their own linked child');
  assert.equal(ownChild?.name, 'Aarav Sharma');

  // 3. Direct ID lookup for other family's child (e.g. BEN-0219): strictly blocked
  const otherChild = mockStore.getBeneficiaryById('BEN-0219', familyScope);
  assert.equal(otherChild, undefined, 'Parent must NOT be able to view other families children');

  // 4. Measurements scoping: should only return measurements for BEN-0142
  const familyMeas = mockStore.getMeasurements(undefined, familyScope);
  assert.ok(familyMeas.length > 0, 'Must have measurements for BEN-0142');
  assert.ok(
    familyMeas.every((m) => m.beneficiaryId === 'BEN-0142'),
    'All returned measurements must belong exclusively to the linked child'
  );

  // 5. Casework & audit scoping: no raw staff operational cases or audit entries
  const cases = mockStore.getCases(familyScope);
  assert.equal(cases.length, 0, 'Parent must not see frontline staff operational casework queues');

  const audit = mockStore.getAuditLog(familyScope);
  assert.equal(audit.length, 0, 'Parent must not see staff system audit logs');
});

test('Parent/Family empty state when no child is linked', () => {
  const unlinkedScope: DemoScope = {
    role: 'Parent/Family',
    familyId: 'FAM-9999',
    linkedBeneficiaryIds: [],
  };

  const bens = mockStore.getBeneficiaries(unlinkedScope);
  assert.equal(bens.length, 0, 'Unlinked family must receive 0 beneficiaries');

  const child = mockStore.getBeneficiaryById('BEN-0142', unlinkedScope);
  assert.equal(child, undefined, 'Unlinked family cannot view unlinked child');

  const meas = mockStore.getMeasurements(undefined, unlinkedScope);
  assert.equal(meas.length, 0, 'Unlinked family must receive 0 measurements');
});

test('Parent/Family cannot perform any write mutations or staff actions', () => {
  const familyScope: DemoScope = {
    role: 'Parent/Family',
    familyId: 'FAM-0142',
    linkedBeneficiaryIds: ['BEN-0142'],
  };

  // Check canPerformAction
  const actions = [
    'record_measurement',
    're_measure',
    'acknowledge_case',
    'assign_owner',
    'escalate',
    'create_referral',
    'log_follow_up',
    'resolve_referral',
    'manage_users',
    'manage_org_assignments',
  ] as const;

  for (const act of actions) {
    assert.equal(
      canPerformAction('Parent/Family', act),
      false,
      `Action ${act} must be forbidden for Parent/Family`
    );
  }

  // Attempting store write operations must fail safely
  const measResult = mockStore.recordMeasurement(
    { beneficiaryId: 'BEN-0142', weightKg: 10, heightCm: 75 },
    familyScope
  );
  assert.equal(measResult.success, false, 'Parent/Family cannot record measurements');

  const verifyResult = mockStore.verifyCase(
    'ACT-01',
    10,
    75,
    'Unauthorized verification',
    familyScope
  );
  assert.equal(verifyResult, false, 'Parent/Family cannot verify cases');

  const referralResult = mockStore.createReferral(
    {
      beneficiaryId: 'BEN-0142',
      destination: 'Primary Health Centre (PHC)',
      reason: 'Nutrition Rehabilitation referral',
      dueDate: '2026-11-05',
    },
    familyScope
  );
  assert.equal(referralResult.success, false, 'Parent/Family cannot create referrals');
});

test('Parent/Family support records, centres, workers, and referral lookup scoping', () => {
  const familyScope: DemoScope = {
    role: 'Parent/Family',
    familyId: 'FAM-0142',
    linkedBeneficiaryIds: ['BEN-0142'],
  };

  // Centres scoping: only the centre for BEN-0142 (AWC-702)
  const centres = mockStore.getCentres(familyScope);
  assert.equal(centres.length, 1, 'Parent/Family can only access their child centre');
  assert.equal(centres[0].id, 'AWC-702');

  // Workers scoping: only the worker for BEN-0142 (AWW-409)
  const workers = mockStore.getWorkers(familyScope);
  assert.equal(workers.length, 1, 'Parent/Family can only access their child assigned worker');
  assert.equal(workers[0].id, 'AWW-409');

  // Home visits scoping: only visits for BEN-0142
  const visits = mockStore.getHomeVisits(familyScope);
  assert.ok(visits.every((v) => v.beneficiaryId === 'BEN-0142'), 'Home visits must be strictly scoped to linked child');

  // Service records scoping: only services for BEN-0142
  const services = mockStore.getServiceRecords(familyScope);
  assert.ok(services.every((s) => s.beneficiaryId === 'BEN-0142'), 'Service records must be strictly scoped to linked child');

  // Metrics scoping: total population should be 1 (not 600)
  const metrics = mockStore.getMetrics(familyScope);
  assert.equal(metrics.total, 1, 'Metrics for Parent/Family must count only their linked child');
});

test('Preservation of all six existing roles', () => {
  const existingRoles: UserRole[] = [
    'AWW',
    'LS',
    'CDPO',
    'DPO',
    'System Administrator',
    'Rule Administrator',
  ];

  for (const r of existingRoles) {
    assert.ok(ROLE_CONFIGS[r], `Role config for ${r} must be intact`);
    assert.ok(getNavItemsForRole(r).length > 0, `Nav items for ${r} must be intact`);
    assert.equal(canAccessPath(r, '/dashboard').allowed, true, `Role ${r} can access dashboard`);
  }

  // AWW can record measurements, DPO cannot
  assert.equal(canPerformAction('AWW', 'record_measurement'), true);
  assert.equal(canPerformAction('DPO', 'record_measurement'), false);
  assert.equal(canPerformAction('LS', 're_measure'), true);
});
