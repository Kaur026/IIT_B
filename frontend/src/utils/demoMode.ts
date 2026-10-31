export interface DemoModeEnvironment {
  DEV?: boolean;
  VITE_ENABLE_DEMO_MODE?: string | boolean;
}

/** Enable browser-local mock personas in development or an explicitly opted-in demo build. */
export function isMockDemoEnabled(environment: DemoModeEnvironment): boolean {
  const raw = environment.VITE_ENABLE_DEMO_MODE as unknown;
  const flag = typeof raw === 'string'
    ? raw.trim().toLowerCase()
    : raw === true
      ? 'true'
      : undefined;
  return environment.DEV === true || flag === 'true';
}
