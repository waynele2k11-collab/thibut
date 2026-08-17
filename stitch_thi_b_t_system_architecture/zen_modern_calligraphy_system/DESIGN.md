---
name: Zen-Modern Calligraphy System
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
  tertiary-container: '#1a1c1c'
  on-tertiary-container: '#838484'
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
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fbf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
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
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 24px
  section-gap: 120px
---

## Brand & Style
The design system embodies the "Zen-Modern" aesthetic, a fusion of traditional East Asian artistry and contemporary premium e-commerce. The philosophy is guided by *Ma*—the intentional use of negative space to create focus, clarity, and a sense of luxury. 

The visual style is **Minimalist** with **Tactile** accents. It avoids digital noise in favor of high-contrast compositions and architectural precision. Every element should feel intentional, like a singular brush stroke on a fresh sheet of washi paper. The emotional response is one of calm, professional expertise, and deep cultural appreciation.

## Colors
The palette is rooted in the *Sumi-e* tradition. 
- **Deep Sumi Ink (#1A1A1B):** Used for primary branding, navigation, and high-impact headings. It represents the weight and permanence of the brush.
- **Red Seal (#C41E3A):** Reserved for "The Seal"—critical calls to action, price points, and branding accents. Use sparingly to maintain its impact as a signature of authenticity.
- **Paper White (#F9F7F2):** The primary canvas. This warm, off-white prevents the sterile feel of pure white and suggests organic textures.
- **Stone (#E5E5E5):** Used for surface-level containers, dividers, and secondary backgrounds to provide subtle structure without breaking the minimal flow.

## Typography
The typography contrasts the expressive, high-contrast strokes of **Playfair Display** with the systematic clarity of **Inter**. 

- **Headlines:** Should be set with tight tracking to emphasize the serif's elegance. Display sizes use the weight of the ink to command attention.
- **Body:** Prioritize legibility. Use generous line heights (1.5–1.6) to allow the text to "breathe" on the page.
- **Labels:** Use uppercase for small labels and metadata to create an architectural, structured feel that contrasts with the fluid headlines.

## Layout & Spacing
This design system utilizes a **Fixed Grid** with an emphasis on oversized margins. 

- **The Power of Ma:** Vertical spacing between major sections should be aggressive (120px+). This creates a gallery-like experience where each product or piece of content is given total focus.
- **Desktop:** 12-column grid with a maximum width of 1280px. Use asymmetrical layouts (e.g., content spanning columns 2-10) to mimic the non-linear composition of traditional scrolls.
- **Mobile:** 4-column grid with 24px side margins. Simplify complex compositions into a single vertical flow, maintaining whitespace between elements to prevent clutter.

## Elevation & Depth
Depth is conveyed through **Tonal Layering** and **Subtle Textures** rather than heavy shadows.

- **Surface Tiers:** Use the Stone (#E5E5E5) color to create subtle separation for toolbars or secondary panels.
- **Low-Contrast Outlines:** Use thin (1px) borders in a slightly darker grey or ink-transparency for card boundaries and input fields.
- **Physical Metaphor:** Shadows, if used, must be ultra-diffused and faint, suggesting an object resting directly on paper rather than floating.
- **Texture:** Apply a subtle grain or "rice paper" overlay to the Paper White background to add a tactile, high-end feel.

## Shapes
The shape language is **Sharp (0px)** and architectural. 

Rectangular forms dominate the UI, reflecting the edges of paper, ink stones, and wooden frames. The only exceptions are the "Seal" elements (e.g., specific circular branding marks or floating action buttons) which may use a circular or organic "pressed ink" shape to stand out against the rigid grid.

## Components
- **Buttons:** The primary button should be solid Sumi Ink (#1A1A1B) with white text. It should feel like a definitive stroke. Secondary buttons use a 1px border. "The Seal" button is Cinnabar (#C41E3A) and used exclusively for the final conversion step (e.g., "Place Order").
- **Inputs:** Minimalist bottom-border only or very thin 1px full-frame. Focus states should transition the border to Sumi Ink.
- **Cards:** No shadows. Use thin borders or simply the Stone (#E5E5E5) background to define the area. Ensure internal padding is generous (minimum 32px).
- **Chips:** Small, rectangular tags with a light grey background and uppercase Inter labels.
- **Calligraphy Previews:** Use a "Light-box" style container that maximizes the image size, framed by wide Paper White margins.
- **Dividers:** Use very thin horizontal lines that don't span the full width of the container, mimicking the start and end of a brush movement.