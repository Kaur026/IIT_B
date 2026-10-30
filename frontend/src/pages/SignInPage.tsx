import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, ArrowRight, Lock, Info, Eye } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { UserRole, ROLE_CONFIGS } from '../utils/permissions';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { loginAsStaff } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('AWW');
  const [workerId, setWorkerId] = useState<string>(ROLE_CONFIGS['AWW'].defaultId);
  const [password, setPassword] = useState('••••••••');

  const redirectMessage = (location.state as any)?.message;
  const redirectTarget = (location.state as any)?.from || '/dashboard';

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setWorkerId(ROLE_CONFIGS[role].defaultId);
  };

  const currentConfig = ROLE_CONFIGS[selectedRole];

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveId = workerId.trim() || currentConfig.defaultId;

    loginAsStaff({
      id: effectiveId,
      role: selectedRole,
      roleLabel: currentConfig.label,
      centreCode: selectedRole === 'AWW' ? 'AWC-702' : undefined,
      sectorCode: selectedRole === 'LS' ? 'Sector-4' : undefined,
      projectCode: selectedRole === 'CDPO' ? 'Project-Central' : undefined,
      signedInAt: new Date().toISOString(),
    });

    showToast(
      'Session Simulation Started',
      `Active persona: ${effectiveId} (${currentConfig.label}) • Scoped to ${currentConfig.scopeLevel}.`,
      'success'
    );
    navigate(redirectTarget);
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC] flex flex-col justify-between selection:bg-[#CFEFD8] selection:text-[#0E1B2B] relative overflow-hidden font-sans">
      {/* Background Soft Wash */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-br from-[#CFEFD8]/20 via-[#F5F9FC] to-[#D6E6F7]/30 -z-10"
        aria-hidden="true"
      />

      {/* Top Banner */}
      <header className="w-full bg-[#0E1B2B] text-white/90 text-[11px] py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2 border-b border-white/10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#CFEFD8]" />
        <span>Student research prototype • 100% synthetic data • Not an official Government of India service</span>
      </header>

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
            Role Simulation
          </div>

          <h1 className="text-3xl font-light tracking-tight text-[#0E1B2B]">
            Staff Persona Simulation
          </h1>
          <p className="text-xs text-[#5B6B7C] mt-2 font-normal leading-relaxed">
            Select an operational role to test frontline and supervisory casework scoping. No actual credentials or personal identifiers are stored.
          </p>

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
          <form onSubmit={handleSignIn} className="mt-6 space-y-5">
            {/* Operational Role Level */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Select Role Persona
                </label>
                <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Demo simulation, not authentication
                </span>
              </div>
              <select
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[#0E1B2B] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] transition-all cursor-pointer"
              >
                <option value="AWW">Anganwadi Worker (AWW) — Centre Scope (AWC-702)</option>
                <option value="LS">Lady Supervisor (LS) — Sector Scope (Sector-4)</option>
                <option value="CDPO">Child Development Project Officer (CDPO) — Project Scope</option>
                <option value="DPO">District Programme Officer (DPO) — District View Scope</option>
              </select>
              <p className="text-[11px] text-[#5B6B7C] mt-1.5 leading-relaxed">
                {currentConfig.description}
              </p>
            </div>

            {/* Worker ID (pre-filled per role) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Synthetic Identifier
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[#0E1B2B] font-mono focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] transition-all"
                  placeholder="e.g. AWW-409"
                  required
                />
                <span className="absolute right-3.5 top-3 text-[10px] uppercase font-mono font-bold text-[#1F8A83] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {currentConfig.scopeLevel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Simulated actor: {workerId} • Scope: {currentConfig.defaultScope}
              </p>
            </div>

            {/* Passcode placeholder */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Simulation Passcode
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[#0E1B2B] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] transition-all"
                  placeholder="Any password works for simulation"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Any passcode accepted for research simulation.
              </p>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full mt-2 py-3 px-6 rounded-full bg-[#0E1B2B] hover:bg-black text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
            >
              <span>Launch Persona Simulation ({currentConfig.label})</span>
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
          </form>

          {/* Disclaimer Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Academic research prototype for testing frontline triage usability. 100% synthetic data. No real personal records, Aadhaar numbers, or governmental credentials are held.
            </span>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-400">
        © 2026 Poshan Action Layer • Academic Research Prototype
      </footer>
    </div>
  );
};
