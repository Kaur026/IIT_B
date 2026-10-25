import React, { useState, useEffect } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  onNavigateDemo: () => void;
  onNavigateLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateDemo, onNavigateLogin }) => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Frosted background after 30px
      setIsScrolled(currentScrollY > 30);

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'How it works', href: '#how-it-works' },
    { name: 'Core capabilities', href: '#capabilities' },
    { name: 'Workflow', href: '#workflow' },
    { name: 'About', href: '#about' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (window.location.pathname !== '/') {
      e.preventDefault();
      navigate(`/${href}`);
      return;
    }

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
    <header
      className={`welcome-navbar fixed top-10 left-0 right-0 z-40 px-3 sm:px-6 transition-all duration-300 transform ${
        isVisible ? 'translate-y-0' : '-translate-y-28'
      }`}
    >
      <div
        className={`welcome-navbar-inner mx-auto rounded-full px-5 py-3 transition-all duration-300 flex items-center justify-between ${
          isScrolled
            ? 'frosted-glass shadow-layered'
            : 'bg-white/60 backdrop-blur-md border border-white/70 shadow-sm'
        }`}
      >
        {/* Logo Left */}
        <a
          href="#home"
          onClick={(e) => handleNavClick(e, '#home')}
          className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83] rounded-lg"
          aria-label="Poshan Action Layer Home"
        >
          <div className="welcome-brand-icon w-8 h-8 rounded-full bg-[#2457F5] text-white flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9 23V9m0 4h3m-3 5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="18" cy="10" r="2" fill="currentColor" />
              <path d="M18 13v5m0-3-4 2m4-2 4 2m-4 1-3 4m3-4 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.5 8c.7-2.5 2.7-3.7 5.3-3.3-.2 2.7-2.1 4.2-5.3 4.2" fill="#C9DCCF" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-[#0E1B2B] group-hover:text-[#1F8A83] transition-colors leading-none">
              Poshan Action Layer
            </span>
            <span className="text-[10px] text-[#5B6B7C] font-mono">Demo Prototype</span>
          </div>
        </a>

        {/* Center Nav Links */}
        <nav
          aria-label="Main navigation"
          className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-medium text-[#5B6B7C]"
        >
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="px-3 py-1.5 rounded-full hover:text-[#0E1B2B] hover:bg-black/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateLogin}
            className="text-xs font-medium text-[#5B6B7C] hover:text-[#0E1B2B] px-3 py-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
          >
            Log in (demo)
          </button>
          <button
            type="button"
            onClick={onNavigateDemo}
            className="group inline-flex items-center gap-1.5 bg-[#0E1B2B] text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-sm hover:bg-black/85 transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83]"
          >
            <span>Explore Demo</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-1.5 text-[#0E1B2B] hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A83] rounded-full"
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 frosted-glass rounded-2xl p-4 shadow-layered flex flex-col gap-2 max-w-sm mx-auto">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleNavClick(e, link.href);
              }}
              className="px-4 py-2 text-sm text-[#0E1B2B] font-medium hover:bg-black/5 rounded-xl transition-colors"
            >
              {link.name}
            </a>
          ))}
          <div className="h-px bg-black/5 my-1" />
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigateLogin();
            }}
            className="w-full text-left px-4 py-2 text-sm font-medium text-[#5B6B7C] hover:bg-black/5 rounded-xl"
          >
            Log in (demo)
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigateDemo();
            }}
            className="w-full mt-1 flex items-center justify-center gap-2 bg-[#0E1B2B] text-white text-sm font-medium py-2.5 rounded-full shadow-sm"
          >
            <span>Explore Demo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
