import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as nodeModule from "node:module";
import sharp from "sharp";
import { authSeamStubUrl, isAuthSeamSpecifier } from "./helpers/auth-seam-stub";

interface ResolveContext {
  conditions: string[];
  importAttributes: Record<string, string>;
  parentURL?: string;
}

interface ResolveResult {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}

type NextResolveFn = (
  specifier: string,
  context: ResolveContext
) => ResolveResult;

interface ModuleHooksApi {
  registerHooks: (hooks: {
    resolve?: (
      specifier: string,
      context: ResolveContext,
      nextResolve: NextResolveFn
    ) => ResolveResult;
  }) => void;
}

interface MockCookieEntry {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

interface MockUserRow {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  name: string | null;
  status: string;
}

interface MockCreatorProfileRow {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  status: string;
}

interface MockDesignRow {
  id: string;
  creatorId: string;
  slug: string;
  title: string;
  description?: string | null;
  status: string;
  visibility: string;
}

interface MockDesignVersionRow {
  id: string;
  designId: string;
  versionNumber: number;
}

interface MockDesignPolicyVersionRow {
  id: string;
  designId: string;
  versionNumber: number;
  allowName: boolean;
  allowQuote: boolean;
  allowTranslation: boolean;
  allowCalligraphy: boolean;
  allowRecolor: boolean;
  allowCrop: boolean;
  allowBackgroundRemoval: boolean;
  allowAIRestyle: boolean;
  allowDerivative: boolean;
  allowCommercialUse: boolean;
  allowModelTraining: boolean;
}

interface MockPersonalizationSessionRow {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  designId: string | null;
  designVersionId: string | null;
  mode: string;
  inputText: string;
  culturalStyle: string;
  status: string;
  compositionJson: unknown;
}

interface MockUserCompositionRow {
  id: string;
  userId: string | null;
  sessionId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  mode: string;
}

interface MockUserCompositionLayerRow {
  id: string;
  compositionId: string;
  type: string;
  assetId: string | null;
  text: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  color: string | null;
  opacity: number;
  zIndex: number;
}

interface MockPersonalizationVersionRow {
  id: string;
  sessionId: string;
  designVersionId: string | null;
  versionNumber: number;
  inputSnapshot: unknown;
  interpretationSnapshot: unknown;
  styleSnapshot: unknown;
  printAssetId: string | null;
}

interface MockCatalogProductRow {
  id: string;
  name: string;
  status: string;
  defaultMarkupMinor: bigint;
  /** Only "IN_HOUSE" products can be put in a cart or checked out (BRD v1.0 §10). */
  fulfillmentMode: string;
}

interface MockProviderVariantRow {
  id: string;
  catalogVariantId: string;
  costMinor: bigint;
  currency: string;
  active: boolean;
}

interface MockCatalogVariantRow {
  id: string;
  productId: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  baseRetailMinor: bigint;
  active: boolean;
}

interface MockLicenseOfferRow {
  id: string;
  designId: string;
  type: string;
  priceMinor: bigint;
  currency: string;
  termsVersion: number;
  allowCommercialUse: boolean;
  allowDigitalDownload: boolean;
  allowResale: boolean;
  active: boolean;
}

interface MockCartRow {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  currency: string;
  status: string;
  updatedAt: Date;
}

interface MockCartItemRow {
  id: string;
  cartId: string;
  creatorId: string;
  designId: string;
  designVersionId: string;
  personalizationVersionId: string | null;
  catalogVariantId: string;
  licenseOfferId: string | null;
  placement: string;
  quantity: number;
  unitArtworkMinor: bigint;
  unitPersonalizationMinor: bigint;
  unitProductMinor: bigint;
  createdAt: Date;
}

interface MockOrderRow {
  id: string;
  orderNumber: string;
  buyerId: string | null;
  anonymousSessionId: string | null;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalMinor: bigint;
  discountMinor: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  stripeCheckoutSessionId: string | null;
}

interface MockOrderItemRow {
  id: string;
  orderId: string;
  creatorId: string;
  designId: string;
  designVersionId: string;
  galleryItemId: string | null;
  licenseOfferId: string | null;
  personalizationVersionId: string | null;
  catalogProductId: string | null;
  catalogVariantId: string | null;
  quantity: number;
  placement: string;
  artworkRevenueMinor: bigint;
  personalizationRevenueMinor: bigint;
  productRevenueMinor: bigint;
  fulfillmentCostMinor: bigint;
  creatorRoyaltyMinor: bigint;
  platformRevenueMinor: bigint;
  totalMinor: bigint;
}

interface MockOrderItemSnapshotRow {
  id: string;
  orderItemId: string;
  designTitle: string;
  creatorName: string;
  productName: string | null;
  variantName: string | null;
  color: string | null;
  size: string | null;
  licenseTermsJson: unknown;
  personalizationJson?: unknown;
  printPlacementJson?: unknown;
  pricingJson: unknown;
}

interface MockPriceQuoteRow {
  id: string;
  cartId: string | null;
  orderId: string | null;
  currency: string;
  subtotalMinor: bigint;
  artworkMinor: bigint;
  personalizationMinor: bigint;
  productMinor: bigint;
  fulfillmentCostMinor: bigint;
  creatorRoyaltyMinor: bigint;
  platformMinor: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  discountMinor: bigint;
  totalMinor: bigint;
  expiresAt: Date;
}

interface MockGalleryItemRow {
  id: string;
  slug: string;
  title: string;
  productName: string;
  defaultColor: string | null;
  productImageUrl: string | null;
  listedPriceMinor: bigint;
  currency: string;
  published: boolean;
  purchasable: boolean;
  requiresSize: boolean;
}

interface StripeCreateSessionCapture {
  mode?: string;
  line_items?: Array<{
    price_data?: {
      currency?: string;
      unit_amount?: number;
      product_data?: { name?: string; description?: string };
    };
    quantity?: number;
  }>;
  shipping_address_collection?: { allowed_countries?: string[] };
  success_url?: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
}

const state = {
  cookies: new Map<string, MockCookieEntry>(),
  supabaseUser: null as { id: string; email?: string; phone?: string } | null,
  users: new Map<string, MockUserRow>(),
  creators: new Map<string, MockCreatorProfileRow>(),
  designs: new Map<string, MockDesignRow>(),
  designVersions: new Map<string, MockDesignVersionRow>(),
  designPolicies: new Map<string, MockDesignPolicyVersionRow>(),
  sessions: new Map<string, MockPersonalizationSessionRow>(),
  userCompositions: new Map<string, MockUserCompositionRow>(),
  userCompositionLayers: new Map<string, MockUserCompositionLayerRow>(),
  personalizationVersions: new Map<string, MockPersonalizationVersionRow>(),
  products: new Map<string, MockCatalogProductRow>(),
  variants: new Map<string, MockCatalogVariantRow>(),
  providerVariants: new Map<string, MockProviderVariantRow>(),
  licenseOffers: new Map<string, MockLicenseOfferRow>(),
  carts: new Map<string, MockCartRow>(),
  cartItems: new Map<string, MockCartItemRow>(),
  orders: new Map<string, MockOrderRow>(),
  orderItems: new Map<string, MockOrderItemRow>(),
  orderItemSnapshots: new Map<string, MockOrderItemSnapshotRow>(),
  priceQuotes: new Map<string, MockPriceQuoteRow>(),
  galleryItems: new Map<string, MockGalleryItemRow>(),
  stripeCalls: [] as StripeCreateSessionCapture[],
};

function resetState(): void {
  state.cookies.clear();
  state.supabaseUser = null;
  state.users.clear();
  state.creators.clear();
  state.designs.clear();
  state.designVersions.clear();
  state.designPolicies.clear();
  state.sessions.clear();
  state.userCompositions.clear();
  state.userCompositionLayers.clear();
  state.personalizationVersions.clear();
  state.products.clear();
  state.variants.clear();
  state.providerVariants.clear();
  state.licenseOffers.clear();
  state.carts.clear();
  state.cartItems.clear();
  state.orders.clear();
  state.orderItems.clear();
  state.orderItemSnapshots.clear();
  state.priceQuotes.clear();
  state.galleryItems.clear();
  state.stripeCalls = [];
}

function seedCatalog(): {
  productId: string;
  activeVariantId: string;
  inactiveVariantId: string;
} {
  const productId = "prod-heavy-tee";
  const activeVariantId = "var-tee-black-l";
  const inactiveVariantId = "var-tee-retired";

  state.products.set(productId, {
    id: productId,
    name: "Premium Heavyweight Tee",
    status: "ACTIVE",
    defaultMarkupMinor: 0n,
    fulfillmentMode: "IN_HOUSE",
  });

  state.variants.set(activeVariantId, {
    id: activeVariantId,
    productId,
    sku: "TB-TEE-BLK-L",
    size: "L",
    color: "Sumi Black",
    colorHex: "#121212",
    baseRetailMinor: 2999n,
    active: true,
  });

  state.providerVariants.set("pv-tee-black-l", {
    id: "pv-tee-black-l",
    catalogVariantId: activeVariantId,
    costMinor: 1295n,
    currency: "USD",
    active: true,
  });

  state.variants.set(inactiveVariantId, {
    id: inactiveVariantId,
    productId,
    sku: "TB-TEE-OLD",
    size: "S",
    color: "Bone",
    colorHex: "#F6F1E7",
    baseRetailMinor: 2999n,
    active: false,
  });

  return { productId, activeVariantId, inactiveVariantId };
}

function hydrateVariant(row: MockCatalogVariantRow | undefined) {
  if (!row) return null;
  const product = state.products.get(row.productId) ?? {
    id: row.productId,
    name: "Unknown Product",
    status: "INACTIVE",
    defaultMarkupMinor: 0n,
    fulfillmentMode: "IN_HOUSE",
  };
  const providerVariants = Array.from(state.providerVariants.values()).filter(
    (pv) => pv.catalogVariantId === row.id
  );
  return {
    ...row,
    product,
    providerVariants,
    mockups: [],
  };
}

function hydrateDesign(row: MockDesignRow | undefined) {
  if (!row) return null;
  const creator = state.creators.get(row.creatorId) ?? {
    id: row.creatorId,
    userId: "u-studio",
    slug: "thibut-studio",
    displayName: "Thi Bút Studio",
    status: "ACTIVE",
  };
  const versions = Array.from(state.designVersions.values())
    .filter((v) => v.designId === row.id)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const policyVersions = Array.from(state.designPolicies.values())
    .filter((p) => p.designId === row.id)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  return {
    ...row,
    creator,
    versions,
    policyVersions,
  };
}

const mockPrisma: Record<string, unknown> = {
  async $transaction<T>(fn: (tx: Record<string, unknown>) => Promise<T>): Promise<T> {
    return fn(mockPrisma);
  },
  user: {
    async findUnique(args: { where: { id?: string; email?: string } }) {
      if (args.where.id) return state.users.get(args.where.id) ?? null;
      if (args.where.email) {
        for (const u of state.users.values()) {
          if (u.email === args.where.email) return u;
        }
      }
      return null;
    },
    async create(args: {
      data: { id?: string; email?: string | null; name?: string | null; status?: string };
    }) {
      const id = args.data.id ?? crypto.randomUUID();
      const rec: MockUserRow = {
        id,
        email: args.data.email ?? null,
        phoneNumber: null,
        name: args.data.name ?? null,
        status: args.data.status ?? "ACTIVE",
      };
      state.users.set(id, rec);
      return rec;
    },
    async upsert(args: {
      where: { id: string };
      create: { id: string; email: string | null; phoneNumber: string | null };
      update: { email?: string; phoneNumber?: string };
    }) {
      const existing = state.users.get(args.where.id);
      if (existing) {
        if (args.update.email !== undefined) existing.email = args.update.email;
        if (args.update.phoneNumber !== undefined) {
          existing.phoneNumber = args.update.phoneNumber;
        }
        return existing;
      }
      const created: MockUserRow = {
        id: args.create.id,
        email: args.create.email,
        phoneNumber: args.create.phoneNumber,
        name: null,
        status: "ACTIVE",
      };
      state.users.set(created.id, created);
      return created;
    },
  },
  creatorProfile: {
    async findUnique(args: { where: { id?: string; slug?: string } }) {
      if (args.where.id) return state.creators.get(args.where.id) ?? null;
      if (args.where.slug) {
        for (const c of state.creators.values()) {
          if (c.slug === args.where.slug) return c;
        }
      }
      return null;
    },
    async create(args: {
      data: { userId: string; slug: string; displayName: string; status: string };
    }) {
      const id = crypto.randomUUID();
      const rec: MockCreatorProfileRow = { id, ...args.data };
      state.creators.set(id, rec);
      return rec;
    },
  },
  design: {
    async findUnique(args: { where: { id?: string; slug?: string } }) {
      if (args.where.id) return hydrateDesign(state.designs.get(args.where.id));
      if (args.where.slug) {
        for (const d of state.designs.values()) {
          if (d.slug === args.where.slug) return hydrateDesign(d);
        }
      }
      return null;
    },
    async create(args: { data: Omit<MockDesignRow, "id"> }) {
      const id = crypto.randomUUID();
      const rec: MockDesignRow = { id, ...args.data };
      state.designs.set(id, rec);
      return rec;
    },
  },
  designVersion: {
    async create(args: { data: { designId: string; versionNumber: number } }) {
      const id = crypto.randomUUID();
      const rec: MockDesignVersionRow = { id, ...args.data };
      state.designVersions.set(id, rec);
      return rec;
    },
  },
  designPolicyVersion: {
    async findFirst(args: {
      where: { designId: string };
      orderBy?: { versionNumber: "asc" | "desc" };
    }) {
      const list = Array.from(state.designPolicies.values())
        .filter((p) => p.designId === args.where.designId)
        .sort((a, b) =>
          args.orderBy?.versionNumber === "asc"
            ? a.versionNumber - b.versionNumber
            : b.versionNumber - a.versionNumber
        );
      return list[0] ?? null;
    },
    async create(args: {
      data: {
        designId: string;
        versionNumber: number;
        allowName: boolean;
        allowQuote: boolean;
        allowTranslation: boolean;
        allowCalligraphy: boolean;
        allowRecolor?: boolean;
        allowCrop?: boolean;
        allowBackgroundRemoval?: boolean;
        allowAIRestyle?: boolean;
        allowDerivative?: boolean;
        allowCommercialUse: boolean;
        allowModelTraining: boolean;
      };
    }) {
      const id = crypto.randomUUID();
      const rec: MockDesignPolicyVersionRow = {
        id,
        ...args.data,
        allowRecolor: args.data.allowRecolor ?? false,
        allowCrop: args.data.allowCrop ?? false,
        allowBackgroundRemoval: args.data.allowBackgroundRemoval ?? true,
        allowAIRestyle: args.data.allowAIRestyle ?? false,
        allowDerivative: args.data.allowDerivative ?? false,
      };
      state.designPolicies.set(id, rec);
      return rec;
    },
  },
  personalizationSession: {
    async findUnique(args: { where: { id: string } }) {
      const found = state.sessions.get(args.where.id);
      if (!found) return null;
      return {
        ...found,
        interpretations: [],
        design: found.designId
          ? hydrateDesign(state.designs.get(found.designId))
          : null,
      };
    },
    async create(args: {
      data: {
        id?: string;
        userId?: string | null;
        anonymousSessionId?: string | null;
        designId?: string | null;
        designVersionId?: string | null;
        mode: string;
        inputText: string;
        culturalStyle: string;
        status: string;
        compositionJson?: unknown;
      };
    }) {
      const id = args.data.id ?? crypto.randomUUID();
      const rec: MockPersonalizationSessionRow = {
        id,
        userId: args.data.userId ?? null,
        anonymousSessionId: args.data.anonymousSessionId ?? null,
        designId: args.data.designId ?? null,
        designVersionId: args.data.designVersionId ?? null,
        mode: args.data.mode,
        inputText: args.data.inputText,
        culturalStyle: args.data.culturalStyle,
        status: args.data.status,
        compositionJson: args.data.compositionJson ?? null,
      };
      state.sessions.set(id, rec);
      return { ...rec, interpretations: [] };
    },
    async update(args: {
      where: { id: string };
      data: Partial<MockPersonalizationSessionRow>;
    }) {
      const rec = state.sessions.get(args.where.id);
      if (!rec) throw new Error("Session not found");
      Object.assign(rec, args.data);
      return { ...rec, interpretations: [] };
    },
  },
  userComposition: {
    async findFirst(args: { where: { sessionId?: string } }) {
      for (const comp of state.userCompositions.values()) {
        if (comp.sessionId === args.where.sessionId) return comp;
      }
      return null;
    },
    async create(args: { data: Omit<MockUserCompositionRow, "id"> }) {
      const id = crypto.randomUUID();
      const rec: MockUserCompositionRow = { id, ...args.data };
      state.userCompositions.set(id, rec);
      return rec;
    },
    async update(args: {
      where: { id: string };
      data: Partial<MockUserCompositionRow>;
    }) {
      const rec = state.userCompositions.get(args.where.id);
      if (!rec) throw new Error("UserComposition not found");
      Object.assign(rec, args.data);
      return rec;
    },
  },
  userCompositionLayer: {
    async deleteMany(args: { where: { compositionId: string } }) {
      let count = 0;
      for (const [id, layer] of state.userCompositionLayers.entries()) {
        if (layer.compositionId === args.where.compositionId) {
          state.userCompositionLayers.delete(id);
          count += 1;
        }
      }
      return { count };
    },
    async create(args: { data: Omit<MockUserCompositionLayerRow, "id"> }) {
      const id = crypto.randomUUID();
      const rec: MockUserCompositionLayerRow = { id, ...args.data };
      state.userCompositionLayers.set(id, rec);
      return rec;
    },
  },
  personalizationVersion: {
    async findFirst(args: { where: { sessionId: string } }) {
      const list = Array.from(state.personalizationVersions.values())
        .filter((pv) => pv.sessionId === args.where.sessionId)
        .sort((a, b) => b.versionNumber - a.versionNumber);
      return list[0] ?? null;
    },
    async findUnique(args: { where: { id: string } }) {
      const pv = state.personalizationVersions.get(args.where.id);
      if (!pv) return null;
      const session = state.sessions.get(pv.sessionId);
      return {
        ...pv,
        printAsset: null,
        session: session ? { ...session, interpretations: [] } : null,
      };
    },
    async create(args: {
      data: {
        sessionId: string;
        designVersionId?: string | null;
        versionNumber: number;
        inputSnapshot: unknown;
        interpretationSnapshot: unknown;
        styleSnapshot: unknown;
        printAssetId?: string | null;
      };
    }) {
      const id = crypto.randomUUID();
      const rec: MockPersonalizationVersionRow = {
        id,
        sessionId: args.data.sessionId,
        designVersionId: args.data.designVersionId ?? null,
        versionNumber: args.data.versionNumber,
        inputSnapshot: args.data.inputSnapshot,
        interpretationSnapshot: args.data.interpretationSnapshot,
        styleSnapshot: args.data.styleSnapshot,
        printAssetId: args.data.printAssetId ?? null,
      };
      state.personalizationVersions.set(id, rec);
      return rec;
    },
  },
  catalogVariant: {
    async findUnique(args: { where: { id: string } }) {
      return hydrateVariant(state.variants.get(args.where.id));
    },
    async findFirst(args: {
      where: {
        active?: boolean;
        size?: string;
        product?: { name?: string; status?: string };
      };
    }) {
      for (const v of state.variants.values()) {
        if (args.where.active !== undefined && v.active !== args.where.active) {
          continue;
        }
        if (args.where.size !== undefined && v.size !== args.where.size) {
          continue;
        }
        const prod = state.products.get(v.productId);
        if (args.where.product?.name && prod?.name !== args.where.product.name) {
          continue;
        }
        if (
          args.where.product?.status &&
          prod?.status !== args.where.product.status
        ) {
          continue;
        }
        return hydrateVariant(v);
      }
      return null;
    },
  },
  licenseOffer: {
    async findUnique(args: { where: { id: string } }) {
      return state.licenseOffers.get(args.where.id) ?? null;
    },
  },
  cart: {
    async findUnique(args: { where: { id: string } }) {
      const cart = state.carts.get(args.where.id);
      if (!cart) return null;
      return hydrateCart(cart);
    },
    async findFirst(args: {
      where: {
        userId?: string;
        anonymousSessionId?: string | null;
        status?: string;
      };
    }) {
      const matches = Array.from(state.carts.values()).filter((c) => {
        if (args.where.status && c.status !== args.where.status) return false;
        if (args.where.userId !== undefined) {
          return c.userId === args.where.userId;
        }
        if (args.where.anonymousSessionId !== undefined) {
          return c.anonymousSessionId === args.where.anonymousSessionId;
        }
        return true;
      });
      matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return matches[0] ? hydrateCart(matches[0]) : null;
    },
    async create(args: {
      data: {
        userId: string | null;
        anonymousSessionId: string | null;
        currency: string;
        status: string;
      };
    }) {
      const id = crypto.randomUUID();
      const rec: MockCartRow = {
        id,
        ...args.data,
        updatedAt: new Date(),
      };
      state.carts.set(id, rec);
      return rec;
    },
    async update(args: {
      where: { id: string };
      data: Partial<MockCartRow>;
    }) {
      const rec = state.carts.get(args.where.id);
      if (!rec) throw new Error("Cart not found");
      Object.assign(rec, args.data, { updatedAt: new Date() });
      return rec;
    },
  },
  cartItem: {
    async create(args: { data: Omit<MockCartItemRow, "id" | "createdAt"> }) {
      const id = crypto.randomUUID();
      const rec: MockCartItemRow = {
        id,
        ...args.data,
        createdAt: new Date(),
      };
      state.cartItems.set(id, rec);
      return rec;
    },
    async findMany(args: { where: { cartId: string } }) {
      return Array.from(state.cartItems.values()).filter(
        (ci) => ci.cartId === args.where.cartId
      );
    },
    async findUnique(args: { where: { id: string } }) {
      const ci = state.cartItems.get(args.where.id);
      if (!ci) return null;
      const cart = state.carts.get(ci.cartId);
      if (!cart) return null;
      return { ...ci, cart };
    },
    async delete(args: { where: { id: string } }) {
      const ci = state.cartItems.get(args.where.id);
      state.cartItems.delete(args.where.id);
      return ci;
    },
  },
  order: {
    async create(args: {
      data: Omit<MockOrderRow, "id" | "stripeCheckoutSessionId"> & {
        stripeCheckoutSessionId?: string | null;
      };
    }) {
      const id = crypto.randomUUID();
      const rec: MockOrderRow = {
        id,
        ...args.data,
        stripeCheckoutSessionId: args.data.stripeCheckoutSessionId ?? null,
      };
      state.orders.set(id, rec);
      return rec;
    },
    async update(args: {
      where: { id: string };
      data: Partial<MockOrderRow>;
    }) {
      const rec = state.orders.get(args.where.id);
      if (!rec) throw new Error("Order not found");
      Object.assign(rec, args.data);
      return rec;
    },
  },
  orderItem: {
    async create(args: {
      data: Omit<MockOrderItemRow, "id" | "galleryItemId" | "licenseOfferId" | "personalizationVersionId" | "catalogProductId" | "catalogVariantId"> & {
        galleryItemId?: string | null;
        licenseOfferId?: string | null;
        personalizationVersionId?: string | null;
        catalogProductId?: string | null;
        catalogVariantId?: string | null;
      };
    }) {
      const id = crypto.randomUUID();
      const rec: MockOrderItemRow = {
        id,
        ...args.data,
        galleryItemId: args.data.galleryItemId ?? null,
        licenseOfferId: args.data.licenseOfferId ?? null,
        personalizationVersionId: args.data.personalizationVersionId ?? null,
        catalogProductId: args.data.catalogProductId ?? null,
        catalogVariantId: args.data.catalogVariantId ?? null,
      };
      state.orderItems.set(id, rec);
      return rec;
    },
    async findUnique(args: { where: { id: string } }) {
      const oi = state.orderItems.get(args.where.id);
      if (!oi) return null;
      const order = state.orders.get(oi.orderId) ?? null;
      const pv = oi.personalizationVersionId
        ? state.personalizationVersions.get(oi.personalizationVersionId) ?? null
        : null;
      return {
        ...oi,
        order,
        personalizationVersion: pv ? { ...pv, printAsset: null } : null,
      };
    },
  },
  orderItemSnapshot: {
    async create(args: { data: Omit<MockOrderItemSnapshotRow, "id"> }) {
      const id = crypto.randomUUID();
      const rec: MockOrderItemSnapshotRow = { id, ...args.data };
      state.orderItemSnapshots.set(id, rec);
      return rec;
    },
  },
  priceQuote: {
    async create(args: {
      data: Omit<MockPriceQuoteRow, "id" | "cartId" | "orderId"> & {
        cartId?: string | null;
        orderId?: string | null;
      };
    }) {
      const id = crypto.randomUUID();
      const rec: MockPriceQuoteRow = {
        id,
        ...args.data,
        cartId: args.data.cartId ?? null,
        orderId: args.data.orderId ?? null,
      };
      state.priceQuotes.set(id, rec);
      return rec;
    },
  },
  galleryItem: {
    async findUnique(args: { where: { id: string } }) {
      return state.galleryItems.get(args.where.id) ?? null;
    },
  },
};

function hydrateCart(cart: MockCartRow) {
  const items = Array.from(state.cartItems.values())
    .filter((ci) => ci.cartId === cart.id)
    .map((ci) => {
      const design = hydrateDesign(state.designs.get(ci.designId))!;
      const designVersion = state.designVersions.get(ci.designVersionId)!;
      const catalogVariant = hydrateVariant(
        state.variants.get(ci.catalogVariantId)
      )!;
      const licenseOffer = ci.licenseOfferId
        ? state.licenseOffers.get(ci.licenseOfferId) ?? null
        : null;
      const pv = ci.personalizationVersionId
        ? state.personalizationVersions.get(ci.personalizationVersionId) ?? null
        : null;
      const session = pv ? state.sessions.get(pv.sessionId) ?? null : null;

      return {
        ...ci,
        design,
        designVersion,
        catalogVariant,
        licenseOffer,
        personalizationVersion: pv
          ? {
              ...pv,
              session: session ? { ...session, interpretations: [] } : null,
            }
          : null,
      };
    });

  return {
    ...cart,
    items,
  };
}

declare global {
  var __tbWave2Hooks: {
    getCookiesStore: () => Promise<{
      get: (name: string) => { name: string; value: string } | undefined;
      set: (
        nameOrObj: string | { name: string; value: string },
        value?: string,
        options?: Record<string, unknown>
      ) => void;
      delete: (name: string) => void;
    }>;
    revalidatePath: (_path: string) => void;
    createSupabaseClient: () => Promise<{
      auth: {
        getUser: () => Promise<{
          data: { user: typeof state.supabaseUser };
          error: Error | null;
        }>;
      };
    }>;
    prisma: Record<string, unknown>;
    stripe: {
      checkout: {
        sessions: {
          create: (
            params: StripeCreateSessionCapture
          ) => Promise<{ id: string; url: string }>;
        };
      };
    };
  };
}

globalThis.__tbWave2Hooks = {
  async getCookiesStore() {
    return {
      get(name: string) {
        const entry = state.cookies.get(name);
        return entry ? { name: entry.name, value: entry.value } : undefined;
      },
      set(
        nameOrObj: string | { name: string; value: string },
        value?: string,
        options?: Record<string, unknown>
      ) {
        if (typeof nameOrObj === "string") {
          state.cookies.set(nameOrObj, {
            name: nameOrObj,
            value: value ?? "",
            options,
          });
        } else {
          state.cookies.set(nameOrObj.name, {
            name: nameOrObj.name,
            value: nameOrObj.value,
          });
        }
      },
      delete(name: string) {
        state.cookies.delete(name);
      },
    };
  },
  revalidatePath() {
    // no-op
  },
  async createSupabaseClient() {
    return {
      auth: {
        async getUser() {
          if (!state.supabaseUser) {
            return { data: { user: null }, error: new Error("Not signed in") };
          }
          return { data: { user: state.supabaseUser }, error: null };
        },
      },
    };
  },
  prisma: mockPrisma,
  stripe: {
    checkout: {
      sessions: {
        async create(params: StripeCreateSessionCapture) {
          state.stripeCalls.push(params);
          const sessionIdx = state.stripeCalls.length;
          return {
            id: `cs_test_wave2_${sessionIdx}`,
            url: `https://checkout.stripe.com/c/pay/cs_test_wave2_${sessionIdx}`,
          };
        },
      },
    },
  },
};

(nodeModule as unknown as ModuleHooksApi).registerHooks({
  resolve(
    specifier: string,
    context: ResolveContext,
    nextResolve: NextResolveFn
  ): ResolveResult {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (specifier === "next/headers") {
      return {
        url: "data:text/javascript,export const cookies = () => globalThis.__tbWave2Hooks.getCookiesStore();",
        shortCircuit: true,
      };
    }
    if (specifier === "next/cache") {
      return {
        url: "data:text/javascript,export const revalidatePath = (p) => globalThis.__tbWave2Hooks.revalidatePath(p);",
        shortCircuit: true,
      };
    }
    if (isAuthSeamSpecifier(specifier)) {
      return {
        url: authSeamStubUrl("__tbWave2Hooks"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma" || specifier.endsWith("/lib/prisma")) {
      return {
        url: "data:text/javascript,export default globalThis.__tbWave2Hooks.prisma;",
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/stripe" || specifier.endsWith("/lib/stripe")) {
      return {
        url: "data:text/javascript,export const STRIPE_CURRENCY = 'usd'; export const stripe = globalThis.__tbWave2Hooks.stripe;",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const {
  ANON_SESSION_COOKIE,
  signAnonSessionToken,
  signDownloadToken,
} = await import("@/lib/security/tokens");
const { CompositionSchema } = await import("@/lib/print/types");
const { DIGITAL_TOTAL_MINOR } = await import("@/lib/pricing/quote");
const {
  ensureStudioSessionAction,
  saveCompositionToSession,
} = await import("@/app/actions/composition");
const { GET: downloadGet } = await import("@/app/api/download/route");
const { POST: checkoutPost } = await import("@/app/api/checkout/route");
const { POST: galleryCheckoutPost } = await import(
  "@/app/api/checkout/gallery/route"
);
const {
  addToCartAction,
  getCartCountAction,
  removeFromCartAction,
} = await import("@/app/actions/cart");
const {
  generateInstantSvgString,
  generateInstantSvgUri,
} = await import("@/lib/calligraphy/ClientCalligraphyRenderer");

function sampleComposition(text = "Tâm An"): ReturnType<typeof CompositionSchema.parse> {
  return CompositionSchema.parse({
    version: 1,
    placement: "front",
    color: "#121212",
    transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
    layers: [
      {
        id: "layer-calligraphy-main",
        type: "calligraphy",
        text,
        fontFamily: "UTM Thư Pháp Thiên Ân",
        layout: "VERTICAL",
        colorHex: "#121212",
        zIndex: 10,
        opacity: 1,
        transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
      },
      {
        id: "layer-seal-chop",
        type: "seal",
        sealText: "印",
        fontFamily: "Ma Shan Zheng",
        colorHex: "#B71032",
        zIndex: 20,
        opacity: 0.92,
        transform: { x: 0.75, y: 0.72, scale: 0.25, rotation: 0 },
      },
    ],
  });
}

test("T-102: saveCompositionToSession enforces caller identity, session ownership, and CHECKED_OUT lock while syncing UserComposition layers", async () => {
  resetState();
  process.env.ANON_SESSION_SECRET = "wave2-anon-secret-minimum-32-chars!!";

  const comp = sampleComposition("Nhẫn");

  // 1. Rejects nil UUID and non-UUID sessionId
  await assert.rejects(() =>
    saveCompositionToSession("00000000-0000-0000-0000-000000000000", comp)
  );
  await assert.rejects(() => saveCompositionToSession("not-a-uuid", comp));

  // 2. Rejects unauthenticated caller without signed ANON_SESSION_COOKIE
  const unownedId = crypto.randomUUID();
  state.sessions.set(unownedId, {
    id: unownedId,
    userId: null,
    anonymousSessionId: "anon-owner-a",
    designId: null,
    designVersionId: null,
    mode: "QUOTE",
    inputText: "Initial",
    culturalStyle: "VIETNAMESE_THU_PHAP",
    status: "DRAFT",
    compositionJson: null,
  });

  await assert.rejects(
    () => saveCompositionToSession(unownedId, comp),
    /Unauthorized: missing caller identity/
  );

  // 3. Rejects cross-visitor hijacking (Visitor B cannot overwrite Visitor A's session)
  const { token: attackerToken } = await signAnonSessionToken("anon-attacker-b");
  state.cookies.set(ANON_SESSION_COOKIE, {
    name: ANON_SESSION_COOKIE,
    value: attackerToken,
  });

  await assert.rejects(
    () => saveCompositionToSession(unownedId, comp),
    /Forbidden: you do not own this personalization session/
  );

  // ensureStudioSessionAction also refuses to adopt Visitor A's sessionId, minting a fresh session for Visitor B
  const ensuredForAttacker = await ensureStudioSessionAction({
    sessionId: unownedId,
    inputText: "Fresh",
  });
  assert.equal(ensuredForAttacker.ok, true);
  assert.notEqual(ensuredForAttacker.sessionId, unownedId);

  // 4. Rightful owner (Visitor A) persists CompositionSchema + deterministic UserComposition + UserCompositionLayer rows
  const { token: ownerToken } = await signAnonSessionToken("anon-owner-a");
  state.cookies.set(ANON_SESSION_COOKIE, {
    name: ANON_SESSION_COOKIE,
    value: ownerToken,
  });

  const saved = await saveCompositionToSession(unownedId, comp);
  assert.equal(saved.ok, true);
  assert.equal(saved.sessionId, unownedId);

  const storedSession = state.sessions.get(unownedId);
  assert.equal(storedSession?.inputText, "Nhẫn");
  assert.ok(storedSession?.compositionJson);

  const layers = Array.from(state.userCompositionLayers.values()).filter(
    (l) => l.compositionId === saved.userCompositionId
  );
  assert.equal(layers.length, 2);
  assert.equal(layers[0].type, "THIBUT_ART");
  assert.equal(layers[0].text, "Nhẫn");
  assert.equal(layers[1].type, "TEXT");
  assert.equal(layers[1].text, "印");

  // 5. Once session is CHECKED_OUT, even the rightful owner is blocked from mutating it!
  storedSession!.status = "CHECKED_OUT";
  await assert.rejects(
    () => saveCompositionToSession(unownedId, sampleComposition("Tampered")),
    /locked after checkout/
  );
  assert.equal(state.sessions.get(unownedId)?.inputText, "Nhẫn");
});

test("T-103 & INV-003: /api/download fails closed, enforces PAID non-refunded order, and renders strictly from frozen PersonalizationVersion.styleSnapshot", async () => {
  resetState();
  process.env.ANON_SESSION_SECRET = "wave2-anon-secret-minimum-32-chars!!";
  process.env.DOWNLOAD_TOKEN_SECRET = "wave2-dedicated-download-secret-32!!";

  // 1. Missing token -> 400
  const missingRes = await downloadGet(
    new Request("http://localhost:3000/api/download")
  );
  assert.equal(missingRes.status, 400);

  // 2. Forged token & wrong-purpose token (anon session JWT) -> 401
  const forgedRes = await downloadGet(
    new Request("http://localhost:3000/api/download?token=forged.jwt.token")
  );
  assert.equal(forgedRes.status, 401);

  const { token: anonToken } = await signAnonSessionToken("anon-1");
  const wrongTokenTypeRes = await downloadGet(
    new Request(
      `http://localhost:3000/api/download?token=${encodeURIComponent(anonToken)}`
    )
  );
  assert.equal(wrongTokenTypeRes.status, 401);

  // Seed Order + PersonalizationSession + frozen PersonalizationVersion
  const sessionId = crypto.randomUUID();
  state.sessions.set(sessionId, {
    id: sessionId,
    userId: null,
    anonymousSessionId: "anon-1",
    designId: "d-1",
    designVersionId: "dv-1",
    mode: "QUOTE",
    inputText: "Poisoned Mutable Session Text",
    culturalStyle: "VIETNAMESE_THU_PHAP",
    status: "CHECKED_OUT",
    // Poison mutable session JSON so any accidental read from PersonalizationSession.compositionJson would crash Zod!
    compositionJson: { corrupted: true, layers: [] },
  });

  const frozenStyle = sampleComposition("Phúc");
  const pvId = crypto.randomUUID();
  state.personalizationVersions.set(pvId, {
    id: pvId,
    sessionId,
    designVersionId: "dv-1",
    versionNumber: 1,
    inputSnapshot: { text: "Phúc" },
    interpretationSnapshot: { text: "Phúc" },
    styleSnapshot: frozenStyle,
    printAssetId: null,
  });

  const orderId = crypto.randomUUID();
  const orderItemId = crypto.randomUUID();
  state.orders.set(orderId, {
    id: orderId,
    orderNumber: "TB-DOWNLOAD-001",
    buyerId: null,
    anonymousSessionId: "anon-1",
    currency: "USD",
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    fulfillmentStatus: "PENDING",
    subtotalMinor: 1499n,
    discountMinor: 0n,
    shippingMinor: 0n,
    taxMinor: 0n,
    totalMinor: 1499n,
    stripeCheckoutSessionId: "cs_1",
  });
  state.orderItems.set(orderItemId, {
    id: orderItemId,
    orderId,
    creatorId: "c-1",
    designId: "d-1",
    designVersionId: "dv-1",
    galleryItemId: null,
    licenseOfferId: null,
    personalizationVersionId: pvId,
    catalogProductId: null,
    catalogVariantId: null,
    quantity: 1,
    placement: "front",
    artworkRevenueMinor: 499n,
    personalizationRevenueMinor: 300n,
    productRevenueMinor: 700n,
    fulfillmentCostMinor: 0n,
    creatorRoyaltyMinor: 499n,
    platformRevenueMinor: 1000n,
    totalMinor: 1499n,
  });

  const validToken = await signDownloadToken({ orderItemId, orderId });

  // 3. Unpaid order (PENDING) -> 403
  const unpaidRes = await downloadGet(
    new Request(
      `http://localhost:3000/api/download?token=${encodeURIComponent(validToken)}`
    )
  );
  assert.equal(unpaidRes.status, 403);

  // 4. Missing DOWNLOAD_TOKEN_SECRET fails closed with 503
  const savedDownloadSecret = process.env.DOWNLOAD_TOKEN_SECRET;
  delete process.env.DOWNLOAD_TOKEN_SECRET;
  try {
    const unconfiguredRes = await downloadGet(
      new Request(
        `http://localhost:3000/api/download?token=${encodeURIComponent(validToken)}`
      )
    );
    assert.equal(unconfiguredRes.status, 503);
  } finally {
    process.env.DOWNLOAD_TOKEN_SECRET = savedDownloadSecret;
  }

  // 5. Refunded & Cancelled orders -> 403 even if paymentStatus was SUCCEEDED
  state.orders.get(orderId)!.paymentStatus = "SUCCEEDED";
  state.orders.get(orderId)!.status = "REFUNDED";
  const refundedRes = await downloadGet(
    new Request(
      `http://localhost:3000/api/download?token=${encodeURIComponent(validToken)}`
    )
  );
  assert.equal(refundedRes.status, 403);

  state.orders.get(orderId)!.status = "CANCELLED";
  const cancelledRes = await downloadGet(
    new Request(
      `http://localhost:3000/api/download?token=${encodeURIComponent(validToken)}`
    )
  );
  assert.equal(cancelledRes.status, 403);

  // 6. Paid active order -> 200 PNG 4500x5400 rendered strictly from frozen PersonalizationVersion.styleSnapshot!
  state.orders.get(orderId)!.status = "COMPLETED";
  const paidRes = await downloadGet(
    new Request(
      `http://localhost:3000/api/download?token=${encodeURIComponent(validToken)}`
    )
  );
  assert.equal(paidRes.status, 200);
  assert.equal(paidRes.headers.get("content-type"), "image/png");
  assert.match(
    paidRes.headers.get("content-disposition") ?? "",
    /ThiBut_Master_TB-DOWNLOAD-001\.png/
  );

  const pngBytes = Buffer.from(await paidRes.arrayBuffer());
  const meta = await sharp(pngBytes).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 4500);
  assert.equal(meta.height, 5400);
});

test("T-201, T-104, INV-003..006: /api/checkout & /api/checkout/gallery reject client tampering, fail closed without Stripe key, create Order(PENDING_PAYMENT) + immutable snapshots, and build server URLs", async () => {
  resetState();
  const { activeVariantId, inactiveVariantId } = seedCatalog();
  process.env.ANON_SESSION_SECRET = "wave2-anon-secret-minimum-32-chars!!";
  process.env.NEXT_PUBLIC_APP_URL = "https://thibut.com";

  const { anonId, token: anonToken } = await signAnonSessionToken("buyer-checkout-1");
  state.cookies.set(ANON_SESSION_COOKIE, {
    name: ANON_SESSION_COOKIE,
    value: anonToken,
  });

  const sessionId = crypto.randomUUID();
  state.sessions.set(sessionId, {
    id: sessionId,
    userId: null,
    anonymousSessionId: anonId,
    designId: null,
    designVersionId: null,
    mode: "QUOTE",
    inputText: "Đức",
    culturalStyle: "VIETNAMESE_THU_PHAP",
    status: "DRAFT",
    compositionJson: sampleComposition("Đức"),
  });

  // 1. Fails closed (503) when STRIPE_SECRET_KEY is missing or placeholder — NEVER returns a mock paid URL!
  delete process.env.STRIPE_SECRET_KEY;
  const noStripeRes = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, isDigital: true }),
    })
  );
  assert.equal(noStripeRes.status, 503);
  assert.equal(state.orders.size, 0);

  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  const placeholderStripeRes = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, isDigital: true }),
    })
  );
  assert.equal(placeholderStripeRes.status, 503);

  // Configure real test Stripe key for subsequent tests
  process.env.STRIPE_SECRET_KEY = "sk_test_real_wave2_secret";

  // 2. Rejects client price tampering, client title, client redirect URLs, and nil UUIDs (400)
  for (const maliciousPayload of [
    { sessionId, isDigital: true, priceMinor: 1 },
    { sessionId, isDigital: true, title: "Free Hoodie" },
    {
      sessionId,
      isDigital: true,
      successUrl: "https://evil.attacker.com/steal",
    },
    {
      sessionId,
      isDigital: true,
      cancelUrl: "https://evil.attacker.com/cancel",
    },
    {
      sessionId: "00000000-0000-0000-0000-000000000000",
      isDigital: true,
    },
    {
      sessionId,
      isDigital: false,
      catalogVariantId: "non-existent-variant",
    },
    {
      sessionId,
      isDigital: false,
      catalogVariantId: inactiveVariantId,
    },
  ]) {
    const badRes = await checkoutPost(
      new Request("https://thibut.com/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousPayload),
      })
    );
    assert.equal(badRes.status, 400);
  }
  assert.equal(state.orders.size, 0);

  // 3. Valid Digital Checkout: $14.99 (1499n) authoritative quote, freezes PersonalizationVersion, locks session, server URLs
  const digitalRes = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        isDigital: true,
        quantity: 1,
      }),
    })
  );
  assert.equal(digitalRes.status, 200);
  const digitalData = (await digitalRes.json()) as {
    url: string;
    orderId: string;
    orderNumber: string;
  };
  assert.ok(digitalData.url.startsWith("https://checkout.stripe.com/"));

  const digitalOrder = state.orders.get(digitalData.orderId);
  assert.ok(digitalOrder);
  assert.equal(digitalOrder.status, "PENDING_PAYMENT");
  assert.equal(digitalOrder.paymentStatus, "PENDING");
  assert.equal(digitalOrder.totalMinor, DIGITAL_TOTAL_MINOR); // 1499n ($14.99)
  assert.equal(digitalOrder.stripeCheckoutSessionId, "cs_test_wave2_1");

  // Session is now locked to CHECKED_OUT
  assert.equal(state.sessions.get(sessionId)?.status, "CHECKED_OUT");
  assert.equal(state.personalizationVersions.size, 1);
  assert.equal(state.orderItemSnapshots.size, 1);
  assert.equal(state.priceQuotes.size, 1);

  const stripeCall1 = state.stripeCalls[0];
  assert.equal(stripeCall1.line_items?.[0]?.price_data?.unit_amount, 1499);
  assert.equal(stripeCall1.shipping_address_collection, undefined);
  assert.ok(
    stripeCall1.success_url?.startsWith(
      "https://thibut.com/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=TB-"
    )
  );
  assert.equal(
    stripeCall1.cancel_url,
    `https://thibut.com/checkout?sessionId=${encodeURIComponent(sessionId)}&digital=true`
  );
  assert.equal(stripeCall1.metadata?.orderId, digitalOrder.id);

  // 4. Physical Checkout on a second session with "back" placement (+500n fee)
  const physicalSessionId = crypto.randomUUID();
  state.sessions.set(physicalSessionId, {
    id: physicalSessionId,
    userId: null,
    anonymousSessionId: anonId,
    designId: null,
    designVersionId: null,
    mode: "QUOTE",
    inputText: "Trí",
    culturalStyle: "VIETNAMESE_THU_PHAP",
    status: "DRAFT",
    compositionJson: sampleComposition("Trí"),
  });

  const physicalRes = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: physicalSessionId,
        isDigital: false,
        catalogVariantId: activeVariantId,
        placement: "back",
        quantity: 2,
      }),
    })
  );
  assert.equal(physicalRes.status, 200);
  const physicalData = (await physicalRes.json()) as { orderId: string };
  const physicalOrder = state.orders.get(physicalData.orderId)!;
  // Unit = 499n (artwork) + 300n (personalization) + (2999n + 500n back placement) = 4298n; x 2 = 8596n + US flat shipping (599n + 200n = 799n) = 9395n
  assert.equal(physicalOrder.subtotalMinor, 8596n);
  assert.equal(physicalOrder.shippingMinor, 799n);
  assert.equal(physicalOrder.totalMinor, 9395n);
  const stripeCall2 = state.stripeCalls[1];
  assert.equal(stripeCall2.line_items?.[0]?.price_data?.unit_amount, 4298);
  assert.equal(stripeCall2.line_items?.[0]?.quantity, 2);
  assert.ok(stripeCall2.shipping_address_collection?.allowed_countries?.includes("US"));

  // 5. Gallery Checkout (/api/checkout/gallery): creates Order(PENDING_PAYMENT) + OrderItem(galleryItemId)
  state.galleryItems.set("gal-zen-hoodie", {
    id: "gal-zen-hoodie",
    slug: "zen-hoodie",
    title: "Zen Brush Edition",
    productName: "Premium Heavyweight Tee",
    defaultColor: "Sumi Black",
    productImageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
    listedPriceMinor: 5499n,
    currency: "USD",
    published: true,
    purchasable: true,
    requiresSize: true,
  });

  // Rejects extra tampered priceMinor field
  const tamperedGalRes = await galleryCheckoutPost(
    new Request("https://thibut.com/api/checkout/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        galleryItemId: "gal-zen-hoodie",
        catalogVariantId: activeVariantId,
        priceMinor: 100,
      }),
    })
  );
  assert.equal(tamperedGalRes.status, 400);

  // Rejects missing size/variant when requiresSize is true
  const missingSizeGalRes = await galleryCheckoutPost(
    new Request("https://thibut.com/api/checkout/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        galleryItemId: "gal-zen-hoodie",
      }),
    })
  );
  assert.equal(missingSizeGalRes.status, 400);

  // Valid gallery checkout
  const validGalRes = await galleryCheckoutPost(
    new Request("https://thibut.com/api/checkout/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        galleryItemId: "gal-zen-hoodie",
        catalogVariantId: activeVariantId,
        quantity: 1,
      }),
    })
  );
  assert.equal(validGalRes.status, 200);
  const validGalJson = (await validGalRes.json()) as { orderId: string };
  const galOrder = state.orders.get(validGalJson.orderId)!;
  assert.equal(galOrder.status, "PENDING_PAYMENT");
  assert.equal(galOrder.subtotalMinor, 5499n);
  assert.equal(galOrder.shippingMinor, 599n);
  assert.equal(galOrder.totalMinor, 6098n);
  const stripeCall3 = state.stripeCalls[2];
  assert.equal(stripeCall3.line_items?.[0]?.price_data?.unit_amount, 5499);
  assert.equal(stripeCall3.metadata?.orderId, galOrder.id);
  assert.equal(stripeCall3.cancel_url, "https://thibut.com/gallery/zen-hoodie");
});

