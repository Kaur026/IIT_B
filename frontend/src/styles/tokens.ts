/**
 * Poshan Action Layer Design System Tokens
 * Strict Framer / Awwwards art direction
 */

export const tokens = {
  colors: {
    // Canvas & Typography
    canvas: '#F5F9FC',
    ink: '#0E1B2B',
    secondary: '#5B6B7C',
    muted: '#8A99A8',
    border: 'rgba(14, 27, 43, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.6)',

    // Gradient Panel (32px radius, mint to sky with faint radial highlight)
    mint: '#CFEFD8',
    sky: '#D6E6F7',
    panelGradient: 'linear-gradient(135deg, #CFEFD8 0%, #D6E6F7 100%)',
    panelGradientOverlay: 'radial-gradient(ellipse at 15% 15%, rgba(255, 255, 255, 0.5) 0%, transparent 60%)',

    // Status Chips (12% tinted fills, never saturated/neon)
    status: {
      urgent: {
        text: '#C8453B',
        fill: 'rgba(200, 69, 59, 0.12)',
        border: 'rgba(200, 69, 59, 0.24)',
        dot: '#C8453B',
        label: 'Urgent',
      },
      attention: {
        text: '#D98E04',
        fill: 'rgba(217, 142, 4, 0.12)',
        border: 'rgba(217, 142, 4, 0.24)',
        dot: '#D98E04',
        label: 'Needs attention',
      },
      resolved: {
        text: '#2E8B57',
        fill: 'rgba(46, 139, 87, 0.12)',
        border: 'rgba(46, 139, 87, 0.24)',
        dot: '#2E8B57',
        label: 'Resolved',
      },
      info: {
        text: '#3A6FD8',
        fill: 'rgba(58, 111, 216, 0.12)',
        border: 'rgba(58, 111, 216, 0.24)',
        dot: '#3A6FD8',
        label: 'Needs verification',
      },
      duplicate: {
        text: '#7A5CC2',
        fill: 'rgba(122, 92, 194, 0.12)',
        border: 'rgba(122, 92, 194, 0.24)',
        dot: '#7A5CC2',
        label: 'Review rule',
      },
    },

    // Chart Palette (Single Hue family: mint to deep teal, rounded bars with soft glow)
    charts: {
      step1: '#CFEFD8',
      step2: '#8FD3B6',
      step3: '#4FB39A',
      step4: '#1F8A83',
      step5: '#0F5E66',
      glow: 'rgba(79, 179, 154, 0.28)',
      donut: ['#0F5E66', '#1F8A83', '#4FB39A'],
    },

    // Frosted Glass
    glass: {
      bg: 'rgba(255, 255, 255, 0.55)',
      backdropBlur: '24px',
      border: 'rgba(255, 255, 255, 0.7)',
      innerHighlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
    },

    // Legacy compatibility aliases for existing components
    pageBg: '#F5F9FC',
    textHeading: '#0E1B2B',
    textBody: '#5B6B7C',
    textMuted: '#8A99A8',
    cardBg: '#FFFFFF',
    cardBgFrosted: 'rgba(255, 255, 255, 0.55)',
    brandBlue: '#3A6FD8',
    mintGradientStart: '#CFEFD8',
    skyGradientEnd: '#D6E6F7',
  },

  radius: {
    panel: '32px',
    card: '24px',
    inner: '16px',
    pill: '9999px',
  },

  shadows: {
    // Depth recipe: three-layer shadows
    layered: '0 1px 2px rgba(14, 27, 43, 0.06), 0 8px 24px rgba(14, 27, 43, 0.08), 0 24px 64px rgba(14, 27, 43, 0.10)',
    soft: '0 1px 3px rgba(14, 27, 43, 0.04), 0 6px 16px rgba(14, 27, 43, 0.06)',
    card: '0 1px 2px rgba(14, 27, 43, 0.05), 0 10px 30px rgba(14, 27, 43, 0.06)',
    cardHover: '0 2px 4px rgba(14, 27, 43, 0.06), 0 16px 36px rgba(14, 27, 43, 0.12)',
    drawer: '-12px 0 40px rgba(14, 27, 43, 0.14)',
    glass: 'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 32px rgba(14, 27, 43, 0.06)',
  },

  typography: {
    fontFamily: {
      h1: "'Inter Tight', sans-serif",
      h2: "'Inter Tight', sans-serif",
      body: "'Inter', sans-serif",
    },
  },

  transitions: {
    spring: { stiffness: 180, damping: 18 },
    drawer: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
    fade: { duration: 0.35, ease: 'easeOut' },
  },
} as const;
