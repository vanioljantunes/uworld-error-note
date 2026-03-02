# GapStrike Landing Page Redesign — Design Doc

**Date**: 2026-03-02
**Status**: Approved

## Overview

Remake the GapStrike landing page as a standalone `index.html` in `gapstrike/`, reusing the structural layout, spacing system, and animation logic from `landing_page_example/index.html`. Dark theme with purple accents. Neural lattice hero visual.

## Tech Stack

- Standalone HTML (no build step)
- Tailwind CDN + custom config
- GSAP 3.12 + ScrollTrigger
- Iconify icons
- Fonts: Space Grotesk (display), Inter (body), JetBrains Mono (mono/labels)

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| bg-body | `#0a0a0f` | Page background |
| bg-section | `#111118` | Alternating section bg |
| bg-card | `#16161f` | Card backgrounds |
| text-primary | `#ffffff` | Headlines |
| text-secondary | `#9898a6` | Body text |
| text-muted | `#5a5a6e` | Labels, meta |
| accent | `#7c3aed` | CTAs, highlights, brand |
| accent-glow | `rgba(124,58,237,0.3)` | Glow effects |
| border | `rgba(255,255,255,0.06)` | Subtle separators |

## Sections

### 1. Navbar (fixed, glassmorphism)

- Left: Logo — purple dot + "GapStrike" (Space Grotesk)
- Center: nav links — Method / Features / Pricing (mono, uppercase, letter-spaced)
- Right: Login (ghost button) + Get Started (purple pill)
- Backdrop: `bg-black/70 backdrop-blur-md border-b border-white/5`

### 2. Hero (sticky scroll, 200vh container)

- 12-col grid, content cols 1-7
- Badge: purple dot + "Question-Indexed Mastery" (mono label)
- Headline: "Master Your" (white) + "Mistakes." (text-outline, purple stroke)
- Subheadline: "GapStrike transforms every incorrect answer into structured, permanent knowledge."
- CTAs: "Get Started" (purple pill) + "See How It Works" (ghost pill + arrow)
- Right side: Canvas-based neural lattice (nodes with question IDs, connecting lines, pulse animation)
- Scroll behavior: text parallax-fades out via GSAP ScrollTrigger
- Bottom: scroll hint indicator

### 3. Problem Section (3-col flashlight cards)

- Label: "The Problem"
- Headline: "Studying Isn't the Same as Structuring."
- Cards (same dimensions/hover as example template):
  1. **Passive Review** — `solar:eye-scan-linear` — "Re-reading highlights doesn't build durable memory. Knowledge fades without active structuring."
  2. **Fragmented Notes** — `solar:documents-minimalistic-linear` — "Scattered annotations across tools create noise, not signal. No system connects them."
  3. **Recurring Mistakes** — `solar:refresh-circle-linear` — "The same errors repeat because the gap was never diagnosed. You review, but never resolve."
- Hover: icon bg flip, progress bar fill animation

### 4. Method Section (horizontal 3-step)

- Label: "The Method"
- Headline: "From Error to Mastery. In Three Steps."
- Numbered steps (layout from example's tech specs feature list):
  1. **Diagnose the Gap** — "Paste a wrong answer. GapStrike extracts the exact reasoning failure and maps it to your knowledge structure."
  2. **Generate Micro-Notes** — "AI generates a targeted micro-note addressing the specific gap — mechanism, distinction, or reasoning chain."
  3. **Build Macro Structure** — "Notes accumulate into an indexed knowledge architecture. Every mistake strengthens the system."

### 5. Differentiation Section (2x2 grid)

- Label: "Why GapStrike"
- Headline: "Built Different."
- 2x2 glassmorphism cards:
  1. **Question-Indexed Knowledge** — "Every note traces back to a specific question. No orphan information."
  2. **Gap-Driven Learning** — "Learning starts from what you got wrong, not what you already know."
  3. **Micro to Macro Integration** — "Individual notes compose into a structured knowledge graph over time."
  4. **Built for Long-Term Retention** — "Spaced repetition meets error analysis. Knowledge that compounds."

### 6. CTA Section (cinematic full-screen)

- Radial gradient glow background (purple orb)
- Glowing card with beam/spin effect (from example)
- Headline: "Start Mastering Your Mistakes"
- Button: "Get Early Access" (white pill, slide-up hover)

### 7. Footer

- Logo, nav links (Privacy / Terms / Support), copyright
- Dark bg (`#050508`), border top

## Animations (from example)

- `reveal-up`: translateY(30) + blur(15) -> clear, scroll-triggered via GSAP
- `reveal-zoom`: scale(0.95) + blur -> clear
- Flashlight cards: radial gradient follows cursor (CSS custom properties)
- Beam button: conic-gradient spin on hover
- Hero text: parallax fade on scroll (GSAP ScrollTrigger)
- Neural lattice: continuous requestAnimationFrame (node drift, connection pulse, glow)
- Noise overlay: fixed, ~2% opacity
- Scroll hint: line animation at hero bottom

## File Output

- `gapstrike/index.html` — single self-contained file (all CSS inline, JS at bottom)
- No external assets required (all visuals are CSS/SVG/Canvas)

## Design Constraints

- No pen/hardware language
- No emojis
- Premium, minimal, futuristic tone
- Max container: 1440px
- Spacing rhythm from example (py-24 md:py-32, mb-24, gap-16, px-6 md:px-24)
- Typography scale from example (text-5xl to text-7xl headlines, text-xs mono labels)
