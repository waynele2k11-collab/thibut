---
description: 
---

Workflows (Automated Multi-Step Execution)
Workflows are structured scripts or multi-step execution playbooks that the agent can execute automatically when triggered by specific commands or events.

Switch to the Workflows tab and create the following key workflows:

🚀 workflow-build-component
Trigger: When asked to build or update a page/component.

Steps:

Read @DESIGN.md for styling guidelines.

Parse local HTML/CSS Stitch assets or mockup templates.

Generate the Next.js TypeScript (.tsx) component with Tailwind utility classes.

Launch the embedded browser and verify responsiveness on Mobile and Desktop viewports.

🎨 workflow-test-print-engine
Trigger: When testing the Personalization Lab name/meaning generator.

Steps:

Input a sample name (e.g., "Wayne", "David").

Call the dictionary/meaning engine logic in lib/meaning.ts.

Render the output to @napi-rs/canvas or satori.

Verify that the generated image meets the 300 DPI Printful layout constraints and output a preview in the agent browser.

🚢 workflow-pre-deploy-check
Trigger: Before pushing to GitHub or deploying to Vercel.

Steps:

Run npm run lint and tsc --noEmit to check for TypeScript errors.

Verify all API routes in app/api/ handle error responses correctly.

Ensure no hardcoded secret keys exist in the codebase.

Run the local build script npm run build.