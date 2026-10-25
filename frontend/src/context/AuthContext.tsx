import React, { createContext, useContext, useState } from 'react';
import { useLocation, Navigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useToast } from './ToastContext';
import { UserRole, ROLE_CONFIGS, canAccessPath } from '../utils/permissions';

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
  loginAsStaff: (user: StaffUser) => void;
  logoutStaff: () => void;
  requireStaffAction: (actionDescription: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'poshan_staff_session_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staffUser, setStaffUser] = useState<StaffUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure name is never a personal name
        if (parsed.id) {
          parsed.name = parsed.id;
        }
        return parsed;
      }
    } catch {
      // Ignore corrupt session
    }
    return null;
  });

  const { showToast } = useToast();

  const isStaff = staffUser !== null;
  const isReadOnlyDemo = !isStaff;
  const role = staffUser?.role || null;

  const loginAsStaff = (user: StaffUser) => {
    // Ensure no personal name in user object
    const cleanUser: StaffUser = {
      ...user,
      name: user.id, // Guarantee synthetic ID display
    };
    setStaffUser(cleanUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanUser));
    } catch {
      // Storage error ignored
    }
  };

  const logoutStaff = () => {
    setStaffUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage error ignored
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
  const { isStaff } = useAuth();
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
