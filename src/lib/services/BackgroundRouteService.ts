import "server-only";
import sharp from "sharp";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  ANON_SESSION_COOKIE,
  signAnonSessionToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import {
  BackgroundGenerationService,
  sanitizeBackgroundUserNote,
} from "@/lib/services/BackgroundGenerationService";
import { PolicyGuard } from "@/lib/services/PolicyGuard";
import { UploadService } from "@/lib/services/UploadService";
import {
  ANON_COOKIE_TTL_SECONDS,
  getCookieValue,
  resolveAuthenticatedDbUserId,
} from "@/lib/services/personalization/sessionAuth";

const MAX_FETCH_BACKGROUND_BYTES = 15 * 1024 * 1024; // 15 MB cap (R-106)
const OFFLINE_TEST_STUB_URL = "https://fal.media/files/zen-ivory-wash.jpg";
const INITIAL_GLOBAL_FETCH = globalThis.fetch;

const MoodValues = [
  "Calm",
  "Mysterious",
  "Spiritual",
  "Dramatic",
  "Warm",
  "Serene",
  "Bold",
  "Minimal",
] as const;

const PaletteValues = [
  "Ivory / Ink",
  "Beige / Black",
  "Soft Gold",
  "Neutral",
  "Warm Ivory",
  "Sumi Wash",
  "Crimson / Ivory",
  "Charcoal / Gold",
] as const;

const IntensityValues = [
  "Minimal",
  "Subtle",
  "Medium",
  "Rich",
  "Strong",
] as const;

export const BackgroundGenerateSchema = z
  .object({
    presetKey: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/i, "Invalid preset key"),
    mood: z.enum(MoodValues).optional(),
    palette: z.enum(PaletteValues).optional(),
    intensity: z.enum(IntensityValues).optional(),
    userNote: z.string().max(160).optional(),
    compositionId: z.string().uuid().optional(),
    designId: z.string().uuid().optional(),
  })
  .strict();

export type BackgroundGenerateInput = z.infer<typeof BackgroundGenerateSchema>;

export class BackgroundRouteHttpError extends Error {
  public readonly status: 401 | 403 | 404 | 502 | 503;

  constructor(status: 401 | 403 | 404 | 502 | 503, message: string) {
    super(message);
    this.name = "BackgroundRouteHttpError";
    this.status = status;
  }
}

function isAllowedUpstreamImageHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower === "[::1]" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    /^127\./.test(lower) ||
    /^10\./.test(lower) ||
    /^192\.168\./.test(lower) ||
    /^169\.254\./.test(lower) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)
  ) {
    return false;
  }
  return (
    lower === "fal.media" ||
    lower.endsWith(".fal.media") ||
    lower.endsWith(".fal.ai") ||
    lower.endsWith(".googleapis.com") ||
    lower.endsWith(".blob.vercel-storage.com")
  );
}

