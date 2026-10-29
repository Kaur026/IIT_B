export interface DemoModeEnvironment {
  DEV?: boolean;
  VITE_ENABLE_DEMO_MODE?: string;
}

/** Enable browser-local mock personas in development or an explicitly opted-in demo build. */
export function isMockDemoEnabled(environment: DemoModeEnvironment): boolean {
  return environment.DEV === true || environment.VITE_ENABLE_DEMO_MODE === 'true';
}