test("T-204: Cart actions isolate anonymous visitors, reject raster designDataUrl, persist real DB entities, and settle cleanly at /api/checkout", async () => {
  resetState();
  const { activeVariantId } = seedCatalog();
  process.env.ANON_SESSION_SECRET = "wave2-anon-secret-minimum-32-chars!!";
  process.env.STRIPE_SECRET_KEY = "sk_test_real_wave2_secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://thibut.com";

  const comp = sampleComposition("Bình An");

  // 1. Rejects legacy designDataUrl raster payload
  const legacyRes = await addToCartAction({
    variantId: activeVariantId,
    designDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    composition: comp,
    text: "Bình An",
    fontFamily: "UTM Thư Pháp Thiên Ân",
  });
  assert.equal(legacyRes.success, false);

  // 2. Visitor A adds 2 units to cart -> mints httpOnly ANON_SESSION_COOKIE + tb_cart_id
  const addARes = await addToCartAction({
    variantId: activeVariantId,
    composition: comp,
    text: "Bình An",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    tradition: "VIETNAMESE_THU_PHAP",
    placement: "front",
    quantity: 2,
  });
  assert.equal(addARes.success, true);
  assert.equal(addARes.count, 2);
  assert.ok(addARes.cartId);
  assert.ok(addARes.cartItemId);

  const visitorACartCookie = state.cookies.get("tb_cart_id");
  const visitorAAnonCookie = state.cookies.get(ANON_SESSION_COOKIE);
  assert.equal(visitorACartCookie?.options?.httpOnly, true);
  assert.equal(visitorAAnonCookie?.options?.httpOnly, true);
  assert.equal(await getCartCountAction(), 2);

  // Verify NO shared guest@thibut.com user was created!
  for (const user of state.users.values()) {
    assert.notEqual(user.email, "guest@thibut.com");
  }

  // 3. Simulate Visitor B (fresh browser cookies) -> sees count 0, gets isolated cart, cannot remove or checkout Visitor A's cart!
  state.cookies.clear();
  assert.equal(await getCartCountAction(), 0);

  const addBRes = await addToCartAction({
    variantId: activeVariantId,
    composition: sampleComposition("Hạnh Phúc"),
    text: "Hạnh Phúc",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    tradition: "VIETNAMESE_THU_PHAP",
    placement: "back",
    quantity: 1,
  });
  assert.equal(addBRes.success, true);
  assert.equal(addBRes.count, 1);
  assert.notEqual(addBRes.cartId, addARes.cartId);

  // Visitor B attempting to remove Visitor A's cartItemId -> Forbidden
  const hijackRemove = await removeFromCartAction(addARes.cartItemId!);
  assert.equal(hijackRemove.success, false);
  assert.equal(hijackRemove.error, "Forbidden");

  // Visitor B attempting to checkout Visitor A's cartId -> 403 Forbidden
  const hijackCheckout = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: addARes.cartId }),
    })
  );
  assert.equal(hijackCheckout.status, 403);

  // 4. Restore Visitor A's cookies and checkout Visitor A's cart
  state.cookies.clear();
  state.cookies.set(ANON_SESSION_COOKIE, visitorAAnonCookie!);
  state.cookies.set("tb_cart_id", visitorACartCookie!);
  assert.equal(await getCartCountAction(), 2);

  const cartCheckoutRes = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: addARes.cartId }),
    })
  );
  assert.equal(cartCheckoutRes.status, 200);
  const cartCheckoutJson = (await cartCheckoutRes.json()) as { orderId: string };
  const cartOrder = state.orders.get(cartCheckoutJson.orderId)!;
  // Unit front = 499n + 300n + 2999n = 3798n; x 2 = 7596n + US flat shipping (599n + 200n = 799n) = 8395n
  assert.equal(cartOrder.subtotalMinor, 7596n);
  assert.equal(cartOrder.shippingMinor, 799n);
  assert.equal(cartOrder.totalMinor, 8395n);
  assert.equal(state.carts.get(addARes.cartId!)?.status, "CHECKOUT");
});

