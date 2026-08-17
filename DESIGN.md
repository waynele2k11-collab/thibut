# THI BÚT — DESIGN SYSTEM & UI SPECIFICATION
### Version 0.2 — Google Stitch Design Baseline (Authoritative)

> **Source of Truth**: This document is derived directly from the Google Stitch project HTML exports located in `/stitch_thi_b_t_system_architecture/`. All color tokens, typography scales, spacing values, and component patterns **must** match those exports exactly.

---

## 1. DESIGN PHILOSOPHY & BRAND AESTHETIC

Thi Bút's interface is designed as an **editorial art gallery**, not a typical SaaS or generic e-commerce site.

### Core Visual Principles:
- **Light Mode First (Paper & Ink):** The canonical Stitch design uses a warm off-white (`#fbf9f4`) surface with near-black (`#1b1c19`) text — evoking Japanese washi paper and sumi ink.
- **Quiet Luxury + Asian Editorial:** High contrast, generous whitespace, zero drop-shadows, flat/architectural depth.
- **Typography as Art:** `Playfair Display` (serif) for display, headlines, and brand mark. `Inter` (sans-serif) for all UI controls, labels, and body text. Calligraphic/brush typography is **strictly restricted** to canvas preview and artwork display components.
- **Texture Overlay:** A subtle SVG-based `fractalNoise` paper grain overlay is applied as a fixed, full-screen background element (`opacity: 0.05`) across all pages.
- **High Intent Layouts:** Constrained, intentional customization components. No neon gradients, robotic icons, or noisy patterns.

---

## 2. COLOR PALETTE — STITCH DESIGN TOKENS (Authoritative)

These are the **exact** hex values extracted from the Stitch Tailwind config, consistent across all 53 Stitch screen exports.

### Core Semantic Tokens:
| Token | Hex Value | Usage |
|:---|:---|:---|
| `background` | `#fbf9f4` | Page background (warm white/ivory) |
| `on-background` | `#1b1c19` | Primary text on background |
| `surface` | `#fbf9f4` | Card surfaces, modal backgrounds |
| `on-surface` | `#1b1c19` | Text on surface |
| `surface-container-lowest` | `#ffffff` | Elevated card fill (pure white) |
| `surface-container-low` | `#f5f3ee` | Secondary card, section backgrounds |
| `surface-container` | `#f0eee9` | Input field fills |
| `surface-container-high` | `#eae8e3` | Hover states, active containers |
| `surface-container-highest` | `#e4e2dd` | Selected states, tabs |
| `surface-variant` | `#e4e2dd` | Dividers, border fills |
| `surface-dim` | `#dbdad5` | Disabled surface states |
| `surface-bright` | `#fbf9f4` | Bright surface overlay |

### Primary & Secondary:
| Token | Hex Value | Usage |
|:---|:---|:---|
| `primary` | `#000000` | Ink Black — main CTA fills, dominant typography |
| `on-primary` | `#ffffff` | Text/icon on primary-filled surfaces |
| `primary-container` | `#1b1b1c` | Dark container (nav active state) |
| `primary-fixed` | `#e5e2e3` | Subtle tinted surface |
| `primary-fixed-dim` | `#c8c6c7` | Dimmed primary tint |
| `secondary` | `#b71032` | Vermilion Seal Red — accent, CTA hover, active nav |
| `on-secondary` | `#ffffff` | Text on secondary-filled surfaces |
| `secondary-container` | `#da3148` | Brighter red container |

### On-Variant & Outline:
| Token | Hex Value | Usage |
|:---|:---|:---|
| `on-surface-variant` | `#46474a` | Muted/secondary text, inactive nav |
| `surface-tint` | `#5f5e5f` | CTA hover (alternative) |
| `outline` | `#76777b` | Borders, default rule lines |
| `outline-variant` | `#c7c6ca` | Subtle dividers, light separators |

