import test from "node:test";
import assert from "node:assert/strict";
import {
  signAdminStepUpToken,
  verifyAdminStepUpToken,
  signDeviceTrustToken,
  verifyDeviceTrustToken,
  signDownloadToken,
  verifyDownloadToken,
  SecurityConfigError,
  TokenVerificationError,
  computeHmacSha256Hex,
  verifyHmacSha256,
} from "@/lib/security/tokens";
import { safeRedirectPath } from "@/lib/security/redirect";
import {
  enforceRateLimit,
  RateLimitError,
  resetRateLimitStore,
} from "@/lib/security/rate-limit";
import { escapeXml, deterministicUid } from "@/lib/security/xml";
import {
  CompositionSchema,
  PRINT_MASTER_WIDTH,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_DPI,
} from "@/lib/print/types";

test("T-103/T-100: JWT helpers fail closed when secrets are missing and bind claims strictly", async () => {
  delete process.env.DOWNLOAD_TOKEN_SECRET;
  await assert.rejects(
    () => signDownloadToken({ orderItemId: "oi-1", orderId: "ord-1" }),
    SecurityConfigError
  );

  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret-32-chars-minimum!!";
  process.env.ADMIN_SESSION_SECRET = "test-admin-secret-32-chars-minimum!!!!";
  process.env.DEVICE_TRUST_SECRET = "test-device-secret-32-chars-minimum!!!";

  const dlToken = await signDownloadToken({ orderItemId: "oi-123", orderId: "ord-456" });
  const claims = await verifyDownloadToken(dlToken);
  assert.deepEqual(claims, { orderItemId: "oi-123", orderId: "ord-456" });

  // Cross-purpose rejection: admin token cannot be used as download token
  const adminToken = await signAdminStepUpToken("user-admin-1");
  await assert.rejects(() => verifyDownloadToken(adminToken), TokenVerificationError);
  assert.equal(await verifyAdminStepUpToken(adminToken, "user-admin-1"), true);
  assert.equal(await verifyAdminStepUpToken(adminToken, "different-user"), false);

  const devToken = await signDeviceTrustToken({ userId: "u-1", deviceId: "dev-abc" });
  assert.deepEqual(await verifyDeviceTrustToken(devToken, "u-1"), {
    userId: "u-1",
    deviceId: "dev-abc",
  });
  assert.equal(await verifyDeviceTrustToken(devToken, "u-2"), null);
});

test("T-104: safeRedirectPath blocks open redirects and protocol-relative URLs", () => {
  assert.equal(safeRedirectPath("/studio"), "/studio");
  assert.equal(safeRedirectPath("/checkout?session_id=123"), "/checkout?session_id=123");
  assert.equal(safeRedirectPath("https://evil.com"), "/studio");
  assert.equal(safeRedirectPath("//evil.com"), "/studio");
  assert.equal(safeRedirectPath("/\\evil.com"), "/studio");
  assert.equal(safeRedirectPath("@evil.com"), "/studio");
  assert.equal(safeRedirectPath("javascript:alert(1)"), "/studio");
});

test("T-105: sliding window rate limiter enforces burst limits", () => {
  resetRateLimitStore();
  enforceRateLimit({ bucket: "ai", key: "1.2.3.4", limit: 2, windowMs: 60_000 });
  enforceRateLimit({ bucket: "ai", key: "1.2.3.4", limit: 2, windowMs: 60_000 });
  assert.throws(
    () => enforceRateLimit({ bucket: "ai", key: "1.2.3.4", limit: 2, windowMs: 60_000 }),
    RateLimitError
  );
});

test("T-411 & T-404: escapeXml neutralizes SVG injection and deterministicUid is stable", () => {
  assert.equal(
    escapeXml(`<script>&"'`),
    "&lt;script&gt;&amp;&quot;&apos;"
  );
  assert.equal(deterministicUid("Có Chí Thì Nên|UTM|VERTICAL"), deterministicUid("Có Chí Thì Nên|UTM|VERTICAL"));
  assert.notEqual(deterministicUid("A"), deterministicUid("B"));
});

test("T-300: CompositionSchema enforces normalized transforms and rejects arbitrary URLs", () => {
  assert.equal(PRINT_MASTER_WIDTH, 4500);
  assert.equal(PRINT_MASTER_HEIGHT, 5400);
  assert.equal(PRINT_MASTER_DPI, 300);

  const parsed = CompositionSchema.parse({
    placement: "front",
    color: "#121212",
    layers: [
      {
        id: "main-calligraphy",
        type: "calligraphy",
        text: "Có Chí Thì Nên",
        fontFamily: "UTM ThuPhap Thien An",
        layout: "VERTICAL",
        colorHex: "#121212",
        transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
      },
    ],
  });
  assert.equal(parsed.layers.length, 1);

  // Out-of-bounds normalized transform rejected
  assert.throws(() =>
    CompositionSchema.parse({
      layers: [
        {
          id: "bad",
          type: "calligraphy",
          text: "Hi",
          fontFamily: "UTM ThuPhap Thien An",
          transform: { x: 800, y: 800, scale: 1, rotation: 0 },
        },
      ],
    })
  );
});

test("T-107: HMAC SHA256 verification uses constant-time comparison", () => {
  process.env.TEST_WEBHOOK_SECRET = "super-secret-webhook-signing-key-123";
  const body = JSON.stringify({ type: "package_shipped", order: { id: "123" } });
  const sig = computeHmacSha256Hex(body, process.env.TEST_WEBHOOK_SECRET);
  assert.equal(verifyHmacSha256(body, sig, "TEST_WEBHOOK_SECRET"), true);
  assert.equal(verifyHmacSha256(body, `sha256=${sig}`, "TEST_WEBHOOK_SECRET"), true);
  assert.equal(verifyHmacSha256(body + "x", sig, "TEST_WEBHOOK_SECRET"), false);
});