test("AC-M1: a physical item whose product is not made in-house cannot be added to a cart or checked out", async () => {
  resetState();
  state.cookies.clear();
  const { productId, activeVariantId } = seedCatalog();
  process.env.ANON_SESSION_SECRET = "wave2-anon-secret-minimum-32-chars!!";
  process.env.STRIPE_SECRET_KEY = "sk_test_real_wave2_secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://thibut.com";
  const product = state.products.get(productId)!;
  const cartPayload = {
    variantId: activeVariantId,
    composition: sampleComposition("Bình An"),
    text: "Bình An",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    tradition: "VIETNAMESE_THU_PHAP",
    placement: "front",
    quantity: 1,
  };

  // 1. Add to cart is refused for every mode that is not exactly "IN_HOUSE".
  for (const mode of ["PRINTFUL", "in_house", ""]) {
    product.fulfillmentMode = mode;
    const refused = await addToCartAction(cartPayload);
    assert.equal(refused.success, false, `mode "${mode}" must be refused`);
    assert.equal(refused.error, "This item is not available right now");
  }
  assert.equal(state.cartItems.size, 0);

  // 2. An in-house product is added exactly as before.
  product.fulfillmentMode = "IN_HOUSE";
  const added = await addToCartAction(cartPayload);
  assert.equal(added.success, true);
  assert.ok(added.cartId);

  // 3. The product stops being in-house while it sits in the cart: checkout refuses it
  //    before any order row is written and before Stripe is called.
  product.fulfillmentMode = "PRINTFUL";
  const refusedCheckout = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: added.cartId }),
    })
  );
  assert.equal(refusedCheckout.status, 409);
  assert.deepEqual(await refusedCheckout.json(), {
    error: "One item in your cart is not available right now",
  });
  assert.equal(state.orders.size, 0);
  assert.equal(state.stripeCalls.length, 0);

  // 4. In-house again: checkout works and the price is the one the existing tests pin
  //    (499n + 300n + 2999n = 3798n, plus US flat shipping 599n).
  product.fulfillmentMode = "IN_HOUSE";
  const acceptedCheckout = await checkoutPost(
    new Request("https://thibut.com/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: added.cartId }),
    })
  );
  assert.equal(acceptedCheckout.status, 200);
  const accepted = (await acceptedCheckout.json()) as { orderId: string };
  const order = state.orders.get(accepted.orderId)!;
  assert.equal(order.subtotalMinor, 3798n);
  assert.equal(order.shippingMinor, 599n);
  assert.equal(order.totalMinor, 4397n);
  assert.equal(state.stripeCalls.length, 1);
});