### Inverse & Error:
| Token | Hex Value | Usage |
|:---|:---|:---|
| `inverse-surface` | `#30312e` | Dark tooltip/toast surface |
| `inverse-on-surface` | `#f2f1ec` | Text on inverse surface |
| `inverse-primary` | `#c8c6c7` | Inverse primary (light on dark) |
| `error` | `#ba1a1a` | Error states |
| `error-container` | `#ffdad6` | Error container backgrounds |
| `on-error-container` | `#93000a` | Text on error containers |

### Tertiary (Ink/Coal Black):
| Token | Hex Value | Usage |
|:---|:---|:---|
| `tertiary` | `#000000` | Deep black for extreme contrast |
| `tertiary-container` | `#1a1c1c` | Very dark surface |
| `on-tertiary` | `#ffffff` | White text on tertiary |
| `on-tertiary-container` | `#838484` | Muted text on tertiary container |

---

## 3. TYPOGRAPHY & TYPE SCALE

Fonts: `Playfair Display` (display/headline roles) + `Inter` (label/body roles). Both sourced from Google Fonts.

### Token Scale (from Stitch `fontSize` config):
| Token | Font | Size | Line Height | Letter Spacing | Weight |
|:---|:---|:---|:---|:---|:---|
| `display-lg` | Playfair Display | `48px` | `1.1` | `-0.02em` | `700` |
| `display-lg-mobile` | Playfair Display | `32px` | `1.2` | — | `700` |
| `headline-md` | Playfair Display | `32px` | `1.2` | — | `600` |
| `headline-sm` | Playfair Display | `24px` | `1.3` | — | `600` |
| `body-lg` | Inter | `18px` | `1.6` | — | `400` |
| `body-md` | Inter | `16px` | `1.5` | — | `400` |
| `label-caps` | Inter | `12px` | `1.0` | `0.1em` | `600` |

> In Tailwind / CSS: Use the `font-{token}` + `text-{token}` class pairs together. Example: `className="font-display-lg text-display-lg"`.

---

## 4. SPACING & LAYOUT TOKENS

From the Stitch `spacing` config (consistent across all exports):

| Token | Value | Usage |
|:---|:---|:---|
| `section-gap` | `120px` | Vertical spacing between major page sections |
| `margin-desktop` | `64px` | Left/right page margin on desktop |
| `margin-mobile` | `24px` | Left/right page margin on mobile |
| `container-max` | `1280px` | Maximum content container width |
| `gutter` | `24px` | Grid gutters between cards/columns |
| `unit` | `8px` | Base design unit |

### Border Radius:
| Token | Value |
|:---|:---|
| `DEFAULT` | `0.25rem` (4px) |
| `lg` | `0.5rem` (8px) |
| `xl` | `0.75rem` (12px) |
| `full` | `9999px` (pill) |

> **Avoid large corner radii** on cards and buttons. The Stitch designs use `rounded` (4px) or `rounded-lg` (8px) max — never aggressive bubbles.

---

## 5. COMPONENT PATTERNS (from Stitch Exports)

### 5.1 Navigation Bar (`bg-background border-b border-surface-variant`)
- **Brand Logo:** `font-display-lg text-display-lg text-primary` on desktop, `font-display-lg-mobile text-display-lg-mobile` on mobile.
- **Nav Links:** `font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-secondary`.
- **Active Link:** `text-primary font-bold border-b-2 border-secondary`.
- **Icons:** Uses `lucide-react` (`Search`, `ShoppingCart`, `User`) or `material-symbols-outlined`.
- **Layout:** `flex justify-between items-center w-full px-margin-desktop py-4 max-w-container-max mx-auto`.

### 5.2 Home Page (`/`) — Stitch: `thi_b_t_home`
- **Background:** `bg-background` with fixed `texture-overlay` noise grain.
- **Hero layout:** Two-column (text left, image right) on desktop, stacked on mobile.
- **Hero headline:** `font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-primary`.
- **Hero CTA button:** `bg-primary text-on-primary px-8 py-4 font-label-caps text-label-caps hover:bg-secondary hover:text-on-secondary transition-all duration-300`.
- **Category Grid:** `grid grid-cols-1 md:grid-cols-3 gap-8`, each card with `aspect-[4/5]` image with 700ms scale hover.
- **Hero image bento:** `md:w-1/2 w-full grid grid-cols-2 gap-4 auto-rows-[200px]`.

