---
name: Zen-Modern Administrative & Curation System
colors:
  surface: '#fbf9f4'
  surface-dim: '#dbdad5'
  surface-bright: '#fbf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ee'
  surface-container: '#f0eee9'
  surface-container-high: '#eae8e3'
  surface-container-highest: '#e4e2dd'
  on-surface: '#1b1c19'
  on-surface-variant: '#46474a'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f1ec'
  outline: '#76777b'
  outline-variant: '#c7c6ca'
  surface-tint: '#5f5e5f'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1c'
  on-primary-container: '#858384'
  inverse-primary: '#c8c6c7'
  secondary: '#b71032'
  on-secondary: '#ffffff'
  secondary-container: '#da3148'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b19'
  on-tertiary-container: '#868380'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e3'
  primary-fixed-dim: '#c8c6c7'
  on-primary-fixed: '#1b1b1c'
  on-primary-fixed-variant: '#474647'
  secondary-fixed: '#ffdad9'
  secondary-fixed-dim: '#ffb3b4'
  on-secondary-fixed: '#40000a'
  on-secondary-fixed-variant: '#920023'
  tertiary-fixed: '#e6e2de'
  tertiary-fixed-dim: '#cac6c2'
  on-tertiary-fixed: '#1c1b19'
  on-tertiary-fixed-variant: '#484644'
  background: '#fbf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
  stewardship-review: '#1a237e'
  stewardship-verified: '#2e7d32'
  stewardship-revision: '#c62828'
  data-grid-border: rgba(199, 198, 202, 0.3)
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  label-utility:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.05em
spacing:
  unit: 8px
  gutter: 16px
  margin-admin: 32px
  sidebar-width: 280px
  data-row-height: 48px
---

## Brand & Style
This extension of the design system adapts the "Zen-Modern" aesthetic for internal stewardship and high-stakes curation. The core philosophy remains rooted in **Minimalism** and the concept of *Ma* (negative space), but shifts from a consumer-facing gallery experience to a **Corporate / Modern** archival utility. 

The aesthetic is that of a "Digital Scriptorium"—a space where authority, clarity, and precision are paramount. While the consumer side feels like a scroll, the administrative side feels like a structured ledger. It maintains the tactile, archival quality of the original system while introducing "Stewardship" controls that signify the serious nature of authenticating and verifying cultural artifacts. The emotional response should be one of quiet focus, institutional trust, and scholarly rigor.

## Colors
The palette leverages the existing archival parchment and sumi-ink foundation but introduces a functional "Stewardship Status" spectrum for workflow management.

- **Parchment Background (#fbf9f4):** Retained as the primary canvas to ensure continuity with the public-facing brand.
- **Sumi Ink (#1a1a1b):** Used for primary typography and navigation to project institutional authority.
- **Stewardship Indigo (#1a237e):** Represents "Under Review." A deep, scholarly blue that signals active processing without the urgency of an error.
- **Stewardship Moss (#2e7d32):** Represents "Verified." A natural, grounded green that signals the successful completion of a workflow.
- **Stewardship Cinnabar (#c62828):** Represents "Revision Needed." A more urgent, earth-toned red used specifically for identifying required corrections.
- **Data-Grid Border:** A 30% opacity variant of the outline color creates a ghostly structural skeleton for complex data tables without cluttering the visual field.

## Typography
The system maintains the tension between the expressive **Playfair Display** and the functional **Inter**. 

In administrative workflows, use **Playfair Display** exclusively for page headers and high-level section titles to maintain the brand’s "Calligraphy" DNA. For all interactive elements, data grids, and forms, use **Inter**. A new `label-utility` level is introduced for dense data visualization, using bold weights and slight letter spacing to ensure readability at very small scales within status badges or column headers.

## Layout & Spacing
Administrative layouts shift from the "Gallery" fixed-grid to a **Fluid Grid** model to maximize the utility of desktop screens for data-heavy tasks.

- **The Admin Shell:** A fixed sidebar (280px) on the left provides authoritative navigation. The main content area expands to fill the remaining width.
- **Information Density:** While the consumer site uses aggressive vertical gaps (120px), the administrative interface uses a tighter 8px base unit. Vertical spacing between dashboard modules is reduced to 48px to keep relevant tools within the viewport.
- **Data Grids:** Use 16px gutters and 32px side margins within containers to ensure that even dense spreadsheets feel organized and intentional.

## Elevation & Depth
Elevation is handled through **Low-Contrast Outlines** rather than shadows, emphasizing the "flat paper" metaphor.

- **Data Partitioning:** Use the 30% opacity border-outline-variant to define cells and rows in curation tables. This provides enough structure to guide the eye without adding visual weight.
- **Floating Modals:** When a curation detail view is opened, use a solid 1px Sumi Ink border and a very subtle 5% black backdrop blur to lift the element, rather than a traditional drop shadow.
- **Tonal Tiers:** Use the Stone (#E5E5E5) color to distinguish the header and sidebar from the main parchment workspace, creating a clear "Control vs. Content" hierarchy.

## Shapes
The shape language remains strictly **Sharp (0px)**. All buttons, input fields, badges, and status indicators must be perfectly rectangular. This architectural rigidity reinforces the sense of a professional, archival environment where order and structure prevail over consumer softness.

## Components
- **Stewardship Badges:** Rectangular, sharp-edged chips using the Status colors. Text should be white and set in `label-utility`.
- **Administrative Buttons:** Primary actions use the solid Sumi Ink style. Destructive or urgent "Revision" actions use the Stewardship Cinnabar with white text.
- **Data Tables:** Rows should be 48px high with the 30% outline-variant horizontal divider. Hover states on rows should transition the background to `surface-container-low` (#f5f3ee).
- **Navigation:** The left sidebar uses Sumi Ink background with parchment-colored typography. Active states are indicated by a small, 4px wide vertical "brush stroke" (bar) in the Red Seal color on the far left of the menu item.
- **Filter Bars:** Simple, 1px border frames using the outline-variant. Icons should be minimal, geometric line-art.
- **Curation Input Fields:** Full-frame 1px borders. When focused, the border weight does not increase; instead, it changes from `outline-variant` to `primary` (Sumi Ink).