test("T-404 & T-411: ClientCalligraphyRenderer is 100% deterministic, escapes XML/XSS payloads, and defaults seal font to Ma Shan Zheng", () => {
  // 1. Byte-identical determinism across repeated invocations (no Math.random())
  const svg1 = generateInstantSvgString({
    text: "Có Chí Thì Nên",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    layout: "VERTICAL",
    hasSeal: true,
    sealText: "印",
  });
  const svg2 = generateInstantSvgString({
    text: "Có Chí Thì Nên",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    layout: "VERTICAL",
    hasSeal: true,
    sealText: "印",
  });
  assert.equal(svg1, svg2);
  assert.equal(
    generateInstantSvgUri({ text: "Có Chí Thì Nên" }),
    generateInstantSvgUri({ text: "Có Chí Thì Nên" })
  );

  // 2. Default seal font is "Ma Shan Zheng" (never unlicensed "VNI Ong do")
  assert.ok(svg1.includes("Ma Shan Zheng"));
  assert.equal(svg1.includes("VNI Ong do"), false);

  // 3. Escapes XML/XSS payloads in both text and sealText
  const xssPayload = `<script>alert("xss")&'inject'</script>`;
  const escapedSvg = generateInstantSvgString({
    text: xssPayload,
    hasSeal: true,
    sealText: `<img src=x onerror="alert(1)"/>`,
    inkColor: `#121212" onload="evil()`,
  });

  assert.equal(escapedSvg.includes("<script>"), false);
  assert.equal(escapedSvg.includes("</script>"), false);
  assert.equal(escapedSvg.includes("<img"), false);
  assert.equal(escapedSvg.includes(`onload="evil()`), false);
  assert.ok(escapedSvg.includes("&lt;script&gt;"));
  assert.ok(escapedSvg.includes("&amp;&apos;inject&apos;&lt;/script&gt;"));
  assert.ok(escapedSvg.includes("&lt;img src=x onerror=&quot;alert(1)&quot;/&gt;"));
  assert.equal(escapedSvg.includes("fonts.googleapis.com"), false);
});

