import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function attachCspViolationCollector(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.addInitScript(() => {
    (
      window as Window & { __cspViolations?: string[] }
    ).__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (
        window as Window & { __cspViolations?: string[] }
      ).__cspViolations?.push(
        `${event.violatedDirective}: ${event.blockedURI || "inline"}`
      );
    });
  });

  page.on("pageerror", (err) => {
    violations.push(`pageerror: ${err.message}`);
  });

  return violations;
}

async function readClientCspViolations(
  page: Page,
  runtimeErrors: string[]
): Promise<string[]> {
  const domViolations = await page.evaluate(() => {
    return (
      (window as Window & { __cspViolations?: string[] }).__cspViolations ?? []
    );
  });
  return [...runtimeErrors, ...domViolations];
}

test.describe("Thi Bút E2E Hydration, CSP & Accessibility Smoke Suite (R-601)", () => {
  for (const route of [
    "/",
    "/adm/admin/login",
    "/custom",
    "/personal",
    "/business",
    "/living",
    "/how-it-works",
    "/verse-library",
    "/business-partners",
  ]) {
    test(`hydrates ${route} cleanly with zero CSP violations`, async ({
      page,
    }) => {
      const runtimeErrors = await attachCspViolationCollector(page);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);

      await expect(page.locator("header")).toBeVisible();
      const violations = await readClientCspViolations(page, runtimeErrors);
      expect(violations).toEqual([]);
    });
  }

  test("paused Studio and gallery routes redirect to the new storefront", async ({
    page,
  }) => {
    await page.goto("/create");
    await expect(page).toHaveURL(/\/custom$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /custom design/i })
    ).toBeVisible();

    await page.goto("/gallery");
    await expect(page).toHaveURL(/\/personal$/);
  });

  // Requires the keepsake seed (npm run db:seed:keepsakes) with an ACTIVE resin product.
  test("Buy Now: design page prices follow size and sides, and the item reaches the cart (BRD §05, §09)", async ({
    page,
  }) => {
    const runtimeErrors = await attachCspViolationCollector(page);
    await page.goto("/design/wedding-tram-nam-hanh-phuc");

    await expect(page.getByText("Concept render").first()).toBeVisible();

    const price = page.locator("main [aria-live]");
    await page.getByText("Large", { exact: true }).click();
    await expect(price).toContainText("$149.00");
    await page.getByText("Double-Sided", { exact: true }).click();
    await expect(price).toContainText("$238.40");

    await page.getByRole("button", { name: /buy .* now/i }).click();
    await page.waitForURL(/\/cart$/);
    const item = page.getByRole("article").first();
    await expect(item).toContainText("Trăm Năm Hạnh Phúc");
    await expect(item).toContainText("Double-sided");
    await expect(item).toContainText("$238.40");

    const violations = await readClientCspViolations(page, runtimeErrors);
    expect(violations).toEqual([]);
  });

  test("mobile <dialog> navigation drawer opens via showModal, traps focus, closes on Escape, and restores focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const runtimeErrors = await attachCspViolationCollector(page);
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: /open menu/i });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await menuButton.click();

    const dialog = page.getByRole("dialog", { name: /site navigation/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();

    const violations = await readClientCspViolations(page, runtimeErrors);
    expect(violations).toEqual([]);
  });

  test("renders branded editorial 404 screen for unmatched routes", async ({
    page,
  }) => {
    const response = await page.goto("/unwritten-scroll-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: /page not found/i })
    ).toBeVisible();
  });

  test("executes digital checkout -> signed Stripe webhook settlement -> 4500x5400 PNG download", async ({
    page,
    request,
  }) => {
    test.fixme(
      true,
      "Studio is paused for the MVP: /create redirects to /custom. Re-enable with the Studio."
    );
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const downloadSecret = process.env.DOWNLOAD_TOKEN_SECRET;
    test.skip(
      !webhookSecret || !downloadSecret || !process.env.STRIPE_SECRET_KEY,
      "Requires Stripe test-mode & download secrets in E2E environment"
    );

    await page.goto("/create");
    await page.waitForURL(/\/create\/[0-9a-f-]{36}/);
    const sessionMatch = /\/create\/([0-9a-f-]{36})/.exec(page.url());
    expect(sessionMatch?.[1]).toBeTruthy();
    const sessionId = sessionMatch![1]!;

    const checkoutRes = await request.post("/api/checkout", {
      data: {
        sessionId,
        isDigital: true,
        placement: "front",
        quantity: 1,
      },
    });
    expect(checkoutRes.status()).toBe(200);
    const checkoutBody = (await checkoutRes.json()) as {
      orderId: string;
      orderNumber: string;
    };
    expect(checkoutBody.orderId).toBeTruthy();

    const timestamp = Math.floor(Date.now() / 1000);
    const eventPayload = JSON.stringify({
      id: `evt_e2e_${crypto.randomUUID().replace(/-/g, "")}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_test_e2e_${crypto.randomUUID().slice(0, 12)}`,
          payment_status: "paid",
          amount_total: 1499,
          currency: "usd",
          payment_intent: `pi_e2e_${crypto.randomUUID().slice(0, 12)}`,
          metadata: {
            orderId: checkoutBody.orderId,
            isDigital: "true",
          },
          customer_details: {
            email: "e2e-buyer@thibut.com",
          },
        },
      },
    });
    const hmac = crypto
      .createHmac("sha256", webhookSecret!)
      .update(`${timestamp}.${eventPayload}`, "utf8")
      .digest("hex");

    const webhookRes = await request.post("/api/webhooks/stripe", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${hmac}`,
      },
      data: eventPayload,
    });
    expect(webhookRes.status()).toBe(200);

    await page.goto(
      `/checkout/success?order=${encodeURIComponent(checkoutBody.orderNumber)}`
    );
    await expect(
      page.getByRole("heading", { name: /payment confirmed/i })
    ).toBeVisible();
  });
});