### 5.3 Personalization Lab (`/create/[sessionId]`) — Stitch: `personalization_lab_meaning`, `personalization_lab_style_mobile`
- **Breadcrumb Progress:** `Input → Interpretation → Style Selection` shown as `font-label-caps text-label-caps text-on-surface-variant` with chevron dividers.
- **Section Title:** `font-headline-md text-headline-md text-primary`.
- **Interpretation Cards (Radio):** Full-height cards with `border border-outline-variant rounded-lg p-8`, selected state `border-primary bg-surface-container-highest`.
- **Recommended Badge:** Absolute-positioned `bg-primary text-on-primary` pill on top of card.
- **Kanji Display:** Rendered using `Noto Sans JP` / `Noto Serif JP` with `font-display-lg` sizing.
- **Cultural Meaning section:** Labelled with `font-label-caps text-label-caps` header + `border-b border-surface-variant`, body in `font-body-md text-on-surface-variant`.
- **Action Buttons:** `Back` uses `border border-outline text-primary hover:bg-surface-container-high`. `Continue` uses `bg-primary text-on-primary hover:bg-tertiary-container`.
- **Sticky CTA bar:** Live price breakdown (Artwork + Personalization + Product Blank) + `bg-primary text-on-primary` checkout button.

### 5.4 Creator Studio Dashboard (`/studio`) — Stitch: `creator_studio_dashboard`
- **Page Header:** `font-display-lg text-display-lg` title (desktop), `font-display-lg-mobile` (mobile).
- **Upload CTA:** `bg-primary text-on-primary px-6 py-3` with Upload icon.
- **Metrics Bento Grid:** `grid grid-cols-1 md:grid-cols-3 gap-gutter`.
  - Quota Card: `bg-surface-container-lowest border border-surface-variant p-8`, progress bar `bg-primary`, label `font-label-caps text-label-caps`.
  - Earnings Card: `col-span-2`, features a low-opacity watermark image background at `opacity-20 grayscale`.
  - Metric value: `font-display-lg text-display-lg`.
- **Design Table:** Section with `font-headline-sm text-headline-sm` sub-headers and card rows for each design.

### 5.5 Checkout / License Snapshot (`/checkout`) — Stitch: `checkout_license_snapshot`
- Same color system and layout tokens.
- Displays the immutable license grant: version number, license tier, permissions snapshot.
- Semantic calligraphy breakdown using `Noto Serif JP`.

---

## 6. UI AGENT RULES (Binding Instructions)

When building or updating any Next.js page, the Agent MUST:

1. **Color Tokens Only:** Reference colors using the token names (`text-primary`, `bg-background`, `border-surface-variant`, etc.) matching the Stitch config exactly. **Never** use arbitrary hex values like `text-[#B3261E]` inline — map them to tokens.
2. **Typography Pairs:** Always use `font-{token} text-{token}` class pairs together (e.g. `font-display-lg text-display-lg`). Never use raw `text-4xl` or `font-bold` alone.
3. **Icons:** Use `lucide-react` icons exclusively in React components.
4. **No Custom CSS blocks** except the `texture-overlay` rule. All styling via Tailwind utility classes.
5. **Responsive Integrity:** Every screen must include `sm:`, `md:`, and `lg:` responsive variants for layout.
6. **Spacing Tokens:** Use `px-margin-mobile md:px-margin-desktop`, `max-w-container-max`, `py-section-gap`, and `gap-gutter` for all layout scaffolding.
7. **Flat Design:** No drop-shadows on cards. Use `border border-surface-variant` or `border border-outline-variant` for card elevation. Never `shadow-lg` on content cards.
8. **No dark mode overrides** in new code — the canonical design is light-mode only. `darkMode: "class"` is configured in Stitch but no dark variant classes should be added to components unless explicitly designed.