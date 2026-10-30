import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { CoreCapabilities } from '../components/CoreCapabilities';
import { LifecycleTimeline } from '../components/LifecycleTimeline';
import { InteractiveDemo } from '../components/InteractiveDemo';
import { WhoItHelps } from '../components/WhoItHelps';
import { FieldNotes } from '../components/FieldNotes';
import { SafetyGovernance } from '../components/SafetyGovernance';
import { FaqSection } from '../components/FaqSection';
import { ClosingCta } from '../components/ClosingCta';
import { Footer } from '../components/Footer';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // Lenis smooth scroll on landing page only
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    (window as any).__lenis = lenis;

    let animationFrameId: number;

    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    // Initial hash scroll handling if landed with #capabilities or #core-capabilities
    if (window.location.hash) {
      const hash = window.location.hash;
      const target =
        document.querySelector(hash) ||
        (hash === '#capabilities' ? document.querySelector('#core-capabilities') : null) ||
        (hash === '#core-capabilities' ? document.querySelector('#capabilities') : null);
      if (target) {
        setTimeout(() => {
          lenis.scrollTo(target as HTMLElement, { offset: -24 });
        }, 150);
      }
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      delete (window as any).__lenis;
    };
  }, []);

  const navigateToDemo = () => {
    navigate('/dashboard');
  };

  const navigateToSignIn = () => {
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-[#F6FAFF] text-[#0F172A] relative flex flex-col selection:bg-[#CFEFD8] selection:text-[#0F172A]">
      {/* Floating Glass Navbar */}
      <Navbar
        onNavigateDemo={navigateToDemo}
        onNavigateLogin={navigateToSignIn}
      />

      {/* Main Content Sections (3-11 in exact order) */}
      <main className="flex-1 w-full overflow-hidden">
        {/* 3. Hero inside big rounded gradient panel */}
        <Hero onNavigateDemo={navigateToDemo} />

        {/* 4. Core capabilities with horizontal swipeable carousel */}
        <CoreCapabilities />

        {/* 5. Closed-loop lifecycle with vertical timeline (lights up on scroll) */}
        <LifecycleTimeline />

        {/* 6. "From flag to resolved case" interactive demo */}
        <InteractiveDemo onOpenDemo={navigateToDemo} />

        {/* 7. Who it helps */}
        <WhoItHelps />

        {/* 8. "What we heard in the field" */}
        <FieldNotes />

        {/* 9. Safety and governance */}
        <SafetyGovernance />

        {/* 10. FAQ accordion */}
        <FaqSection />

        {/* 11. Closing CTA */}
        <ClosingCta onNavigateDemo={navigateToDemo} />
      </main>

      {/* 12. Footer */}
      <Footer
        onNavigateDemo={navigateToDemo}
        onNavigateLogin={navigateToSignIn}
      />
    </div>
  );
};
