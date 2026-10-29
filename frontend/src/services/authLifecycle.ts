import type { SupabaseClient } from '@supabase/supabase-js';
import { B2ApiError, type B2MyProfile } from './b2Api.ts';

type AuthApi = Pick<SupabaseClient['auth'], 'getSession' | 'signInWithPassword' | 'signOut' | 'refreshSession'>;

export function safeSupabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials') || message.includes('email not confirmed')) {
    return 'Email or password was not accepted. Check your details or contact the account administrator.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Supabase could not be reached. Check your network connection and try again.';
  }
  if (message.includes('rate limit')) {
    return 'Too many sign-in attempts. Wait a moment and try again.';
  }
  return 'Supabase authentication could not be completed. Try again or contact the account administrator.';
}

export function createSupabaseAuthActions(auth: AuthApi) {
  return {
    async restoreSession() {
      const { data, error } = await auth.getSession();
      if (error) throw new Error(safeSupabaseError(error));
      return data.session;
    },
    async signIn(email: string, password: string) {
      const normalizedEmail = email.trim();
      if (!normalizedEmail || !password) throw new Error('Enter your email and password.');
      const { data, error } = await auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw new Error(safeSupabaseError(error));
      if (!data.session) throw new Error('Supabase did not return an authenticated session.');
      return data.session;
    },
    async signOut() {
      const { error } = await auth.signOut({ scope: 'local' });
      if (error) throw new Error(safeSupabaseError(error));
    },
    async refreshSession() {
      const { data, error } = await auth.refreshSession();
      if (error) return null;
      return data.session;
    },
  };
}

export interface AccessTokenSession {
  access_token: string;
  user: { id: string };
}

export async function getProfileForSession(
  session: AccessTokenSession,
  getMyProfile: (token: string) => Promise<B2MyProfile>,
  refreshSession: () => Promise<AccessTokenSession | null>,
): Promise<B2MyProfile> {
  if (!session?.access_token || !session.user?.id) {
    throw new B2ApiError(401, 'unauthorized');
  }
  const validateProfile = (profile: B2MyProfile) => {
    if (profile.identity_mode !== 'supabase' || profile.demo || profile.subject_id !== session.user.id || !profile.is_active) {
      throw new B2ApiError(401, 'unauthorized');
    }
    return profile;
  };
  try {
    return validateProfile(await getMyProfile(session.access_token));
  } catch (error) {
    if (!(error instanceof B2ApiError) || error.status !== 401) throw error;
  }
  const refreshed = await refreshSession();
  if (!refreshed?.access_token || refreshed.user?.id !== session.user.id) {
    throw new B2ApiError(401, 'unauthorized');
  }
  return validateProfile(await getMyProfile(refreshed.access_token));
}

export interface ProfileSessionState {
  userId: string | null;
  profile: B2MyProfile | null;
}

export function clearProfileForAccount(state: ProfileSessionState, nextUserId: string | null): ProfileSessionState {
  if (state.userId === nextUserId) return state;
  return { userId: nextUserId, profile: null };
}
