import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, RotateCcw, X, Lock, Eye, ShieldCheck, UserCheck } from 'lucide-react';
import { SkeletonShimmer } from '../common/SkeletonShimmer';
import { mockStore } from '../../store/mockStore.ts';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getNavItemsForRole, ROLE_CONFIGS } from '../../utils/permissions';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isStaff, isReadOnlyDemo, staffUser, role, logoutStaff, requireStaffAction } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Role-driven navigation tabs from permissions config
  const navItems = getNavItemsForRole(role);

  const handleSignOut = () => {
    if (isStaff) {
      logoutStaff();
      showToast('Signed Out', 'Exited role simulation. Returned to public overview.', 'info');
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
      'Canonical baseline data restored (133 beneficiaries, 35 cases, 8 rules). All screens updated.',
      'success'
    );
  };

  const isCurrentActive = (itemPath: string) => {
    if (itemPath === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (itemPath === '/beneficiaries') {
      return (
        location.pathname === '/beneficiaries' ||
        location.pathname === '/beneficiaries/register' ||
        location.pathname.startsWith('/beneficiaries/BEN-')
      );
    }
    return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
  };

  const currentRoleConfig = role ? ROLE_CONFIGS[role] : null;

  return (
    <div className="min-h-screen bg-[#F5F9FC] text-[#0E1B2B] flex flex-col antialiased selection:bg-[#CFEFD8] selection:text-[#0E1B2B] relative">
      {/* Subtle background gradient wash */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-br from-[#CFEFD8]/15 via-[#F5F9FC] to-[#D6E6F7]/25 -z-10"
        aria-hidden="true"
      />

      {/* Fixed Header Stack */}
      <header className="sticky top-0 z-40 w-full transition-all duration-200">
        {/* Top Sandbox Notice */}
        <div className="bg-[#0E1B2B] text-white/90 text-[11px] py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2 border-b border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#CFEFD8]" />
          <span>Student research prototype • 100% synthetic data • Not an official Government of India service</span>
        </div>

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
                  <span className="text-[10px] text-[#5B6B7C] font-mono mt-0.5">STUDENT PROTOTYPE</span>
                </div>
              </Link>
            </div>

            {/* Center Navigation Links driven by role permissions */}
            <nav className="hidden xl:flex items-center gap-1 relative bg-slate-100/70 p-1 rounded-full border border-slate-200/50">
              {navItems.map((item) => {
                const active = isCurrentActive(item.href);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.href)}
                    className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors z-10 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83] ${
                      active ? 'text-[#0E1B2B]' : 'text-[#5B6B7C] hover:text-[#0E1B2B]'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="portalActivePill"
                        className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm border border-slate-200/40"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span>{item.name}</span>
                    {item.scopeBadge && (
                      <span className="text-[9px] font-mono uppercase bg-slate-200/60 px-1.5 py-0.2 rounded text-slate-600">
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
                  <motion.button
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
                  </motion.button>

                  {/* Role Persona Badge (No personal names) */}
                  <Link
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
                  </Link>

                  {/* Switch Persona Button */}
                  <Link
                    to="/signin"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F8A83] bg-[#CFEFD8]/40 hover:bg-[#CFEFD8]/80 px-2.5 py-1.5 rounded-full border border-[#1F8A83]/20 transition-colors"
                    title="Switch demo simulation role"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span className="hidden lg:inline">Switch Role</span>
                  </Link>

                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shadow-xs"
                    title="End role simulation session"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Exit Simulation</span>
                  </motion.button>
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
                  <Link
                    to="/signin"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0E1B2B] hover:bg-black px-3.5 py-1.5 rounded-full shadow-xs transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
                    title="Simulate AWW, Supervisor, CDPO, or DPO persona"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#CFEFD8]" />
                    <span>Role Simulation</span>
                  </Link>

                  {/* Return to overview */}
                  <Link
                    to="/"
                    className="hidden sm:inline-flex items-center text-xs font-medium text-[#5B6B7C] hover:text-[#0E1B2B] px-2 py-1 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    Overview
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile / Compact Horizontal Nav Bar */}
          <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 pt-2 pb-1 scrollbar-none border-t border-slate-100 mt-2">
            {navItems.map((item) => {
              const active = isCurrentActive(item.href);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-colors flex items-center gap-1 ${
                    active
                      ? 'bg-white text-[#0E1B2B] shadow-sm border border-slate-200/60'
                      : 'bg-slate-100/70 text-[#5B6B7C]'
                  }`}
                >
                  <span>{item.name}</span>
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
              {children}
            </SkeletonShimmer>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Standard Footer */}
      <footer className="w-full bg-white border-t border-slate-200/70 py-6 px-4 sm:px-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-center sm:text-left leading-relaxed">
            Poshan Action Layer • Academic Student Prototype for Frontline Nutrition Monitoring • 100% synthetic data • 2026.
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
                    <h3 id="reset-modal-title" className="font-semibold text-slate-900 text-base leading-snug">
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
                  <li>133 synthetic beneficiaries (scoped across AWC centres)</li>
                  <li>35 multi-tier anomaly action cases</li>
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
