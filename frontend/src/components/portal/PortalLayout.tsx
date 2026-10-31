import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut,
  RotateCcw,
  X,
  Lock,
  Eye,
  ShieldCheck,
  UserCheck,
  LayoutDashboard,
  Users,
  UserPlus,
  Scale,
  ListTodo,
  CheckCircle2,
  HeartHandshake,
  FileBarChart2,
  Sliders,
  User as UserIcon,
} from 'lucide-react';
import { SkeletonShimmer } from '../common/SkeletonShimmer';
import { mockStore } from '../../store/mockStore.ts';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { canAccessPath, getNavItemsForRole, ROLE_CONFIGS } from '../../utils/permissions';
import { isMockDemoEnabled } from '../../utils/demoMode';
import { shouldBlockMockWorkflowForProviderSession, shouldShowMockDataDisclosure } from '../../utils/dataSourcePresentation';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    isStaff, isReadOnlyDemo, staffUser, role, logoutStaff, requireStaffAction,
    supabaseSession, signOutSupabase,
  } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Role-driven navigation tabs from permissions config
  const navItems = getNavItemsForRole(role);

  const handleSignOut = async () => {
    if (isStaff) {
      logoutStaff();
      showToast('Signed Out', 'Exited role simulation. Returned to public overview.', 'info');
    } else if (supabaseSession) {
      await signOutSupabase();
      showToast('Signed Out', 'Supabase account session ended.', 'info');
    }
    navigate('/');
  };

  const handleConfirmReset = () => {
    if (!requireStaffAction('reset system demo data to baseline')) {
      setIsResetModalOpen(false);
      return;
    }
    mockStore.resetToDemoSeed();
    setIsResetModalOpen(false);
    showToast(
      'Demo Dataset Restored',
      'Canonical synthetic dataset restored (600 beneficiaries). All screens updated.',
      'success'
    );
  };

  const getNavIcon = (id: string) => {
    switch (id) {
      case 'dashboard':
      case 'district-overview':
        return LayoutDashboard;
      case 'beneficiaries':
      case 'beneficiary-stats':
      case 'all-centres':
      case 'centres':
        return Users;
      case 'register':
        return UserPlus;
      case 'measurements':
      case 'measurement-review':
      case 'measurement-monitoring':
        return Scale;
      case 'queue':
      case 'my-cases':
      case 'action-queue':
        return ListTodo;
      case 'verification-queue':
        return CheckCircle2;
      case 'referrals':
      case 'referrals-overview':
        return HeartHandshake;
      case 'reports':
      case 'centre-performance':
      case 'screening-trends':
        return FileBarChart2;
      case 'audit-logs':
        return ShieldCheck;
      case 'rules':
      case 'rule-settings':
      case 'screening-testbench':
      case 'rule-test-results':
      case 'system-settings':
        return Sliders;
      case 'child-profile':
      case 'profile':
      case 'staff-roles':
      case 'user-access':
        return UserIcon;
      case 'growth-tracking':
        return Scale;
      case 'nutrition-care':
        return HeartHandshake;
      case 'history':
        return FileBarChart2;
      default:
        return LayoutDashboard;
    }
  };

  const isCurrentActive = (item: typeof navItems[0]) => {
    if (item.href.includes('#')) {
      const [path, hash] = item.href.split('#');
      return location.pathname === path && location.hash === `#${hash}`;
    }
    if (item.href.includes('?')) {
      const [path, query] = item.href.split('?');
      return location.pathname === path && location.search.includes(query);
    }
    if (item.href === '/dashboard') {
      return location.pathname === '/dashboard' && !location.hash;
    }
    if (item.href === '/queue') {
      return location.pathname === '/queue' && !location.search.includes('view=verification');
    }
    if (item.href === '/beneficiaries/register') {
      return location.pathname === '/beneficiaries/register';
    }
    if (item.href === '/beneficiaries') {
      return (
        (location.pathname === '/beneficiaries' || location.pathname.startsWith('/beneficiaries/BEN-')) &&
        location.pathname !== '/beneficiaries/register' &&
        !location.search.includes('view=centres')
      );
    }
    if (item.href === '/centres') {
      return location.pathname === '/centres' || (location.pathname === '/beneficiaries' && location.search.includes('view=centres'));
    }
    return location.pathname === item.href;
  };

  const handleNavClick = (href: string) => {
    if (href.includes('#')) {
      const [path, hash] = href.split('#');
      if (location.pathname !== path) {
        navigate(href);
      } else {
        window.location.hash = hash;
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } else {
      navigate(href);
    }
  };

  const currentRoleConfig = role ? ROLE_CONFIGS[role] : null;
  const mockDemoEnabled = isMockDemoEnabled(import.meta.env);
  const blockMockWorkflow = shouldBlockMockWorkflowForProviderSession(location.pathname, Boolean(supabaseSession));
  const showMockDataDisclosure = !blockMockWorkflow && shouldShowMockDataDisclosure(
    location.pathname,
    Boolean(supabaseSession),
    mockDemoEnabled,
  );
  const demoToolsEnabled = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demoTools') === '1';

  return (
    <div className="min-h-screen bg-[#F5F9FC] text-[#17365D] flex flex-col antialiased selection:bg-[#BBD5F0] selection:text-[#17365D] relative">
      {/* Subtle background gradient wash */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-br from-[#E8F2FC]/40 via-[#F5F9FC] to-[#F8FBFF]/60 -z-10"
        aria-hidden="true"
      />

      {/* Fixed Header Stack */}
      <header className="sticky top-0 z-40 w-full transition-all duration-200">
        {/* Main Navigation Bar */}
        <div
          className={`w-full transition-all duration-300 border-b ${
            isScrolled
              ? 'bg-white/85 backdrop-blur-md shadow-sm border-slate-200/80 py-2.5'
              : 'bg-white/95 backdrop-blur-sm border-slate-200/60 py-3'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4">
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83] rounded-lg"
                title="Poshan Action Layer Dashboard"
              >
                <div className="w-8 h-8 rounded-full bg-[#0E1B2B] text-white flex items-center justify-center font-bold text-xs tracking-tighter">
                  PA
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm tracking-tight text-[#0E1B2B] group-hover:text-[#1F8A83] transition-colors leading-none">
                    Poshan Action Layer
                  </span>
                </div>
              </Link>
            </div>

            {/* Center Navigation Links driven by role permissions */}
            <nav className="hidden lg:flex items-center gap-0.5 sm:gap-1 relative bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-xs max-w-3xl overflow-x-auto">
              {navItems.map((item) => {
                const active = isCurrentActive(item);
                const Icon = getNavIcon(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.href)}
                    className={`relative px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-full transition-colors z-10 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap ${
                      active ? 'text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="portalActivePill"
                        className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm border border-slate-200/60"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span>{item.name}</span>
                    {item.scopeBadge && (
                      <span className="text-[9px] font-mono uppercase bg-blue-100/80 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                        {item.scopeBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right: Persona simulation & actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isStaff ? (
                <>
                  {/* Reset Demo Data Action Button */}
                  {demoToolsEnabled && role !== 'System Administrator' && role !== 'Rule Administrator' && <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100/80 px-2.5 sm:px-3 py-1.5 rounded-full border border-amber-200/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 shadow-xs"
                    title="Reset demo data to canonical baseline"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span className="hidden md:inline">Reset Demo Data</span>
                    <span className="md:hidden text-[11px]">Reset</span>
                  </motion.button>}

                  {/* Role Persona Badge (No personal names) */}
                  {canAccessPath(role, '/profile').allowed && <Link
                    to="/profile"
                    className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1 bg-slate-100 hover:bg-slate-200/70 rounded-full border border-slate-200 transition-colors"
                    title="View Active Persona Profile"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#0E1B2B] text-white flex items-center justify-center text-[10px] font-bold font-mono">
                      {staffUser?.role || 'AWW'}
                    </div>
                    <div className="flex items-center gap-1.5 text-left font-mono">
                      <span className="text-xs font-semibold text-slate-800 leading-tight">
                        {staffUser?.id || 'AWW-409'}
                      </span>
                      <span className="text-slate-400 text-xs">•</span>
                      <span className="text-[11px] text-slate-600 font-medium leading-none">
                        {currentRoleConfig?.label || staffUser?.roleLabel}
                      </span>
                    </div>
                  </Link>}

                  {/* Switch Persona Button */}
                  {mockDemoEnabled && <Link
                    to="/signin"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#17365D] bg-[#E8F2FC] hover:bg-[#BBD5F0]/60 px-2.5 py-1.5 rounded-full border border-[#BBD5F0] transition-colors"
                    title="Switch the browser-local mock demo persona"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span className="hidden lg:inline">Switch Demo Role</span>
                  </Link>}

                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shadow-xs"
                    title="End browser-local demo session"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Exit Simulation</span>
                  </motion.button>
                </>
              ) : supabaseSession ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-900" title="Provider session; frontend casework remains synthetic demo data">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Authenticated account</span>
                  </div>
                  <button type="button" onClick={handleSignOut} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-white px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200" title="Sign out of Supabase">
                    <LogOut className="w-3.5 h-3.5" /><span>Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Public Read-Only Demo Pill */}
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700"
                    title="You are viewing the public demo with stable synthetic data"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#1F8A83]" />
                    <span>Public Overview</span>
                  </div>

                  {/* Role Simulation Sign In Action */}
                  {mockDemoEnabled && <Link
                    to="/signin"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0E1B2B] hover:bg-black px-3.5 py-1.5 rounded-full shadow-xs transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
                    title="Open the browser-local mock-data role demonstration"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#BBD5F0]" />
                    <span>Staff Sign In</span>
                  </Link>}

                  {/* Return to overview */}
                  <Link
                    to="/"
                    className="hidden sm:inline-flex items-center text-xs font-medium text-[#5B6B7C] hover:text-[#0E1B2B] px-2 py-1 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    Back to Home
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile / Tablet Compact Horizontal Nav Bar */}
          <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 pt-2.5 pb-1.5 scrollbar-none border-t border-slate-100 mt-2 bg-slate-50/50">
            {navItems.map((item) => {
              const active = isCurrentActive(item);
              const Icon = getNavIcon(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.href)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span>{item.name}</span>
                  {item.scopeBadge && (
                    <span className={`text-[9px] font-mono uppercase px-1 rounded ${active ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'}`}>
                      {item.scopeBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content with 350ms fade + 12px upward slide */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <SkeletonShimmer durationMs={400}>
              {blockMockWorkflow ? (
                <section className="rounded-3xl border border-amber-200 bg-white p-6" role="status" aria-labelledby="mock-workflow-unavailable-title">
                  <h1 id="mock-workflow-unavailable-title" className="text-xl font-semibold text-slate-900">This workflow is not connected to your account</h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    This screen uses browser-local synthetic demo records. They are unavailable in a provider session and are never substituted for account data.
                  </p>
                </section>
              ) : children}
            </SkeletonShimmer>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Standard Footer */}
      <footer className="w-full bg-white border-t border-slate-200/70 py-6 px-4 sm:px-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-center sm:text-left leading-relaxed">
            Poshan Action Layer · Synthetic data only · 2026.
          </p>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>Active Scope: {currentRoleConfig ? `${currentRoleConfig.scopeLevel} (${staffUser?.centreCode || staffUser?.sectorCode || staffUser?.projectCode || 'District'})` : 'Public Aggregate'}</span>
          </div>
        </div>
      </footer>

      {/* Confirmed Reset Demo Data Dialog Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-modal-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="reset-modal-title" className="font-bold text-slate-900 text-base leading-snug">
                      Reset Demo Data to Baseline?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Restores initial canonical synthetic dataset
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <p>
                  This action will clear all user-created records from your local storage session and restore the original seed dataset:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 font-mono text-[11px]">
                  <li>600 synthetic beneficiaries (scoped across 5 AWC centres)</li>
                  <li>Multi-tier anomaly casework queue and priority screening</li>
                  <li>8 configurable anthropometric screening rules</li>
                  <li>Clinical referrals, baseline measurements & audit ledger</li>
                </ul>
                <p className="text-slate-500 text-[11px] pt-1">
                  All pages, metrics, and case queues will refresh immediately.
                </p>
              </div>

              {isReadOnlyDemo && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Staff Only Action</span>: You are currently viewing the public overview. Start a role simulation to perform dataset resets or caseworker mutations.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Cancel
                </button>
                {isReadOnlyDemo ? (
                  <Link
                    to="/signin"
                    onClick={() => setIsResetModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0E1B2B] hover:bg-black rounded-full shadow-sm flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sign In to Reset</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-full shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Yes, Restore Baseline</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
