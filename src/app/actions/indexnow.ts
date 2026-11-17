"use server";

import { z } from "zod";
import { requireAdmin } from "@/utils/admin/auth";
import { safeRedirectPath } from "@/lib/security/redirect";

const UrlPathSchema = z.string().min(1).max(512);

/**
 * Admin-only Server Action that pings the IndexNow API (Bing/Yandex) to notify of a content change.
 */
export async function pingIndexNow(urlPath: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const validatedPath = safeRedirectPath(UrlPathSchema.parse(urlPath), "/");

  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { ok: false };
  }

  const host = "thibut.com";
  const fullUrl = `https://${host}${validatedPath}`;

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: [fullUrl],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    return { ok: res.ok || res.status === 202 };
  } catch (error) {
    console.error("[IndexNow] Error pinging IndexNow:", error);
    return { ok: false };
  }
}
