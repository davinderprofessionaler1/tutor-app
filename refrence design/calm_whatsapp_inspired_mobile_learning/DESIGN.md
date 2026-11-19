---
name: Calm WhatsApp-Inspired Mobile Learning
colors:
  surface: '#f5faff'
  surface-dim: '#d1dbe4'
  surface-bright: '#f5faff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf5fe'
  surface-container: '#e5eff8'
  surface-container-high: '#dfeaf2'
  surface-container-highest: '#d9e4ec'
  on-surface: '#131d23'
  on-surface-variant: '#3c4a3d'
  inverse-surface: '#283238'
  inverse-on-surface: '#e8f2fb'
  outline: '#6c7b6b'
  outline-variant: '#bbcbb9'
  surface-tint: '#006d2f'
  primary: '#006d2f'
  on-primary: '#ffffff'
  primary-container: '#25d366'
  on-primary-container: '#005523'
  inverse-primary: '#3de273'
  secondary: '#1c695f'
  on-secondary: '#ffffff'
  secondary-container: '#a5ede0'
  on-secondary-container: '#226e63'
  tertiary: '#006b5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#63c9b9'
  on-tertiary-container: '#005249'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#66ff8e'
  primary-fixed-dim: '#3de273'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005322'
  secondary-fixed: '#a8f0e3'
  secondary-fixed-dim: '#8cd4c7'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#8ff4e3'
  tertiary-fixed-dim: '#72d8c8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#f5faff'
  on-background: '#131d23'
  surface-variant: '#d9e4ec'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style
This design system translates the familiar, low-cognitive-load communication vernacular of WhatsApp into a serene, distraction-free mobile learning environment. The target audience comprises self-directed students, professionals upskilling on micro-schedules, and lifelong learners who require quiet focus over high-stimulus gamification.

The aesthetic fuses **Utilitarian Minimalism** with delicate **Frosted Glassmorphism**:
- **Clarity over ornament:** Screens prioritize content absorption, crisp legibility, and effortless finger-travel.
- **Calm, rhythmic progression:** Dense lesson structures are dismantled into breathable, card-based micro-units.
- **Subtle tactility:** Soft surfaces, whisper-light boundaries, and ambient depth create an intimate, trustworthy physical presence on mobile viewports.

## Colors
The palette balances vibrant active states against deep, authoritative foundational greens and ultra-neutral grey backdrops:

- **Primary Accent (`#25D366`):** Reserved for core progressive action items, completed states, active progress tracks, and primary floating actions.
- **Deep Forest Green (`#075E54`):** Used for prominent headline highlights, active navigation accents, authoritative tags, and contextual header surfaces.
- **Sub-Forest Teal (`#128C7E`):** Serves as an intermediary tone for secondary highlights, badge outlines, and link hover/pressed states.
- **Canvas & Surfaces:**
  - Page/Section Canvas: `#F0F2F5`
  - High-Level Surfaces & Cards: `#FFFFFF`
  - Frosted Glass Overlay: `rgba(255, 255, 255, 0.85)`
  - Hairline Separators & Structural Borders: `#E9EDEF`
- **Text & Content Hierarchy:**
  - High-emphasis Body & Headlines: `#111B21`
  - Medium-emphasis Metadata & Subtitles: `#667781`
  - Disabled or Placeholder Elements: `#8696A0`

## Typography
Inter provides neutral, high-legibility geometric clarity across dense instructional cards and long-form study screens.

- **Weight Discipline:** Restrict usage to Regular (400) for body/prose, Medium (500) for UI metadata and labels, and SemiBold/Bold (600/700) strictly for interactive landmarks and headers.
- **Reading Comfort:** Maintain generous line heights on `body-lg` and `body-md` (1.4–1.5x font size) to support prolonged screen reading without eye fatigue.
- **Numbers & Metrics:** Utilize tabular figures (`tnum`) in learning metrics, timers, and modular scoreboards for rock-solid visual alignment.

## Layout & Spacing
The layout relies on a mobile-first, single-column fluid flow structured around safe zones and calm breathing room:

