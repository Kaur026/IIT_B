import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Navigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useToast } from './ToastContext';
import { UserRole, ROLE_CONFIGS, canAccessPath, isValidDemoPersona } from '../utils/permissions';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { B2ApiError, createB2ApiClient, type B2MyProfile } from '../services/b2Api';
import { clearProfileForAccount, createSupabaseAuthActions, getProfileForSession, safeSupabaseError } from '../services/authLifecycle';
import { getSupabaseBrowserClient } from '../services/supabaseClient';
import { isMockDemoEnabled } from '../utils/demoMode';

export interface StaffUser {
  id: string; // e.g. 'AWW-409', 'LS-01', 'CDPO-01', 'DPO-01'
  role: UserRole;
  roleLabel: string;
  centreCode?: string; // 'AWC-702'
  sectorCode?: string; // 'Sector-4'
  projectCode?: string; // 'Project-Central'
  signedInAt: string;
  name?: string; // Legacy compatibility getter
}

interface AuthContextType {
  isStaff: boolean;
  isReadOnlyDemo: boolean;
  staffUser: StaffUser | null;
  role: UserRole | null;
  supabaseSession: Session | null;
  backendProfile: B2MyProfile | null;
  authInitializing: boolean;
  authBusy: boolean;
  profileStatus: 'signed_out' | 'loading' | 'ready' | 'blocked' | 'error';
  authMessage: string | null;
  supabaseConfigured: boolean;
  supabaseConfigError: string | null;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signOutSupabase: () => Promise<void>;
  loginAsStaff: (user: StaffUser) => Promise<boolean>;
  logoutStaff: () => void;
  requireStaffAction: (actionDescription: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'poshan_staff_session_v1';

export const createDemoPersona = (role: UserRole, signedInAt = new Date().toISOString()): StaffUser => {
  const config = ROLE_CONFIGS[role];
  return {
    id: config.defaultId,
    role,
    roleLabel: config.label,
    ...(role === 'AWW' ? { centreCode: 'AWC-702' } : {}),
    ...(role === 'LS' ? { sectorCode: 'Sector-4' } : {}),
    ...(role === 'CDPO' ? { projectCode: 'Project-Central' } : {}),
    ...(role === 'DPO' ? { projectCode: 'Project-Central' } : {}),
    signedInAt,
    name: config.defaultId,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabaseResult = useMemo(() => getSupabaseBrowserClient(), []);
  const supabaseClient = supabaseResult.client;
  const authActions = useMemo(
    () => supabaseClient ? createSupabaseAuthActions(supabaseClient.auth) : null,
    [supabaseClient],
  );
  const [staffUser, setStaffUser] = useState<StaffUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!isMockDemoEnabled(import.meta.env)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isValidDemoPersona(parsed)) return createDemoPersona(parsed.role, parsed.signedInAt);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore corrupt session
    }
    return null;
  });
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [backendProfile, setBackendProfile] = useState<B2MyProfile | null>(null);
  const [authInitializing, setAuthInitializing] = useState(Boolean(supabaseClient));
  const [authBusy, setAuthBusy] = useState(false);
  const [profileStatus, setProfileStatus] = useState<AuthContextType['profileStatus']>('signed_out');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const authEventRevision = useRef(0);
  const profileRequestRevision = useRef(0);
  const profileStateRef = useRef<{ userId: string | null; profile: B2MyProfile | null }>({ userId: null, profile: null });

  const clearDemoPersona = useCallback(() => {
    setStaffUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Browser storage is optional. */ }
  }, []);

  const applySupabaseSession = useCallback((session: Session | null) => {
    profileStateRef.current = clearProfileForAccount(profileStateRef.current, session?.user.id || null);
    profileRequestRevision.current += 1;
    setSupabaseSession(session);
    setBackendProfile(null);
    setProfileStatus(session ? 'loading' : 'signed_out');
    setAuthMessage(null);
    if (session) clearDemoPersona();
  }, [clearDemoPersona]);

  useEffect(() => {
    if (!supabaseClient || !authActions) return undefined;
    let active = true;
    let observedAuthEvent = false;
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      observedAuthEvent = true;
      authEventRevision.current += 1;
      applySupabaseSession(session);
    });
    const revisionAtRead = authEventRevision.current;
    void authActions.restoreSession().then((session) => {
      if (active && !observedAuthEvent && authEventRevision.current === revisionAtRead) {
        applySupabaseSession(session);
      }
    }).catch((error: unknown) => {
      if (active) {
        applySupabaseSession(null);
        setAuthMessage(error instanceof Error ? error.message : 'Could not restore the Supabase session.');
      }
    }).finally(() => {
      if (active) setAuthInitializing(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabaseClient, authActions, applySupabaseSession]);

  useEffect(() => {
    const revision = ++profileRequestRevision.current;
    if (!supabaseSession || !supabaseClient || !authActions) {
      setBackendProfile(null);
      if (!supabaseSession) setProfileStatus('signed_out');
      return undefined;
    }
    let active = true;
    setBackendProfile(null);
    setProfileStatus('loading');
    setAuthMessage(null);
    const apiBaseUrl = import.meta.env.VITE_B2_API_URL?.trim();
    void (async () => {
      try {
        if (!apiBaseUrl) throw new Error('VITE_B2_API_URL is not configured.');
        const api = createB2ApiClient(apiBaseUrl);
        const profile = await getProfileForSession(
          supabaseSession,
          (token) => api.getMyProfile(token),
          () => authActions.refreshSession(),
        );
        if (active && revision === profileRequestRevision.current) {
          profileStateRef.current = { userId: supabaseSession.user.id, profile };
          setBackendProfile(profile);
          setProfileStatus('ready');
        }
      } catch (error) {
        if (active && revision === profileRequestRevision.current) {
          setBackendProfile(null);
          const unauthorized = error instanceof B2ApiError && error.status === 401;
          setProfileStatus(unauthorized ? 'blocked' : 'error');
          setAuthMessage(error instanceof Error
            ? error.message
            : 'The B2 server profile could not be loaded.');
        }
      }
    })();
    return () => { active = false; };
  }, [supabaseSession, supabaseClient, authActions]);

  const { showToast } = useToast();

  const isStaff = staffUser !== null;
  const isReadOnlyDemo = !isStaff;
  const role = staffUser?.role || null;

  const loginAsStaff = async (user: StaffUser) => {
    if (!isMockDemoEnabled(import.meta.env) || authInitializing || !isValidDemoPersona(user)) return false;
    if (authActions && supabaseSession) {
      try {
        await authActions.signOut();
      } catch (error) {
        setAuthMessage(error instanceof Error ? error.message : safeSupabaseError(error));
        return false;
      }
    }
    applySupabaseSession(null);
    const cleanUser = createDemoPersona(user.role, user.signedInAt);
    setStaffUser(cleanUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanUser));
    } catch {
      // Storage error ignored
    }
    return true;
  };

  const logoutStaff = () => {
    setStaffUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage error ignored
    }
  };

  const signInWithPassword = async (email: string, password: string): Promise<boolean> => {
    if (!authActions || !supabaseClient) {
      setAuthMessage(supabaseResult.error || 'Supabase sign-in is not configured.');
      return false;
    }
    setAuthBusy(true);
    setAuthMessage(null);
    setBackendProfile(null);
    clearDemoPersona();
    try {
      // Switching accounts always starts from a cleared local auth state.
      await authActions.signOut();
      const session = await authActions.signIn(email, password);
      applySupabaseSession(session);
      return true;
    } catch (error) {
      applySupabaseSession(null);
      setAuthMessage(error instanceof Error ? error.message : safeSupabaseError(error));
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const signOutSupabase = async () => {
    // Clear the old user's profile immediately, even if provider sign-out fails.
    applySupabaseSession(null);
    if (!authActions) return;
    try {
      await authActions.signOut();
      setAuthMessage(null);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : safeSupabaseError(error));
    }
  };

  const requireStaffAction = (actionDescription: string): boolean => {
    if (isStaff) return true;
    showToast(
      'Staff Simulation Required',
      `Staff sign-in simulation is required to ${actionDescription}. Public visitors have aggregate-only demo access.`,
      'warning'
    );
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        isStaff,
        isReadOnlyDemo,
        staffUser,
        role,
        supabaseSession,
        backendProfile,
        authInitializing,
        authBusy,
        profileStatus,
        authMessage,
        supabaseConfigured: Boolean(supabaseClient),
        supabaseConfigError: supabaseResult.error,
        signInWithPassword,
        signOutSupabase,
        loginAsStaff,
        logoutStaff,
        requireStaffAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

/**
 * Route guard component protecting staff-only workflows.
 * Visitors attempting to access staff routes are redirected to Staff Sign In.
 */
export const StaffRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStaff, role } = useAuth();
  const location = useLocation();

  if (!isStaff) {
    return (
      <Navigate
        to="/signin"
        state={{
          from: location.pathname,
          message: 'Staff session simulation required for this frontline casework workflow.',
        }}
        replace
      />
    );
  }

  if (!canAccessPath(role, location.pathname).allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * Role-based route guard component.
 * Validates whether the currently signed-in role has permission to access the route.
 * Displays "Your role can't open this screen" state if access is restricted.
 */
export const RoleRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStaff, role, staffUser } = useAuth();
  const location = useLocation();

  if (!isStaff) {
    return (
      <Navigate
        to="/signin"
        state={{
          from: location.pathname,
          message: 'Staff simulation required to access this screen.',
        }}
        replace
      />
    );
  }

  const access = canAccessPath(role, location.pathname);

  if (!access.allowed) {
    const config = role ? ROLE_CONFIGS[role] : null;

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-layered text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-[#0E1B2B]">
            Your role can't open this screen
          </h2>
          <p className="text-xs text-[#5B6B7C] mt-2 leading-relaxed">
            {access.reason || 'This workflow is restricted to higher supervisory roles in the ICDS operational hierarchy.'}
          </p>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-left border border-slate-100 text-xs">
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
              <span>Active Persona:</span>
              <span className="font-semibold text-slate-700">{staffUser?.id}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 mt-1">
              <span>Assigned Role:</span>
              <span className="font-semibold text-slate-700">{config?.label || role}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 mt-1">
              <span>ICDS Scope:</span>
              <span className="font-semibold text-slate-700">{config?.scopeLevel} ({staffUser?.centreCode || staffUser?.sectorCode || staffUser?.projectCode || 'District'})</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 italic">
            Assumption marked to confirm with supervisor.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#0E1B2B] text-white text-xs font-medium hover:bg-black transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Briefing Dashboard</span>
            </Link>
            <Link
              to="/signin"
              className="text-xs text-slate-500 hover:text-slate-800 py-1 transition-colors"
            >
              Switch demo simulation role →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