test("T-409 & INV-012: saveCompositionToSession and addToCartAction enforce creator DesignPolicyVersion permissions via PolicyGuard", async () => {
  resetState();
  const { activeVariantId } = seedCatalog();
  process.env.ANON_SESSION_SECRET = "wave2-anon-secret-minimum-32-chars!!";

  const { anonId, token: ownerToken } = await signAnonSessionToken("anon-policy-buyer");
  state.cookies.set(ANON_SESSION_COOKIE, {
    name: ANON_SESSION_COOKIE,
    value: ownerToken,
  });

  const creatorId = crypto.randomUUID();
  state.creators.set(creatorId, {
    id: creatorId,
    userId: "creator-user-1",
    slug: "master-artist",
    displayName: "Master Artist",
    status: "ACTIVE",
  });

  const creatorDesignId = crypto.randomUUID();
  const creatorVersionId = crypto.randomUUID();
  state.designs.set(creatorDesignId, {
    id: creatorDesignId,
    creatorId,
    slug: "locked-creator-scroll",
    title: "Locked Creator Scroll",
    status: "PUBLISHED",
    visibility: "PUBLIC",
  });
  state.designVersions.set(creatorVersionId, {
    id: creatorVersionId,
    designId: creatorDesignId,
    versionNumber: 1,
  });

  // Policy v1: Creator forbids calligraphy overlay AND forbids recoloring
  const policyId = crypto.randomUUID();
  state.designPolicies.set(policyId, {
    id: policyId,
    designId: creatorDesignId,
    versionNumber: 1,
    allowName: true,
    allowQuote: true,
    allowTranslation: true,
    allowCalligraphy: false,
    allowRecolor: false,
    allowCrop: false,
    allowBackgroundRemoval: false,
    allowAIRestyle: false,
    allowDerivative: false,
    allowCommercialUse: false,
    allowModelTraining: false,
  });

  const creatorSessionId = crypto.randomUUID();
  state.sessions.set(creatorSessionId, {
    id: creatorSessionId,
    userId: null,
    anonymousSessionId: anonId,
    designId: creatorDesignId,
    designVersionId: creatorVersionId,
    mode: "QUOTE",
    inputText: "Bình An",
    culturalStyle: "VIETNAMESE_THU_PHAP",
    status: "DRAFT",
    compositionJson: null,
  });

  // 1. saveCompositionToSession rejects calligraphy layer when allowCalligraphy === false
  await assert.rejects(
    () => saveCompositionToSession(creatorSessionId, sampleComposition("Bình An")),
    /allowCalligraphy/
  );

  // 2. addToCartAction rejects creator design with calligraphy when allowCalligraphy === false
  const blockedCartCalligraphy = await addToCartAction({
    variantId: activeVariantId,
    designId: creatorDesignId,
    composition: sampleComposition("Bình An"),
    text: "Bình An",
    fontFamily: "UTM Thư Pháp Thiên Ân",
  });
  assert.equal(blockedCartCalligraphy.success, false);
  assert.match(blockedCartCalligraphy.error ?? "", /allowCalligraphy/);

  // 3. Omitting designId while referencing creatorSessionId STILL enforces creator policy (cannot strip creator attribution)
  const bypassAttempt = await addToCartAction({
    variantId: activeVariantId,
    sessionId: creatorSessionId,
    composition: sampleComposition("Bình An"),
    text: "Bình An",
    fontFamily: "UTM Thư Pháp Thiên Ân",
  });
  assert.equal(bypassAttempt.success, false);
  assert.match(bypassAttempt.error ?? "", /allowCalligraphy/);

  // 4. Enable allowCalligraphy = true, keep allowRecolor = false -> crimson ink (#8B0000) is rejected, neutral sumi (#121212) succeeds!
  state.designPolicies.get(policyId)!.allowCalligraphy = true;

  const recoloredComp = CompositionSchema.parse({
    ...sampleComposition("Bình An"),
    color: "#8B0000",
  });

  await assert.rejects(
    () => saveCompositionToSession(creatorSessionId, recoloredComp),
    /allowRecolor/
  );

  const blockedRecolorCart = await addToCartAction({
    variantId: activeVariantId,
    sessionId: creatorSessionId,
    designId: creatorDesignId,
    composition: recoloredComp,
    text: "Bình An",
    fontFamily: "UTM Thư Pháp Thiên Ân",
  });
  assert.equal(blockedRecolorCart.success, false);
  assert.match(blockedRecolorCart.error ?? "", /allowRecolor/);

  // Standard sumi ink (#121212) satisfies allowCalligraphy: true + allowRecolor: false
  const allowedSave = await saveCompositionToSession(
    creatorSessionId,
    sampleComposition("Bình An")
  );
  assert.equal(allowedSave.ok, true);

  const allowedCart = await addToCartAction({
    variantId: activeVariantId,
    sessionId: creatorSessionId,
    designId: creatorDesignId,
    composition: sampleComposition("Bình An"),
    text: "Bình An",
    fontFamily: "UTM Thư Pháp Thiên Ân",
  });
  assert.equal(allowedCart.success, true);
  const createdCartItem = state.cartItems.get(allowedCart.cartItemId!);
  assert.equal(createdCartItem?.designId, creatorDesignId);
  assert.equal(createdCartItem?.creatorId, creatorId);
});