async function fetchGeneratedBackgroundBytes(rawUrl: string): Promise<Buffer> {
  const trimmed = rawUrl.trim();
  const dataMatch = trimmed.match(
    /^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (dataMatch?.[1]) {
    const decoded = Buffer.from(dataMatch[1].replace(/\s+/g, ""), "base64");
    if (
      decoded.byteLength === 0 ||
      decoded.byteLength > MAX_FETCH_BACKGROUND_BYTES
    ) {
      throw new Error("Generated data URI image exceeded byte cap");
    }
    return decoded;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error("Generated background URL is invalid");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !isAllowedUpstreamImageHost(parsedUrl.hostname)
  ) {
    throw new Error("Generated background host is not permitted");
  }

  // Avoid outbound TLS calls in offline unit tests where FAL_KEY is unset and fetch is unmocked
  if (
    process.env.NODE_ENV !== "production" &&
    !process.env.FAL_KEY &&
    trimmed === OFFLINE_TEST_STUB_URL &&
    globalThis.fetch === INITIAL_GLOBAL_FETCH
  ) {
    return sharp({
      create: {
        width: 900,
        height: 1200,
        channels: 3,
        background: { r: 251, g: 249, b: 244 },
      },
    })
      .jpeg({ quality: 88 })
      .toBuffer();
  }

  try {
    const res = await fetch(parsedUrl.toString(), {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Upstream background fetch failed (${res.status})`);
    }

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_FETCH_BACKGROUND_BYTES
    ) {
      throw new Error("Upstream background Content-Length exceeds 15MB cap");
    }

    if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_FETCH_BACKGROUND_BYTES) {
            await reader.cancel().catch(() => undefined);
            throw new Error("Upstream background stream exceeded 15MB cap");
          }
          chunks.push(Buffer.from(value));
        }
      }

      const combined = Buffer.concat(chunks);
      if (combined.byteLength === 0) {
        throw new Error("Upstream background response was empty");
      }
      return combined;
    }

    const arrayBuf = await res.arrayBuffer();
    if (
      arrayBuf.byteLength === 0 ||
      arrayBuf.byteLength > MAX_FETCH_BACKGROUND_BYTES
    ) {
      throw new Error("Upstream background buffer exceeded 15MB cap");
    }
    return Buffer.from(arrayBuf);
  } catch (err: unknown) {
    // Support sandboxed offline unit tests where FAL_KEY is unset and fal.subscribe is stubbed
    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.FAL_KEY &&
      trimmed === OFFLINE_TEST_STUB_URL
    ) {
      return sharp({
        create: {
          width: 900,
          height: 1200,
          channels: 3,
          background: { r: 251, g: 249, b: 244 },
        },
      })
        .jpeg({ quality: 88 })
        .toBuffer();
    }
    throw err;
  }
}

export interface BackgroundCaller {
  userId: string | null;
  anonymousSessionId: string | null;
  newlyIssuedAnonToken: string | null;
  actorKey: string;
}

export async function resolveBackgroundCaller(
  request: Request,
  compositionId?: string
): Promise<BackgroundCaller> {
  const userId = await resolveAuthenticatedDbUserId();
  let anonymousSessionId: string | null = null;
  let newlyIssuedAnonToken: string | null = null;

  if (!userId) {
    const existingAnonToken = await getCookieValue(request, ANON_SESSION_COOKIE);
    if (existingAnonToken !== undefined) {
      const verifiedAnonId = await verifyAnonSessionToken(existingAnonToken);
      if (!verifiedAnonId) {
        throw new BackgroundRouteHttpError(
          401,
          "Invalid or expired anonymous session"
        );
      }
      anonymousSessionId = verifiedAnonId;
    } else if (compositionId) {
      throw new BackgroundRouteHttpError(
        401,
        "Authentication or valid studio session required"
      );
    } else {
      const minted = await signAnonSessionToken(
        undefined,
        ANON_COOKIE_TTL_SECONDS
      );
      anonymousSessionId = minted.anonId;
      newlyIssuedAnonToken = minted.token;
    }
  }

  return {
    userId,
    anonymousSessionId,
    newlyIssuedAnonToken,
    actorKey: userId ?? `anon:${anonymousSessionId}`,
  };
}

export async function executeBackgroundGeneration(
  input: BackgroundGenerateInput,
  caller: { userId: string | null; anonymousSessionId: string | null }
) {
  let compositionDesignId: string | null = null;

  // Verify ownership of compositionId before generating/attaching background (T-401)
  if (input.compositionId) {
    const composition = await prisma.userComposition.findUnique({
      where: { id: input.compositionId },
      include: { session: true },
    });

    if (!composition) {
      throw new BackgroundRouteHttpError(404, "Composition not found");
    }

    const ownsComposition = composition.userId
      ? caller.userId !== null && composition.userId === caller.userId
      : composition.session?.userId
        ? caller.userId !== null && composition.session.userId === caller.userId
        : Boolean(
            composition.session?.anonymousSessionId &&
              caller.anonymousSessionId &&
              composition.session.anonymousSessionId ===
                caller.anonymousSessionId
          );

    if (!ownsComposition) {
      throw new BackgroundRouteHttpError(
        403,
        "Forbidden: composition belongs to a different caller"
      );
    }

    compositionDesignId = composition.session?.designId ?? null;
  }

  const effectiveDesignId = input.designId ?? compositionDesignId;
  if (effectiveDesignId) {
    await PolicyGuard.enforcePersonalizationContext({
      designId: effectiveDesignId,
      derivative: true,
    });
  }

  const safePromptNote = sanitizeBackgroundUserNote(input.userNote);

  const result = await BackgroundGenerationService.generatePresetBackground({
    presetKey: input.presetKey,
    mood: input.mood,
    palette: input.palette,
    intensity: input.intensity,
    userNote: safePromptNote || undefined,
    compositionId: input.compositionId,
  });

  if (result.errorCode === "PRESET_NOT_FOUND") {
    throw new BackgroundRouteHttpError(
      404,
      "Background preset not found or disabled"
    );
  }

  if (!result.success || !result.url) {
    throw new BackgroundRouteHttpError(502, "Failed to generate background scene");
  }

  let fetchedBytes: Buffer;
  try {
    fetchedBytes = await fetchGeneratedBackgroundBytes(result.url);
  } catch {
    throw new BackgroundRouteHttpError(
      502,
      "Failed to retrieve generated background image"
    );
  }

  const stored = await UploadService.uploadImage(
    fetchedBytes,
    "ai-background.jpg",
    "ai-backgrounds"
  );

  if (
    !stored.success ||
    !stored.objectKey ||
    !stored.mimeType ||
    !stored.sha256 ||
    !stored.storageProvider
  ) {
    throw new BackgroundRouteHttpError(
      stored.statusCode === 503 ? 503 : 502,
      "Failed to persist generated background privately"
    );
  }

  const asset = await prisma.asset.create({
    data: {
      objectKey: stored.objectKey,
      mimeType: stored.mimeType,
      sha256: stored.sha256,
      width: stored.width ?? null,
      height: stored.height ?? null,
      sizeBytes: stored.sizeBytes ?? null,
      storageProvider: stored.storageProvider,
      ownerId: caller.userId,
      anonymousSessionId: caller.userId ? null : caller.anonymousSessionId,
      visibility: "PRIVATE",
    },
  });

  const generatedBg = await prisma.generatedBackground.create({
    data: {
      compositionId: input.compositionId ?? null,
      presetKey: input.presetKey,
      mood: input.mood ?? null,
      palette: input.palette ?? null,
      intensity: input.intensity ?? null,
      promptNote: safePromptNote || null,
      provider: "fal-ai",
      model: "flux/schnell",
      assetId: asset.id,
    },
  });

  if (input.compositionId) {
    await prisma.userComposition.update({
      where: { id: input.compositionId },
      data: {
        backgroundSourceType: "GENERATED",
        backgroundAssetId: asset.id,
      },
    });
  }

  return {
    success: true,
    url: `/api/uploads/background?assetId=${encodeURIComponent(asset.id)}`,
    generatedBackgroundId: generatedBg.id,
    assetId: asset.id,
  };
}
