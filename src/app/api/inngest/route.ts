/**
 * INNGEST HTTP ROUTE HANDLER
 * Serves the Inngest dev server and webhook endpoint.
 * 
 * In development: connects to local Inngest dev server (npx inngest-cli@latest dev)
 * In production:  receives signed events from Inngest cloud
 */
import { serve } from "inngest/next";
import { inngest, personalizationPipeline, processOrderFulfillment } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [personalizationPipeline, processOrderFulfillment],
});
