/**
 * INNGEST HTTP ROUTE HANDLER
 * Serves the Inngest dev server and signed cloud webhook endpoint.
 */
import { serve } from "inngest/next";
import { validateServerEnv } from "@/lib/env";
import { inngest, inngestFunctions } from "@/lib/inngest";

export const runtime = "nodejs";
export const maxDuration = 60;

validateServerEnv();

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