- **Mobile Viewports (<600px):** Single-column stack with `margin: 1rem` (16px) canvas boundaries. Bottom navigation requires a persistent dynamic bottom padding offset of at least `5rem` to prevent content overlap.
- **Tablet / Large Handhelds (600px–1024px):** Single-column layout maxes out at a centered reading width of `680px`, expanding side canvas margins to `1.5rem`.
- **Desktop / Web Player (>1024px):** Main study column constrained to `768px` centered on `#F0F2F5` canvas to preserve the focused mobile aspect ratio.
- **Component Padding Scale:**
  - Card interiors use `space-md` (16px) or `space-lg` (24px).
  - Chip containers and mini inputs utilize `space-xs` (4px) vertical and `space-sm` (8px) horizontal rhythm.

## Elevation & Depth
Depth is quiet, modern, and diffuse, pairing tonal layering with subtle ambient shadow models:

- **Base Layer:** The viewport root sits at `#F0F2F5`.
- **Surface Elevation (Cards & Sheets):** Pure white `#FFFFFF` paired with a single 1px hairline perimeter (`#E9EDEF`) and a soft ambient shadow: `box-shadow: 0 4px 16px -2px rgba(17, 27, 33, 0.04), 0 1px 3px 0 rgba(17, 27, 33, 0.02)`.
- **Floating Overlay Navigation:**
  - Background: `rgba(255, 255, 255, 0.82)`
  - Backdrop Blur: `backdrop-filter: blur(16px) saturate(180%)`
  - Border: 1px solid `rgba(233, 237, 239, 0.7)`
  - Shadow: `0 8px 32px 0 rgba(7, 94, 84, 0.08), 0 2px 8px 0 rgba(17, 27, 33, 0.04)`
- **Interactive Press States:** Elements settle deeper on active tap: transform scales to `0.98` with shadow intensity halved.

## Shapes
Geometry is structured and friendly without tilting into childish bubble forms:

- **Cards & Content Modules:** Standardized to an exact 16px corner radius (`rounded-lg`), creating consistent visual encapsulation.
- **Interactive Controls & Fields:** 8px to 12px radii for text fields and secondary button containers.
- **Floating Nav Bar & Badges:** Full pill contour (`border-radius: 9999px`) for the floating bottom glass bar, status chips, quick-filter tags, and primary action FABs.

## Components

### Buttons
- **Primary Action Button:** Solid `#25D366` background, `#FFFFFF` bold text, pill-shaped (`9999px`) or `12px` border-radius, `48px` minimum touch target height. Subtle hover/focus shifts to deep `#128C7E`.
- **Secondary Action Button:** `#FFFFFF` background, 1px solid `#E9EDEF`, `#075E54` text.
- **Ghost/Text Button:** Transparent background, `#075E54` font with underline on active state.

### Cards & Lesson Modules
- Base: `#FFFFFF` fill, 16px corner radius, 1px solid `#E9EDEF`, ambient shadow.
- Interior layout: generous 16px or 20px inset padding, title in `#111B21` (`headline-sm`), description in `#667781` (`body-md`), completion badges tucked in upper corners.

### Floating Frosted Bottom Navigation Bar
- Form: Floating pill container anchored 16px above the device bottom safe area.
- Styling: Frosted white blur background (`rgba(255, 255, 255, 0.85)` + 16px backdrop-filter blur), 1px solid border `#E9EDEF`, pill radius (`9999px`).
- Items: 3 to 4 icon-and-label tabs. Inactive tabs render in `#667781` with clean 1.5px stroke line icons. Active tab illuminates with a circular `#25D366` soft tint halo and `#075E54` icon/text coloring.

### Form Inputs & Search
- Surface: `#FFFFFF` background with 1px border `#E9EDEF`, 12px corner radius.
- States: Focus shifts border to `#075E54` with a 2px outer glow of `rgba(37, 211, 102, 0.2)`. Placeholder text in `#8696A0`.

### Selection Controls
- **Radio Buttons & Checkboxes:** Circular with `#E9EDEF` 1.5px border when idle; filled with `#25D366` sporting a crisp pure white check icon or center dot when selected.
- **Chips & Filter Pills:** Pill-shaped (`9999px`), 32px height. Inactive chips use `#FFFFFF` fill with `#E9EDEF` border and `#667781` text. Active chips invert to `#075E54` background with `#FFFFFF` text.

### Progress & Audio Indicators
- **Lesson Progress Bar:** 4px or 6px tall, pill-rounded track in `#E9EDEF` with fill animated in `#25D366`.
- **Voice Note/Audio Lesson Tile:** WhatsApp-inspired waveforms rendered in `#8696A0` with active played segment highlighted in `#25D366`, accompanied by small circular green play/pause controls.