import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Lock, Eye, Building2, UserCheck, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { createDemoPersona, useAuth } from '../context/AuthContext';
import { isUserRole, UserRole, ROLE_CONFIGS } from '../utils/permissions';
import { isMockDemoEnabled } from '../utils/demoMode';

const VALID_AWW_CENTRES: Record<string, { workerId: string; centreName: string }> = {
  'AWC-702': { workerId: 'AWW-409', centreName: 'Anganwadi Centre 702' },
  'AWC-703': { workerId: 'AWW-405', centreName: 'Anganwadi Centre 703' },
  'AWC-704': { workerId: 'AWW-410', centreName: 'Anganwadi Centre 704' },
  'AWC-705': { workerId: 'AWW-417', centreName: 'Anganwadi Centre 705' },
  'AWC-706': { workerId: 'AWW-421', centreName: 'Anganwadi Centre 706' },
};

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { loginAsStaff } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('AWW');
  const [centreCodeInput, setCentreCodeInput] = useState('AWC-702');
  const demoEnabled = isMockDemoEnabled(import.meta.env);

  const redirectMessage = (location.state as any)?.message;
  const redirectTarget = (location.state as any)?.from || '/dashboard';

  const handleRoleChange = (value: string) => {
    if (isUserRole(value)) {
      setSelectedRole(value);
      if (value === 'AWW' && !centreCodeInput.trim()) {
        setCentreCodeInput('AWC-702');
      }
    }
  };

  const currentConfig = ROLE_CONFIGS[selectedRole];
  const normalizedCentre = centreCodeInput.trim().toUpperCase();
  const awwCentreConfig = VALID_AWW_CENTRES[normalizedCentre];
  const isAww = selectedRole === 'AWW';
  const isAwwValid = !isAww || Boolean(awwCentreConfig);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEnabled || !isAwwValid) return;

    let persona;
    if (isAww) {
      if (!awwCentreConfig) return;
      persona = createDemoPersona('AWW', undefined, normalizedCentre, awwCentreConfig.workerId);
    } else if (selectedRole === 'Parent/Family') {
      persona = createDemoPersona('Parent/Family', undefined, 'AWC-702', 'FAM-0142', ['BEN-0142']);
    } else {
      persona = createDemoPersona(selectedRole);
    }

    if (!await loginAsStaff(persona)) return;

    showToast(
      'Session Started',
      `Active persona: ${isAww ? `AWW (${awwCentreConfig?.workerId} at ${normalizedCentre})` : currentConfig.label}.`,
      'success'
    );
    const target = (location.state as any)?.from || (selectedRole === 'Parent/Family' ? '/family' : '/dashboard');
    navigate(target);
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 mb-4">
            <UserCheck className="w-3.5 h-3.5 text-[#1F8A83]" />
            Frontline Access Portal
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#0E1B2B]">
            Staff Sign In
          </h1>
          <p className="text-xs text-[#5B6B7C] mt-2 font-normal leading-relaxed">
            Select your operational role persona to access your assigned Anganwadi Centre, sector, or project worklist.
          </p>

          {/* Guard Redirect Alert if user attempted staff-only workflow */}
          {redirectMessage && (
            <div className="mt-4 mb-2 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Staff Access Required</p>
                <p className="text-[11px] text-amber-800 mt-0.5">{redirectMessage}</p>
              </div>
            </div>
          )}

          {/* Form */}
          {demoEnabled ? (
            <form onSubmit={handleSignIn} className="mt-6 space-y-5">
              {/* Role Persona Dropdown */}
              <div>
                <label htmlFor="demo-role" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Role Persona
                </label>
                <select
                  id="demo-role"
                  value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[#0E1B2B] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F8A83]/30 focus:border-[#1F8A83] transition-all cursor-pointer"
                >
                  <option value="AWW">Anganwadi Worker (AWW) — Frontline Centre Level</option>
                  <option value="LS">Lady Supervisor (LS) — Sector Level (Sector-4)</option>
                  <option value="CDPO">Child Development Project Officer (CDPO) — Project Level</option>
                  <option value="DPO">District Programme Officer (DPO) — District Level</option>
                  <option value="System Administrator">System Administrator — Administrative Functions</option>
                  <option value="Rule Administrator">Rule Administrator — Rule Management</option>
                  <option value="Parent/Family">Parent / Family Member — Family Portal (Aarav Sharma · BEN-0142)</option>
                </select>
                <p className="text-[11px] text-[#5B6B7C] mt-1.5 leading-relaxed">
                  {currentConfig.description}
                </p>
              </div>

              {/* Centre Code Input when AWW is selected */}
              {isAww && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="aww-centre-code" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#1F8A83]" />
                      <span>Enter Centre Code</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      e.g. AWC-702 to AWC-706
                    </span>
                  </div>
                  <input
                    id="aww-centre-code"
                    type="text"
                    value={centreCodeInput}
                    onChange={(e) => setCentreCodeInput(e.target.value)}
                    placeholder="Enter centre code (e.g. AWC-702)"
                    className={`w-full text-xs bg-slate-50 border rounded-xl px-4 py-3 font-mono font-medium focus:outline-none focus:ring-2 transition-all ${
                      isAwwValid
                        ? 'border-slate-200 text-[#0E1B2B] focus:ring-[#1F8A83]/30 focus:border-[#1F8A83]'
                        : 'border-rose-300 text-rose-900 bg-rose-50/40 focus:ring-rose-200'
                    }`}
                  />
                  {!isAwwValid && (
                    <p className="mt-1.5 text-[11px] text-rose-600 flex items-center gap-1" role="alert">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Invalid centre code. Please enter one of: AWC-702, AWC-703, AWC-704, AWC-705, AWC-706.</span>
                    </p>
                  )}
                </div>
              )}

              {/* Family portal child link card */}
              {selectedRole === 'Parent/Family' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-slate-700 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Family Account:</span>
                    <span className="font-mono font-semibold text-blue-900">FAM-0142 (Sharma Family)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Linked Child:</span>
                    <span className="font-semibold text-blue-900">Aarav Sharma · BEN-0142</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Caregiver / Kinship:</span>
                    <span className="text-slate-800">Mother (Priya Sharma)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Anganwadi Centre:</span>
                    <span className="text-slate-800">AWC-702 · Frontline Worker AWW-409</span>
                  </div>
                </div>
              )}

              {/* Selected Worker and Centre Display */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Assigned Identity:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {isAww && awwCentreConfig
                      ? awwCentreConfig.workerId
                      : currentConfig.defaultId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Assigned Scope:</span>
                  <span className="font-medium text-slate-900">
                    {isAww && awwCentreConfig
                      ? `${normalizedCentre} (${awwCentreConfig.centreName})`
                      : currentConfig.defaultScope}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ y: isAwwValid ? -1 : 0 }}
                whileTap={{ scale: isAwwValid ? 0.98 : 1 }}
                type="submit"
                disabled={!isAwwValid}
                className="w-full mt-2 py-3 px-6 rounded-full bg-[#0E1B2B] hover:bg-black disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
              >
                <span>{selectedRole === 'Parent/Family' ? 'Enter Parent / Family Portal' : `Start Demo Persona (${currentConfig.label})`}</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>

              {/* Public Overview Link */}
              <div className="text-center pt-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#1F8A83] transition-colors py-1"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Explore Public Read-Only Overview →</span>
                </Link>
              </div>
            </form>
          ) : (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
              <h2 className="font-bold">Staff sign-in is unavailable</h2>
              <p className="mt-1 text-xs leading-relaxed">Local persona simulation is disabled in this build.</p>
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-400">
        © 2026 Poshan Action Layer
      </footer>
    </div>
  );
};
