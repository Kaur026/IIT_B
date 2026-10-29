import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, ArrowRight, Lock, Eye } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { createDemoPersona, useAuth } from '../context/AuthContext';
import { isUserRole, UserRole, ROLE_CONFIGS } from '../utils/permissions';
import { isMockDemoEnabled } from '../utils/demoMode';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const {
    loginAsStaff, signInWithPassword, signOutSupabase, supabaseConfigured,
    supabaseSession, backendProfile, authInitializing,
    authBusy, profileStatus, authMessage,
  } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('AWW');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const demoEnabled = isMockDemoEnabled(import.meta.env);

  const redirectMessage = (location.state as any)?.message;
  const redirectTarget = (location.state as any)?.from || '/dashboard';

  const handleRoleChange = (value: string) => {
    if (isUserRole(value)) setSelectedRole(value);
  };

  const currentConfig = ROLE_CONFIGS[selectedRole];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEnabled) return;
    const persona = createDemoPersona(selectedRole);
    if (!await loginAsStaff(persona)) return;

    showToast(
      'Session Simulation Started',
      `Active persona: ${currentConfig.label} • Scoped to ${currentConfig.scopeLevel}.`,
      'success'
    );
    navigate(redirectTarget);
  };

  const handleProviderSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await signInWithPassword(email, password)) {
      setPassword('');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC] flex flex-col justify-between selection:bg-[#CFEFD8] selection:text-[#0E1B2B] relative overflow-hidden font-sans">
      {/* Background Soft Wash */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-br from-[#CFEFD8]/20 via-[#F5F9FC] to-[#D6E6F7]/30 -z-10"
        aria-hidden="true"
      />

      {/* Nav back to landing */}
      <div className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-[#0E1B2B] text-white flex items-center justify-center font-bold text-xs tracking-tighter">
            PA
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#0E1B2B] group-hover:text-[#1F8A83] transition-colors">
            Poshan Action Layer
          </span>
        </Link>
        <Link
          to="/"
          className="text-xs font-semibold text-slate-500 hover:text-[#0E1B2B] transition-colors"
        >
          ← Back to Overview
        </Link>
      </div>

      {/* Main Sign In Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-[28px] border border-slate-200/80 p-8 sm:p-10 shadow-layered relative"
        >
          {/* Header pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 mb-4">
            <Shield className="w-3.5 h-3.5 text-[#1F8A83]" />
            Supabase Auth
          </div>

          <h1 className="text-3xl font-light tracking-tight text-[#0E1B2B]">
            Staff Sign In
          </h1>
          <p className="text-xs text-[#5B6B7C] mt-2 font-normal leading-relaxed">
            Sign in with an account provisioned by the project administrator. The backend must separately confirm your current role and organizational assignment.
          </p>

          {supabaseSession ? <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-emerald-950">Supabase account authenticated</h2>
                <p className="mt-1 text-xs text-emerald-900">{supabaseSession.user.email || 'Signed-in account'}</p>
              </div>
              <button type="button" onClick={() => void signOutSupabase()} className="text-xs font-semibold text-emerald-950 underline">Sign out</button>
            </div>
            {authInitializing || profileStatus === 'loading' ? <p className="mt-3 text-xs text-slate-700">Checking the server-resolved B2 profile…</p> : null}
            {profileStatus === 'ready' && backendProfile ? <div className="mt-3 border-t border-emerald-200 pt-3 text-xs text-emerald-950">
              <p>Server profile: <strong>{backendProfile.role}</strong></p>
              <p className="mt-1">Assigned scopes: {backendProfile.scopes.map((scope) => `${scope.type}: ${scope.id}`).join(', ') || 'none'}</p>
              <p className="mt-2 text-emerald-900">This confirms identity and the B2 profile. Frontend casework remains synthetic demo data.</p>
            </div> : null}
            {(profileStatus === 'blocked' || profileStatus === 'error') && <p className="mt-3 border-t border-emerald-200 pt-3 text-xs text-amber-900" role="status">
              {authMessage || 'The B2 server profile is not available.'} Frontend operational access remains disabled for this account.
            </p>}
          </section> : authInitializing ? <p className="mt-5 text-xs text-slate-600" role="status">Restoring saved Supabase session…</p> : supabaseConfigured ? <form onSubmit={handleProviderSignIn} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="auth-email">Email
              <input id="auth-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-[#0E1B2B] focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30" />
            </label>
            <label className="block text-xs font-semibold text-slate-700" htmlFor="auth-password">Password
              <input id="auth-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-[#0E1B2B] focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30" />
            </label>
            {authMessage && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900" role="alert">{authMessage}</p>}
            <button type="submit" disabled={authBusy} className="w-full rounded-full bg-[#0E1B2B] px-6 py-3 text-xs font-medium text-white hover:bg-black disabled:cursor-wait disabled:opacity-60">{authBusy ? 'Signing in…' : 'Sign in with Supabase'}</button>
          </form> : <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
            <h2 className="font-semibold">Staff sign-in is unavailable</h2>
            <p className="mt-1 text-xs leading-relaxed">This public showcase has no configured sign-in provider. You can still explore the synthetic demo without an account.</p>
          </div>}

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h2 className="text-sm font-semibold text-[#0E1B2B]">Mock-data role demonstration</h2>
            <p className="mt-1 text-[11px] text-slate-600">A browser-local UI persona for mock data only. It is not authentication and never grants access to the B2 API.</p>
            {demoEnabled && <Link to="/synthetic-workflow" className="mt-3 inline-flex rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">
              Open separate synthetic B2 API workflow (provider session required)
            </Link>}
          </div>

          {/* Guard Redirect Alert if user attempted staff-only workflow */}
          {redirectMessage && (
            <div className="mt-4 mb-2 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Staff Simulation Required</p>
                <p className="text-[11px] text-amber-800 mt-0.5">{redirectMessage}</p>
              </div>
            </div>
          )}

          {/* Form */}
          {demoEnabled ? (authInitializing ? <p className="mt-5 text-xs text-slate-600" role="status">Checking for an existing provider session before starting the separate demo simulation…</p> : <form onSubmit={handleSignIn} className="mt-6 space-y-5">
            {/* Operational Role Level */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="demo-role" className="text-xs font-semibold text-slate-700">
                  Select Role Persona
                </label>
                <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Demo simulation, not authentication
                </span>
              </div>
              <select
                id="demo-role"
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[#0E1B2B] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] transition-all cursor-pointer"
              >
                <option value="AWW">Anganwadi Worker (AWW) — Centre Scope (AWC-702)</option>
                <option value="LS">Lady Supervisor (LS) — Sector Scope (Sector-4)</option>
                <option value="CDPO">Child Development Project Officer (CDPO) — Project Scope</option>
                <option value="DPO">District Programme Officer (DPO) — District View Scope</option>
                <option value="System Administrator">System Administrator — Account Administration Demo</option>
                <option value="Rule Administrator">Rule Administrator — Rule Submission Demo</option>
              </select>
              <p className="text-[11px] text-[#5B6B7C] mt-1.5 leading-relaxed">
                {currentConfig.description}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-500 rounded-xl border border-slate-200 bg-slate-50 p-3">
                Demo persona ID: <span className="font-mono">{currentConfig.defaultId}</span> · Scope: {currentConfig.defaultScope}. This local persona is not an account or verified identity.
              </p>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full mt-2 py-3 px-6 rounded-full bg-[#0E1B2B] hover:bg-black text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
            >
              <span>Start Demo Persona ({currentConfig.label})</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            {/* Public Demo Alternative Link */}
            <div className="text-center pt-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#1F8A83] transition-colors py-1"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Or explore Public Read-Only Overview without role simulation →</span>
              </Link>
            </div>
          </form>) : <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
            <h2 className="font-semibold">Browser role simulation is unavailable</h2>
            <p className="mt-1 text-xs leading-relaxed">This public showcase does not enable mock staff personas. Provider sign-in is separate and requires a trusted B2 profile for operational access.</p>
          </div>}

        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-400">
        © 2026 Poshan Action Layer
      </footer>
    </div>
  );
};
