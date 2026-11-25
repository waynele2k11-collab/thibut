"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { generateInstantSvgUri } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";
import { parseDecimalDollarsToMinor } from "@/lib/money";
import {
  enforceDistributedRateLimit,
  RateLimitError,
} from "@/lib/security/rate-limit";
import {
  DEVICE_TRUST_COOKIE,
  verifyDeviceTrustToken,
} from "@/lib/security/tokens";
import { stripe } from "@/lib/stripe";
import { DEFAULT_INK_HEX } from "@/lib/studio/inkPalette";
import { getSessionUser } from "@/lib/auth/session";

const OnboardCreatorSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(40)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug may only contain lowercase letters, numbers, and hyphens"
      ),
    bio: z.string().trim().max(280).optional(),
  })
  .strict();

const CreateDesignListingSchema = z
  .object({
    title: z.string().trim().min(2).max(80),
    description: z.string().trim().max(400).optional(),
    phraseText: z.string().trim().min(1).max(160),
    fontFamily: z.string().trim().min(1).max(120),
    licenseDollars: z.string().trim().min(1).max(12),
    allowName: z.boolean(),
    allowQuote: z.boolean(),
    allowTranslation: z.boolean(),
    allowCalligraphy: z.boolean(),
    allowAIRestyle: z.boolean(),
  })
  .strict();

const UpdateDesignPolicySchema = z
  .object({
    designId: z.string().uuid(),
    allowName: z.boolean(),
    allowQuote: z.boolean(),
    allowTranslation: z.boolean(),
    allowCalligraphy: z.boolean(),
    allowAIRestyle: z.boolean(),
  })
  .strict();

export interface CreatorActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

async function requireTrustedCreatorCaller(): Promise<
  | {
      authorized: true;
      userId: string;
      email: string | null;
    }
  | {
      authorized: false;
      error: string;
    }
> {
  try {
    const user = await getSessionUser();

    if (!user?.id) {
      return { authorized: false, error: "Authentication required" };
    }

    const cookieStore = await cookies();
    const rawDeviceToken = cookieStore.get(DEVICE_TRUST_COOKIE)?.value;
    const trusted = await verifyDeviceTrustToken(rawDeviceToken, user.id);
    if (!trusted) {
      return {
        authorized: false,
        error: "Device verification required for Creator Studio actions",
      };
    }

    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? null,
        phoneNumber: user.phone ?? null,
      },
      update: {
        ...(user.email ? { email: user.email } : {}),
      },
    });

    return {
      authorized: true,
      userId: user.id,
      email: user.email ?? null,
    };
  } catch {
    return { authorized: false, error: "Unable to verify creator session" };
  }
}

function slugifyDesignTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base || "calligraphy-work"}-${suffix}`;
}

export async function onboardCreatorProfileAction(
  rawInput: unknown
): Promise<CreatorActionResult> {
  const caller = await requireTrustedCreatorCaller();
  if (!caller.authorized) {
    return { ok: false, error: caller.error };
  }

  const parsed = OnboardCreatorSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid creator profile details",
    };
  }

  try {
    await enforceDistributedRateLimit({
      bucket: "creator-onboard",
      key: `user:${caller.userId}`,
      limit: 10,
      windowMs: 10 * 60_000,
    });

    const existingMine = await prisma.creatorProfile.findUnique({
      where: { userId: caller.userId },
    });
    if (existingMine) {
      return { ok: true };
    }

    const slugTaken = await prisma.creatorProfile.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (slugTaken) {
      return {
        ok: false,
        error: "That studio handle is already taken. Please choose another.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.creatorProfile.create({
        data: {
          userId: caller.userId,
          displayName: parsed.data.displayName,
          slug: parsed.data.slug,
          bio: parsed.data.bio || null,
          status: "ACTIVE",
        },
      });

      const creatorRole = await tx.role.upsert({
        where: { code: "CREATOR" },
        update: {},
        create: { code: "CREATOR", name: "Creator" },
      });

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: caller.userId,
            roleId: creatorRole.id,
          },
        },
        update: {},
        create: {
          userId: caller.userId,
          roleId: creatorRole.id,
        },
      });
    });

    revalidatePath("/studio");
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: "Too many requests. Please wait a moment." };
    }
    console.error("[onboardCreatorProfileAction] Error:", err);
    return { ok: false, error: "Failed to create Creator Studio profile" };
  }
}

export async function createCreatorDesignListingAction(
  rawInput: unknown
): Promise<CreatorActionResult> {
  const caller = await requireTrustedCreatorCaller();
  if (!caller.authorized) {
    return { ok: false, error: caller.error };
  }

  const parsed = CreateDesignListingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid listing fields",
    };
  }

  let licenseMinor: bigint;
  try {
    licenseMinor = parseDecimalDollarsToMinor(parsed.data.licenseDollars);
  } catch {
    return {
      ok: false,
      error: "Enter a valid USD royalty amount (e.g. 4.99)",
    };
  }

  if (licenseMinor < 100n || licenseMinor > 50_000n) {
    return {
      ok: false,
      error: "Artist license royalty must be between $1.00 and $500.00",
    };
  }

  try {
    await enforceDistributedRateLimit({
      bucket: "creator-publish",
      key: `user:${caller.userId}`,
      limit: 15,
      windowMs: 10 * 60_000,
    });

    // Enforce TB-CALLI-008 commercial + print licensing gate on selected typeface
    await FontRegistryService.resolveFontBuffer(parsed.data.fontFamily);

    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId: caller.userId },
      include: {
        subscription: { include: { plan: true } },
        designs: { where: { status: "PUBLISHED" }, select: { id: true } },
      },
    });

    if (!creatorProfile || creatorProfile.status !== "ACTIVE") {
      return {
        ok: false,
        error: "Complete Creator Onboarding before publishing listings",
      };
    }

    const quotaLimit = creatorProfile.subscription?.plan.activeDesignLimit ?? 25;
    if (creatorProfile.designs.length >= quotaLimit) {
      return {
        ok: false,
        error: `Listing quota reached (${quotaLimit} active designs). Pause an existing listing or upgrade your plan.`,
      };
    }

    const previewDataUri = generateInstantSvgUri({
      text: parsed.data.phraseText,
      fontFamily: parsed.data.fontFamily,
      layout: "VERTICAL",
      inkColor: DEFAULT_INK_HEX,
      hasSeal: true,
    });
    const sha256 = crypto
      .createHash("sha256")
      .update(previewDataUri)
      .digest("hex");
    const slug = slugifyDesignTitle(parsed.data.title);

    await prisma.$transaction(async (tx) => {
      const previewAsset = await tx.asset.create({
        data: {
          objectKey: previewDataUri,
          mimeType: "image/svg+xml",
          sha256,
          storageProvider: "inline-svg",
          ownerId: caller.userId,
          visibility: "PUBLIC",
        },
      });

      const design = await tx.design.create({
        data: {
          creatorId: creatorProfile.id,
          slug,
          title: parsed.data.title,
          description: parsed.data.description || null,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
      });

      const version = await tx.designVersion.create({
        data: {
          designId: design.id,
          versionNumber: 1,
        },
      });

      await tx.designVersionAsset.create({
        data: {
          designVersionId: version.id,
          assetId: previewAsset.id,
          type: "PREVIEW",
        },
      });

      // INV-010: allowModelTraining is strictly forced to false
      await tx.designPolicyVersion.create({
        data: {
          designId: design.id,
          versionNumber: 1,
          allowName: parsed.data.allowName,
          allowQuote: parsed.data.allowQuote,
          allowTranslation: parsed.data.allowTranslation,
          allowCalligraphy: parsed.data.allowCalligraphy,
          allowAIRestyle: parsed.data.allowAIRestyle,
          allowBackgroundRemoval: true,
          allowRecolor: true,
          allowCrop: false,
          allowDerivative: true,
          allowCommercialUse: false,
          allowModelTraining: false,
        },
      });

      await tx.licenseOffer.createMany({
        data: [
          {
            designId: design.id,
            type: "PERSONAL_PRODUCT",
            priceMinor: licenseMinor,
            currency: "USD",
            active: true,
            allowDigitalDownload: false,
            allowResale: false,
            allowCommercialUse: false,
            termsVersion: 1,
          },
          {
            designId: design.id,
            type: "PERSONAL_DIGITAL",
            priceMinor: licenseMinor,
            currency: "USD",
            active: true,
            allowDigitalDownload: true,
            allowResale: false,
            allowCommercialUse: false,
            termsVersion: 1,
          },
        ],
      });
    });

    revalidatePath("/studio");
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: "Too many publish requests. Try again shortly." };
    }
    console.error("[createCreatorDesignListingAction] Error:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to publish calligraphy listing",
    };
  }
}

export async function updateDesignPolicyAction(
  rawInput: unknown
): Promise<CreatorActionResult> {
  const caller = await requireTrustedCreatorCaller();
  if (!caller.authorized) {
    return { ok: false, error: caller.error };
  }

  const parsed = UpdateDesignPolicySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Invalid policy update request" };
  }

  try {
    await enforceDistributedRateLimit({
      bucket: "creator-policy-update",
      key: `user:${caller.userId}`,
      limit: 30,
      windowMs: 10 * 60_000,
    });

    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId: caller.userId },
    });
    if (!creatorProfile) {
      return { ok: false, error: "Creator profile not found" };
    }

    const design = await prisma.design.findUnique({
      where: { id: parsed.data.designId },
      include: {
        policyVersions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!design || design.creatorId !== creatorProfile.id) {
      return { ok: false, error: "Forbidden: you do not own this design" };
    }

    const latestVersionNumber = design.policyVersions[0]?.versionNumber ?? 0;

    // Immutable append-only DesignPolicyVersion snapshot (SYSTEM_ARCHITECTURE §15, INV-010, INV-012)
    await prisma.designPolicyVersion.create({
      data: {
        designId: design.id,
        versionNumber: latestVersionNumber + 1,
        allowName: parsed.data.allowName,
        allowQuote: parsed.data.allowQuote,
        allowTranslation: parsed.data.allowTranslation,
        allowCalligraphy: parsed.data.allowCalligraphy,
        allowAIRestyle: parsed.data.allowAIRestyle,
        allowBackgroundRemoval: true,
        allowRecolor: true,
        allowCrop: false,
        allowDerivative: true,
        allowCommercialUse: false,
        allowModelTraining: false,
      },
    });

    revalidatePath("/studio");
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: "Too many policy updates. Please wait." };
    }
    console.error("[updateDesignPolicyAction] Error:", err);
    return { ok: false, error: "Failed to save new policy version" };
  }
}

export async function connectCreatorStripeAction(
  rawInput?: undefined
): Promise<CreatorActionResult> {
  const caller = await requireTrustedCreatorCaller();
  if (!caller.authorized) {
    return { ok: false, error: caller.error };
  }

  const parsedEmpty = z.undefined().safeParse(rawInput);
  if (!parsedEmpty.success) {
    return { ok: false, error: "Invalid request" };
  }

  try {
    await enforceDistributedRateLimit({
      bucket: "creator-stripe-connect",
      key: `user:${caller.userId}`,
      limit: 8,
      windowMs: 10 * 60_000,
    });

    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId: caller.userId },
    });
    if (!creatorProfile) {
      return { ok: false, error: "Complete Creator Onboarding first" };
    }

    const rawStripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (
      !rawStripeKey ||
      rawStripeKey === "sk_test_replace_me" ||
      rawStripeKey === "sk_test_placeholder"
    ) {
      return {
        ok: false,
        error:
          "Stripe Connect secret key is not configured in this environment yet.",
      };
    }

    let stripeAccountId = creatorProfile.stripeAccountId;
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        ...(caller.email ? { email: caller.email } : {}),
        metadata: {
          creatorProfileId: creatorProfile.id,
          userId: caller.userId,
        },
      });
      stripeAccountId = account.id;
      await prisma.creatorProfile.update({
        where: { id: creatorProfile.id },
        data: { stripeAccountId },
      });
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/studio`,
      return_url: `${appUrl}/studio`,
      type: "account_onboarding",
    });

    revalidatePath("/studio");
    return { ok: true, url: accountLink.url };
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: "Too many Stripe requests. Please wait." };
    }
    console.error("[connectCreatorStripeAction] Error:", err);
    return {
      ok: false,
      error:
        "Unable to initialize Stripe Connect onboarding link. Verify Stripe Connect is enabled on your Stripe account.",
    };
  }
}
