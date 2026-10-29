import React from "react";
import { motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";

interface HeroProps {
  onNavigateDemo: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onNavigateDemo }) => {
  return (
    <section id="home" className="welcome-hero pt-28 sm:pt-32">
      <div className="welcome-hero-panel relative overflow-hidden">
        <div
          className="welcome-hero-background"
          role="img"
          aria-label="Mother and child in a community nutrition setting"
        />
        <div className="welcome-hero-background-overlay" aria-hidden="true" />
        <div className="welcome-hero-grid relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Typography & CTAs (7 cols) */}
          <div className="hero-photo-content welcome-hero-copy lg:col-span-7 relative flex flex-col items-start">
            {/* H1: Inter Tight Light 300 (64/68, tracking -2%) */}
            <h1 className="welcome-hero-title text-4xl sm:text-5xl lg:text-[60px] font-bold text-[#293F59] tracking-[-0.02em] leading-[1.06] mb-6">
              Every child deserves a healthier tomorrow.
            </h1>

            {/* Short Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
              className="text-[#477F9B] text-base sm:text-xl leading-relaxed mb-9 max-w-xl"
            >
              A human-led platform for reviewing nutrition alerts, assigning
              follow-up, and tracking each child&apos;s care journey to
              resolution.
            </motion.p>

            <p className="welcome-hero-supporting-copy text-lg sm:text-xl leading-relaxed mb-9 max-w-xl">
              Our platform helps frontline workers and supervisors identify
              records that need attention, verify measurements, and track
              follow-up actions until each case reaches a documented outcome.
            </p>

            {/* Dark pill CTA button */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
              className="mt-8 flex flex-wrap items-center gap-4 mb-10"
            >
              <button
                type="button"
                onClick={onNavigateDemo}
                className="hero-photo-demo-button group inline-flex items-center gap-2.5 bg-[#293F59] text-white text-sm sm:text-base font-medium px-7 py-3.5 rounded-full shadow-layered hover:bg-[#20334A] active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#477F9B]"
              >
                <span>View interactive demo</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              <a
                href="#capabilities"
                className="relative top-2 inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#293F59] px-4 py-3 rounded-full hover:bg-[#BBD5E4]/45 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#477F9B]"
              >
                <span>How verification works</span>
                <span className="text-[#5B6B7C]">↓</span>
              </a>
            </motion.div>

            {/* Three ticks: End-to-end action tracking, Privacy-first demo data, Built for field use */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.3, ease: "easeOut" }}
              className="grid grid-cols-1 sm:grid-cols-3 items-start gap-3 w-full border-t border-[#E7EAF0] pt-6"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-[#293F59]">
                <div className="w-4 h-4 rounded-full bg-[#F3F7FA] flex items-center justify-center text-[#477F9B] shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>End-to-end action tracking</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#293F59]">
                <div className="w-4 h-4 rounded-full bg-[#F3F7FA] flex items-center justify-center text-[#477F9B] shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Privacy-first demo data</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#293F59]">
                <div className="w-4 h-4 rounded-full bg-[#F3F7FA] flex items-center justify-center text-[#477F9B] shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Built for field use</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
