import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseBrowserConfig {
  url: string;
  publishableKey: string;
}

export interface PublicFrontendEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export type SupabaseClientResult = {
  client: SupabaseClient | null;
  error: string | null;
};

function isServiceRoleKey(key: string): boolean {
  if (/^sb_secret_/i.test(key)) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded).role === 'service_role';
  } catch {
    return false;
  }
}

export function readSupabaseBrowserConfig(env: PublicFrontendEnvironment):
  | { config: SupabaseBrowserConfig; error: null }
  | { config: null; error: string } {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!url || !publishableKey || /your-project-ref|your-supabase-publishable-key/i.test(`${url} ${publishableKey}`)) {
    return { config: null, error: 'Supabase sign-in is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the local frontend environment.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { config: null, error: 'Supabase sign-in configuration has an invalid project URL.' };
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localHost))
      || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return { config: null, error: 'Supabase sign-in configuration must use an HTTPS project URL (HTTP is allowed only for local development).' };
  }
  if (isServiceRoleKey(publishableKey)) {
    return { config: null, error: 'The browser key is a privileged service key. Use the project publishable key instead.' };
  }
  return { config: { url: parsed.origin, publishableKey }, error: null };
}

let singleton: SupabaseClientResult | undefined;

export function getSupabaseBrowserClient(): SupabaseClientResult {
  if (singleton) return singleton;
  const result = readSupabaseBrowserConfig(import.meta.env as unknown as PublicFrontendEnvironment);
  if (!result.config) {
    singleton = { client: null, error: result.error };
    return singleton;
  }
  singleton = {
    client: createClient(result.config.url, result.config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }),
    error: null,
  };
  return singleton;
}
