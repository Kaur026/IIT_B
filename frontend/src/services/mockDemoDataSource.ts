import { isMockDemoEnabled, type DemoModeEnvironment } from '../utils/demoMode.ts';
import type { BeneficiaryRecord } from '../store/mockStore.ts';
import type { UserRole } from '../utils/permissions.ts';

export interface MockDemoScope {
  role?: UserRole | null;
  centreCode?: string;
  sectorCode?: string;
  projectCode?: string;
  actorId?: string;
}

export interface MockDemoStore {
  getBeneficiaries(scope?: MockDemoScope): BeneficiaryRecord[];
}
export type MockDemoBeneficiary = BeneficiaryRecord;

/** Explicit reader adapter for legacy fixtures; never represents B1 or B2 data. */
export class MockDemoDataSource {
  readonly source = 'mock-demo' as const;
  private readonly store: MockDemoStore;
  private readonly environment: DemoModeEnvironment;

  constructor(
    store: MockDemoStore,
    environment: DemoModeEnvironment,
  ) {
    this.store = store;
    this.environment = environment;
  }

  listBeneficiaries(scope?: MockDemoScope): MockDemoBeneficiary[] {
    if (!isMockDemoEnabled(this.environment)) {
      throw new Error('The browser-local mock demo is disabled in this build.');
    }
    return this.store.getBeneficiaries(scope);
  }
}
