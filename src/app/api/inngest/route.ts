/**
 * INNGEST HTTP ROUTE HANDLER
 * Serves the Inngest dev server and signed cloud webhook endpoint.
 */
import { serve } from "inngest/next";
import {
  generatePersonalizationJob,
  inngest,
  processOrderFulfillment,
} from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generatePersonalizationJob, processOrderFulfillment],
});
