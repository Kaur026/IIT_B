# Poshan Action Layer — Global Art Direction & Guidelines

## 1. Core Purpose & Ethics
- **Prototype Definition**: Poshan Action Layer is a student research prototype designed to support Anganwadi supervisors and frontline healthcare workers in India.
- **Human-in-the-Loop Principle**: Screening is rule-based and deterministic. Flags are data-quality and triage notifications, **never clinical diagnoses**. Humans verify every flag, assign every action, and validate all field updates.
- **100% Synthetic Data**: All beneficiary IDs (`BEN-0142`, `BEN-0087`, etc.), worker IDs (`AWW-07`, `AWW-409`), and case IDs (`ACT-2041`) are synthetic. No real names, Aadhaar numbers, phone numbers, or addresses are stored or presented.
- **Audit Line & Non-Destructive Edits**: Original readings are never overwritten. A prior reading like `Original: 12.3 kg (kept)` remains intact, and re-measurements are logged as separate chronological events with an explicit audit trail (actor, timestamp, action, rationale).

---

## 2. Color Palette & Status Semantics
- **Canvas / Background**: `#F5F9FC` (calm, warm, airy, pale blue-white canvas).
- **Ink / Headings & Primary Buttons**: `#0E1B2B` (deep midnight ink, no pure black `#000000`).
- **Secondary / Body Text**: `#5B6B7C` (muted slate-grey for descriptions and helper text).
- **Key Panels & Hero**: 32px corner radius (`rounded-[32px]`) with a linear gradient from mint `#CFEFD8` to sky `#D6E6F7`, a faint radial highlight top-left, and an SVG film-grain texture overlay (`feTurbulence`, fixed, 4% opacity, blend multiply).
- **Status Chips (12% Tinted Fills)**:
  - **Urgent**: `#C8453B` | Fill: `rgba(200, 69, 59, 0.12)`
  - **Attention**: `#D98E04` | Fill: `rgba(217, 142, 4, 0.12)`
  - **Resolved / Stable**: `#2E8B57` | Fill: `rgba(46, 139, 87, 0.12)`
  - **Info / Verification**: `#3A6FD8` | Fill: `rgba(58, 111, 216, 0.12)`
  - **Duplicate / Flagged**: `#7A5CC2` | Fill: `rgba(122, 92, 194, 0.12)`
- **Chart Palette (Single Hue Family — Mint to Deep Teal)**:
  - Tone 1: `#CFEFD8` (soft mint highlight)
  - Tone 2: `#8FD3B6` (light seafoam)
  - Tone 3: `#4FB39A` (medium mint-teal)
  - Tone 4: `#1F8A83` (rich teal)
  - Tone 5: `#0F5E66` (deep forest teal)
  - *Strict Rule: Never use rainbow, multicolored categorical schemes or arbitrary saturated colors.*

---

## 3. Typography & Numerical Data
- **Primary Headings (H1)**: `Inter Tight Light 300`, font size 64px / line height 68px, tracking -2% (`letter-spacing: -0.02em`).
- **Secondary Headings (H2)**: `Inter Tight Regular 400`, tight tracking.
- **Body Copy**: `Inter 15px / 24px` line height.
- **Tabular Data**: Monospaced tabular numerals (`font-variant-numeric: tabular-nums`) across all metrics, timestamps, weights, and table cells.

---

## 4. Depth, Glassmorphism & Micro-Interactions
- **Three-Layer Shadow Elevation**:
  - `box-shadow: 0 1px 2px rgba(14, 27, 43, 0.06), 0 8px 24px rgba(14, 27, 43, 0.08), 0 24px 64px rgba(14, 27, 43, 0.10);`
- **Frosted Glass Surface**:
  - `background: rgba(255, 255, 255, 0.55);`
  - `backdrop-filter: blur(24px);`
  - `border: 1px solid rgba(255, 255, 255, 0.7);`
  - `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 32px rgba(14, 27, 43, 0.06);`
- **Ambient Animated Background**:
  - Three oversized blurred radial layers (mint, sky, white) drifting continuously (40–60s ease-in-out alternate) behind panels.
  - Three soft blurred gradient orbs behind the dashboard header. CSS animations only.
- **Spring-Physics TiltCard**:
  - Cursor tracking tilt up to 4° (hero up to 6°) with spring physics (`stiffness: 180, damping: 18`) and a dynamic specular glare highlight.
- **Motion Specs**:
  - Heading entrance: fade + 24px rise with 80ms stagger.
  - Card hover: 6px vertical lift and shadow expansion.
  - Case drawers: right-hand slide-in (`duration: 0.35s, ease: easeOut`) with soft backdrop blur.
  - Metric counters: animated count-up from 0.
  - Bar & donut charts: scaleY growth from 0 and animated SVG `stroke-dashoffset`.
- **Accessibility & Reduced Motion**:
  - Honors `@media (prefers-reduced-motion: reduce)`. Disables 3D tilt, background drift, and WebGL rendering smoothly with a graceful static fallback.

---

## 5. Asset Rules & Placeholders
- **Child Privacy**: Never display real photographs of children.
- **Placeholder Standard**: Use `"ASSET: <name>"` labeled visual frames (e.g., `ASSET: Anganwadi worker cut-out`, `ASSET: Field scale illustration`) sized accurately for future 3D or photographic inserts.
