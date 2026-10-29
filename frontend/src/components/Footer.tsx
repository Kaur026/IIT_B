import React from 'react';
import { useToast } from '../context/ToastContext';

interface FooterProps {
  onNavigateDemo: () => void;
  onNavigateLogin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateDemo, onNavigateLogin }) => {
  const { showPlaceholderToast } = useToast();

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      const target =
        document.querySelector(href) ||
        (href === '#capabilities' ? document.querySelector('#core-capabilities') : null) ||
        (href === '#core-capabilities' ? document.querySelector('#capabilities') : null);

      if (target) {
        e.preventDefault();
        const lenis = (window as any).__lenis;
        if (lenis && typeof lenis.scrollTo === 'function') {
          lenis.scrollTo(target as HTMLElement, { offset: -24 });
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        window.history.pushState(null, '', href);
      }
    }
  };

  return (
    <footer className="w-full bg-white border-t border-slate-200/80 mt-20 pt-16 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-100">
          {/* Brand Info (5 cols) */}
          <div className="md:col-span-5 flex flex-col items-start">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs">
                PA
              </div>
              <span className="font-semibold text-base tracking-tight text-slate-900">
                Poshan Action Layer
              </span>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed max-w-sm mb-4">
              Frontline casework and verification layer for child nutrition monitoring. Designed to assist
              supervisors and community workers with intelligent, human-gated task triage.
            </p>

            <div className="text-xs text-slate-400">
              Inquiries: <span className="font-mono text-slate-600">contact@example.com (demo)</span>
            </div>
          </div>

          {/* Navigation Links (3 cols) */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-4">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
              <li>
                <a
                  href="#home"
                  onClick={(e) => handleAnchorClick(e, '#home')}
                  className="hover:text-slate-900 transition-colors"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  onClick={(e) => handleAnchorClick(e, '#how-it-works')}
                  className="hover:text-slate-900 transition-colors"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  href="#capabilities"
                  onClick={(e) => handleAnchorClick(e, '#capabilities')}
                  className="hover:text-slate-900 transition-colors"
                >
                  Core capabilities
                </a>
              </li>
              <li>
                <a
                  href="#workflow"
                  onClick={(e) => handleAnchorClick(e, '#workflow')}
                  className="hover:text-slate-900 transition-colors"
                >
                  Operational workflow
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateDemo}
                  className="text-left hover:text-slate-900 transition-colors font-medium text-[#2457F5]"
                >
                  Explore demo view →
                </button>
              </li>
            </ul>
          </div>

          {/* Governance & Safeguards (4 cols) */}
          <div className="md:col-span-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-4">
              Governance &amp; Safeguards
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
              <li>
                <button
                  type="button"
                  onClick={() => showPlaceholderToast('Human-in-the-Loop Protocol')}
                  className="text-slate-500 hover:text-slate-900 text-left transition-colors"
                >
                  Human-in-the-Loop Protocol
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => showPlaceholderToast('WHO Child Growth Standards')}
                  className="text-slate-500 hover:text-slate-900 text-left transition-colors"
                >
                  WHO 2006 Standards (Modelled)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => showPlaceholderToast('Zero PII Sandbox')}
                  className="text-slate-500 hover:text-slate-900 text-left transition-colors"
                >
                  Zero PII Synthetic Testing Sandbox
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className="text-slate-500 hover:text-slate-900 transition-colors font-semibold text-[#2457F5]"
                >
                  Staff sign-in
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="text-center sm:text-left">
            © 2026 Poshan Action Layer.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              type="button"
              onClick={() => showPlaceholderToast('Privacy Notice')}
              className="hover:text-slate-600 transition-colors"
            >
              Privacy Notice (demo)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => showPlaceholderToast('Terms of Study')}
              className="hover:text-slate-600 transition-colors"
            >
              Terms of Study
            </button>
            <span>•</span>
            <span>Poshan Action Layer © 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
