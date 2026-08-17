---
trigger: always_on
---

Rules (Guiding Agent Behavior & Code Quality)
Rules act as persistent system prompts for the Agent across all tasks. Use them to enforce tech stack constraints, coding standards, and architectural patterns.

Click + Workspace (for thibut.com specific) or + Global and add these rules:

🛠️ Tech Stack & Standards
Framework: Next.js (App Router), TypeScript, Tailwind CSS, lucide-react.

Architecture: Maintain strict separation of concerns. Keep UI components inside components/, API routes in app/api/, and core domain logic inside lib/.

State Management: Use Zustand or React Server Actions for state management. Avoid unnecessary client-side state.

🎨 Design System & UI Matching
Stitch Alignment: Always read and strictly follow @DESIGN.md in the root directory for color palettes, typography, spacing, and UI hierarchy exported from Google Stitch.

Styling: Use pure Tailwind CSS utility classes. Never use inline styles or raw CSS files unless required for print canvas rendering.

🖼️ Personalization & High-Res Image Engine
Print-Ready Resolution: When generating print files for Printful via canvas or Satori, always enforce 4500x5400 px at 300 DPI (PNG with transparent background).

Font Handling: Ensure custom calligraphy and dictionary fonts are pre-loaded server-side before rendering SVG/Canvas exports.

📦 API & External Integrations
Printful API Safety: Never expose PRINTFUL_API_KEY or sensitive credentials on the client side. All Printful order creations and product syncs must run via Next.js Server Actions or Serverless API routes.

Type Safety: Always validate incoming webhooks and API payloads (from Printful or Payment Gateways) using zod.