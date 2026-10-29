import assert from 'node:assert/strict';
import { test } from 'node:test';
import { B2ApiError, type B2MyProfile } from './b2Api.ts';
import { clearProfileForAccount, createSupabaseAuthActions, getProfileForSession } from './authLifecycle.ts';
import { readSupabaseBrowserConfig } from './supabaseClient.ts';
import { isMockDemoEnabled } from '../utils/demoMode.ts';

const userId = 'd4f2a64c-9cf9-4e2f-87c3-916a9c07af22';
const session = { access_token: 'access-token-a', user: { id: userId } };
const profile: B2MyProfile = {
  subject_id: userId, role: 'AWW', scopes: [{ type: 'centre', id: 'CTR-1' }],
  is_active: true, identity_mode: 'supabase', demo: false,
};

test('mock role simulation is limited to development or an explicit public demo build flag', () => {
  assert.equal(isMockDemoEnabled({ DEV: true }), true);
  assert.equal(isMockDemoEnabled({ DEV: false }), false);
  assert.equal(isMockDemoEnabled({ DEV: false, VITE_ENABLE_DEMO_MODE: 'false' }), false);
  assert.equal(isMockDemoEnabled({ DEV: false, VITE_ENABLE_DEMO_MODE: 'true' }), true);
  assert.equal(isMockDemoEnabled({ DEV: false, VITE_ENABLE_DEMO_MODE: '1' }), false);
});

test('missing Supabase browser config disables real sign-in with a clear setup message', () => {
  const result = readSupabaseBrowserConfig({});
  assert.equal(result.config, null);
  assert.match(result.error, /VITE_SUPABASE_URL/);
  assert.equal(readSupabaseBrowserConfig({
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'your-supabase-publishable-key',
  }).config, null);
});

test('browser Supabase config accepts a publishable key and refuses a service-role key', () => {
  const accepted = readSupabaseBrowserConfig({
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public-value',
  });
  assert.equal(accepted.config?.url, 'https://project.supabase.co');
  assert.equal(readSupabaseBrowserConfig({
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do-not-use-in-browser',
  }).config, null);
});

test('Supabase auth actions restore a session, sign in with password, and sign out locally', async () => {
  const calls: string[] = [];
  const actions = createSupabaseAuthActions({
    getSession: async () => { calls.push('restore'); return { data: { session }, error: null }; },
    signInWithPassword: async (credentials) => {
      calls.push(`sign-in:${credentials.email}`);
      return { data: { session }, error: null };
    },
    signOut: async (options) => { calls.push(`sign-out:${options?.scope}`); return { error: null }; },
    refreshSession: async () => ({ data: { session }, error: null }),
  } as never);

  assert.equal((await actions.restoreSession())?.access_token, session.access_token);
  assert.equal((await actions.signIn(' staff@example.test ', 'password')).user.id, userId);
  await actions.signOut();
  assert.deepEqual(calls, ['restore', 'sign-in:staff@example.test', 'sign-out:local']);
});

test('invalid credentials are reported without exposing provider error details', async () => {
  const actions = createSupabaseAuthActions({
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: new Error('Invalid login credentials; internal-token-value') }),
    signOut: async () => ({ error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
  } as never);
  await assert.rejects(actions.signIn('staff@example.test', 'wrong'), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Email or password was not accepted/);
    assert.doesNotMatch(error.message, /internal-token-value/);
    return true;
  });
});

test('server profile loads with the provider token and refreshes once after a 401', async () => {
  const tokens: string[] = [];
  const result = await getProfileForSession(session, async (token) => {
    tokens.push(token);
    if (token === session.access_token) throw new B2ApiError(401, 'unauthorized');
    return profile;
  }, async () => ({ access_token: 'refreshed-token', user: { id: userId } }));
  assert.equal(result.role, 'AWW');
  assert.deepEqual(tokens, ['access-token-a', 'refreshed-token']);
});

test('missing, expired, mismatched, or inactive sessions never produce a server profile', async () => {
  await assert.rejects(getProfileForSession({ ...session, access_token: '' }, async () => profile, async () => null),
    (error: unknown) => error instanceof B2ApiError && error.status === 401);
  await assert.rejects(getProfileForSession(session, async () => { throw new B2ApiError(401, 'unauthorized'); }, async () => null),
    (error: unknown) => error instanceof B2ApiError && error.status === 401);
  await assert.rejects(getProfileForSession(session, async () => ({ ...profile, subject_id: 'other-user' }), async () => null),
    (error: unknown) => error instanceof B2ApiError && error.status === 401);
  await assert.rejects(getProfileForSession(session, async () => ({ ...profile, is_active: false }), async () => null),
    (error: unknown) => error instanceof B2ApiError && error.status === 401);
});

test('403, 503, and network errors remain safe and do not trigger token refresh', async () => {
  for (const expected of [
    new B2ApiError(403, 'forbidden'),
    new B2ApiError(503, 'service_unavailable'),
    new B2ApiError(0, 'network_error'),
  ]) {
    let refreshed = false;
    await assert.rejects(getProfileForSession(session, async () => { throw expected; }, async () => {
      refreshed = true;
      return null;
    }), (error: unknown) => error === expected);
    assert.equal(refreshed, false);
  }
});

test('account switches clear the old profile before the new profile is loaded', () => {
  const prior = { userId, profile };
  assert.deepEqual(clearProfileForAccount(prior, 'next-user'), { userId: 'next-user', profile: null });
  assert.deepEqual(clearProfileForAccount(prior, null), { userId: null, profile: null });
});
