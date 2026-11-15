"use server";

/**
 * Pings the IndexNow API (Bing/Yandex) to notify them of a content change.
 * Requires an INDEXNOW_KEY environment variable.
 * You must also host the key as a .txt file at the root of your domain.
 * Example: if INDEXNOW_KEY=1234567890abcdef, host 1234567890abcdef.txt
 */
export async function pingIndexNow(urlPath: string) {
  try {
    const key = process.env.INDEXNOW_KEY;
    if (!key) {
      console.warn("[IndexNow] Skipping ping: INDEXNOW_KEY is not defined in environment variables.");
      return;
    }

    const host = "thibut.com";
    const fullUrl = `https://${host}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;

    const payload = {
      host: host,
      key: key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: [fullUrl],
    };

    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 202 || res.status === 200) {
      console.log(`[IndexNow] Successfully pinged Bing/IndexNow for ${fullUrl}`);
    } else {
      console.error(`[IndexNow] Failed to ping. Status: ${res.status}`);
    }
  } catch (error) {
    console.error(`[IndexNow] Error pinging IndexNow:`, error);
  }
}
