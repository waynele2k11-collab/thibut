-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED', 'PENDING');

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('DRAFT', 'ONBOARDING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DesignStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'PAUSED', 'REJECTED', 'ARCHIVED', 'TAKEDOWN');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ORIGINAL', 'WORKING', 'DERIVATIVE', 'CUTOUT', 'THUMBNAIL', 'PREVIEW', 'MOCKUP', 'PRINT_MASTER', 'SOURCE_VECTOR');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('PERSONAL_PRODUCT', 'PERSONAL_DIGITAL', 'COMMERCIAL', 'EXTENDED_COMMERCIAL', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "PersonalizationMode" AS ENUM ('NAME', 'QUOTE', 'STORY', 'CREATOR_ART');

-- CreateEnum
CREATE TYPE "PersonalizationStatus" AS ENUM ('DRAFT', 'ANALYZING', 'READY_FOR_STYLE', 'GENERATING', 'READY', 'SELECTED', 'CHECKED_OUT', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CreatorEarningStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'TRANSFERRED', 'REVERSED', 'HELD');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKOUT', 'CONVERTED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AIJobType" AS ENUM ('TRANSLATION', 'TRANSLITERATION', 'INTERPRETATION', 'CALLIGRAPHY', 'IMAGE_EDIT', 'BACKGROUND_REMOVAL', 'COMPOSITION', 'MOCKUP', 'MODERATION', 'PRINT_RENDER');

-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LayerType" AS ENUM ('IMAGE', 'THIBUT_ART', 'TEXT');

-- CreateEnum
CREATE TYPE "AIUsageEntryType" AS ENUM ('PLAN_GRANT', 'PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "StyleFamily" AS ENUM ('VIETNAMESE', 'JAPANESE_INSPIRED', 'CHINESE_INSPIRED', 'KOREAN_INSPIRED', 'PAN_ASIAN', 'MODERN');

-- CreateEnum
CREATE TYPE "StylePackStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "InterpretationType" AS ENUM ('ORIGINAL', 'PHONETIC', 'TRANSLITERATION', 'SCRIPT_ADAPTATION', 'SINO_VIETNAMESE', 'LITERAL', 'NATURAL', 'POETIC', 'IDIOMATIC');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('GENERATING', 'READY', 'SELECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProductMockupStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreatorTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreatorPlanCode" AS ENUM ('FREE', 'CREATOR', 'CREATOR_PLUS', 'STUDIO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'PAUSED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('PLATFORM_CASH', 'CREATOR_PAYABLE', 'AI_REVENUE', 'FULFILLMENT_PAYABLE', 'PLATFORM_REVENUE', 'PLATFORM_AI_REVENUE', 'PLATFORM_PRODUCT_REVENUE', 'PLATFORM_MARKETPLACE_REVENUE', 'REFUND_LIABILITY', 'STRIPE_CLEARING', 'TAX_PAYABLE');

-- CreateEnum
CREATE TYPE "CulturalInputType" AS ENUM ('PERSON_NAME', 'FAMILY_NAME', 'WORD', 'PHRASE', 'QUOTE', 'IDIOM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TextTreatment" AS ENUM ('KEEP_ORIGINAL', 'TRANSLATE');

-- CreateEnum
CREATE TYPE "CulturalStyle" AS ENUM ('VIETNAMESE_THU_PHAP', 'JAPANESE_SHODO', 'CHINESE_CALLIGRAPHY', 'KOREAN_BRUSH');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('GENERATED', 'AUTO_VALIDATED', 'HUMAN_VERIFIED', 'REJECTED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "KnowledgeSource" AS ENUM ('VERIFIED_KNOWLEDGE', 'DICTIONARY', 'TRANSLITERATION_ENGINE', 'AI', 'ADMIN', 'MOCK');

-- CreateEnum
CREATE TYPE "GeneratedDesignStatus" AS ENUM ('READY', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Font" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "tradition" TEXT DEFAULT 'VIETNAMESE_THU_PHAP',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Font_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "stripeAccountId" TEXT,
    "status" "CreatorStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPlan" (
    "id" TEXT NOT NULL,
    "code" "CreatorPlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "activeDesignLimit" INTEGER NOT NULL,
    "monthlyAICredits" INTEGER NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorSubscription" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "sourceText" TEXT NOT NULL,
    "sourceLanguage" TEXT,
    "tradition" TEXT,
    "artworkId" TEXT NOT NULL,
    "artworkPreviewUrl" TEXT NOT NULL,
    "productionArtworkUrl" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productImageUrl" TEXT NOT NULL,
    "listedPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requiresSize" BOOLEAN NOT NULL DEFAULT false,
    "requiresColor" BOOLEAN NOT NULL DEFAULT false,
    "defaultColor" TEXT,
    "availableSizes" TEXT[],
    "availableColors" TEXT[],
    "mockupTransform" JSONB,
    "category" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "purchasable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DesignStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "categoryId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignTag" (
    "designId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "DesignTag_pkey" PRIMARY KEY ("designId","tagId")
);

-- CreateTable
CREATE TABLE "DesignVersion" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 'vercel-blob',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignVersionAsset" (
    "id" TEXT NOT NULL,
    "designVersionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,

    CONSTRAINT "DesignVersionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignPolicyVersion" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "allowName" BOOLEAN NOT NULL DEFAULT true,
    "allowQuote" BOOLEAN NOT NULL DEFAULT true,
    "allowTranslation" BOOLEAN NOT NULL DEFAULT true,
    "allowCalligraphy" BOOLEAN NOT NULL DEFAULT true,
    "allowRecolor" BOOLEAN NOT NULL DEFAULT false,
    "allowCrop" BOOLEAN NOT NULL DEFAULT false,
    "allowBackgroundRemoval" BOOLEAN NOT NULL DEFAULT true,
    "allowAIRestyle" BOOLEAN NOT NULL DEFAULT false,
    "allowDerivative" BOOLEAN NOT NULL DEFAULT false,
    "allowCommercialUse" BOOLEAN NOT NULL DEFAULT false,
    "allowModelTraining" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignMetricDaily" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "personalizationStarts" INTEGER NOT NULL DEFAULT 0,
    "personalizationCompletes" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "addToCarts" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "units" INTEGER NOT NULL DEFAULT 0,
    "grossRevenueMinor" BIGINT NOT NULL DEFAULT 0,
    "refunds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseOffer" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "type" "LicenseType" NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxPhysicalUnits" INTEGER,
    "allowDigitalDownload" BOOLEAN NOT NULL DEFAULT false,
    "allowResale" BOOLEAN NOT NULL DEFAULT false,
    "allowCommercialUse" BOOLEAN NOT NULL DEFAULT false,
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseGrant" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "licenseOfferId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "designVersionId" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "allowName" BOOLEAN NOT NULL,
    "allowQuote" BOOLEAN NOT NULL,
    "allowTranslation" BOOLEAN NOT NULL,
    "allowCalligraphy" BOOLEAN NOT NULL,
    "allowAIRestyle" BOOLEAN NOT NULL,
    "allowCommercial" BOOLEAN NOT NULL,
    "allowModelTraining" BOOLEAN NOT NULL DEFAULT false,
    "termsSnapshot" JSONB NOT NULL,
    "permissionsSnapshot" JSONB NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LicenseGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StylePack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "StyleFamily" NOT NULL,
    "description" TEXT,
    "status" "StylePackStatus" NOT NULL DEFAULT 'ACTIVE',
    "previewAssetId" TEXT,
    "systemConfigJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StylePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supportedPlacement" TEXT,
    "layoutSchemaJson" JSONB,
    "previewAssetId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompositionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "designId" TEXT,
    "designVersionId" TEXT,
    "mode" "PersonalizationMode" NOT NULL,
    "inputText" TEXT NOT NULL,
    "inputLanguage" TEXT,
    "targetLanguage" TEXT,
    "textTreatment" "TextTreatment",
    "culturalStyle" "CulturalStyle",
    "selectedInterpretationId" TEXT,
    "status" "PersonalizationStatus" NOT NULL DEFAULT 'DRAFT',
    "intent" JSONB,
    "compositionJson" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalizationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interpretation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "InterpretationType" NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "romanization" TEXT,
    "meaning" TEXT,
    "confidence" DOUBLE PRECISION,
    "warning" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interpretation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationCandidate" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "interpretationId" TEXT,
    "stylePackId" TEXT,
    "compositionTemplateId" TEXT,
    "assetId" TEXT,
    "previewAssetId" TEXT,
    "generationJobId" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'GENERATING',
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationVersion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateId" TEXT,
    "designVersionId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "interpretationSnapshot" JSONB NOT NULL,
    "styleSnapshot" JSONB NOT NULL,
    "printAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "creatorId" TEXT,
    "sessionId" TEXT,
    "type" "AIJobType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AIJobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputJson" JSONB,
    "outputJson" JSONB,
    "estimatedCredits" INTEGER,
    "actualCredits" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiJobId" TEXT,
    "type" "AIUsageEntryType" NOT NULL,
    "credits" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "defaultMarkupMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "color" TEXT,
    "colorHex" TEXT,
    "size" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "baseRetailMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentProviderRecord" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FulfillmentProviderRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderVariant" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "catalogVariantId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalVariantId" TEXT NOT NULL,
    "costMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignProduct" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultPlacement" TEXT,
    "creatorMarkupMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintArea" (
    "id" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "safeWidthPx" INTEGER NOT NULL,
    "safeHeightPx" INTEGER NOT NULL,
    "dpi" INTEGER NOT NULL DEFAULT 300,
    "schemaJson" JSONB,

    CONSTRAINT "PrintArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMockup" (
    "id" TEXT NOT NULL,
    "personalizationVersionId" TEXT,
    "catalogVariantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "angle" TEXT,
    "provider" TEXT,
    "status" "ProductMockupStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMockup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "designVersionId" TEXT NOT NULL,
    "personalizationVersionId" TEXT,
    "catalogVariantId" TEXT NOT NULL,
    "licenseOfferId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitArtworkMinor" BIGINT NOT NULL,
    "unitPersonalizationMinor" BIGINT NOT NULL,
    "unitProductMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceQuote" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "subtotalMinor" BIGINT NOT NULL,
    "artworkMinor" BIGINT NOT NULL,
    "personalizationMinor" BIGINT NOT NULL,
    "productMinor" BIGINT NOT NULL,
    "shippingMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "pricingVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "shippingMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "placedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "designVersionId" TEXT NOT NULL,
    "personalizationVersionId" TEXT,
    "catalogProductId" TEXT,
    "catalogVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'front',
    "artworkRevenueMinor" BIGINT NOT NULL,
    "personalizationRevenueMinor" BIGINT NOT NULL,
    "productRevenueMinor" BIGINT NOT NULL,
    "fulfillmentCostMinor" BIGINT NOT NULL DEFAULT 0,
    "creatorRoyaltyMinor" BIGINT NOT NULL,
    "platformRevenueMinor" BIGINT NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemSnapshot" (
    "orderItemId" TEXT NOT NULL,
    "designTitle" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "productName" TEXT,
    "variantName" TEXT,
    "color" TEXT,
    "size" TEXT,
    "licenseTermsJson" JSONB NOT NULL,
    "personalizationJson" JSONB,
    "printPlacementJson" JSONB,
    "pricingJson" JSONB NOT NULL,

    CONSTRAINT "OrderItemSnapshot_pkey" PRIMARY KEY ("orderItemId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerPaymentId" TEXT,
    "providerChargeId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "providerRefundId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorEarning" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "grossLicenseMinor" BIGINT NOT NULL,
    "adjustmentMinor" BIGINT NOT NULL DEFAULT 0,
    "netCreatorMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CreatorEarningStatus" NOT NULL DEFAULT 'PENDING',
    "eligibleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorTransfer" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerTransferId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CreatorTransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "CreatorTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorTransferAllocation" (
    "transferId" TEXT NOT NULL,
    "creatorEarningId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "CreatorTransferAllocation_pkey" PRIMARY KEY ("transferId","creatorEarningId")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "ownerType" TEXT,
    "ownerId" TEXT,
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerPosting" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhraseKnowledge" (
    "id" TEXT NOT NULL,
    "normalizedInput" TEXT NOT NULL,
    "displayInput" TEXT NOT NULL,
    "inputType" "CulturalInputType" NOT NULL,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT NOT NULL,
    "interpretationType" "InterpretationType" NOT NULL,
    "renderedText" TEXT NOT NULL,
    "romanization" TEXT,
    "meaning" TEXT,
    "explanation" TEXT,
    "confidence" DOUBLE PRECISION,
    "verificationStatus" "VerificationStatus" NOT NULL,
    "source" "KnowledgeSource" NOT NULL,
    "engineVersion" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhraseKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDesign" (
    "id" TEXT NOT NULL,
    "phraseKnowledgeId" TEXT NOT NULL,
    "stylePackId" TEXT NOT NULL,
    "rendererVersion" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDesignVariation" (
    "id" TEXT NOT NULL,
    "generatedDesignId" TEXT NOT NULL,
    "variationIndex" INTEGER NOT NULL,
    "variationNote" TEXT NOT NULL,
    "renderedText" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "GeneratedDesignStatus" NOT NULL DEFAULT 'READY',

    CONSTRAINT "GeneratedDesignVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Composition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layoutRulesJson" JSONB NOT NULL,

    CONSTRAINT "Composition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserComposition" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "canvasWidth" INTEGER NOT NULL,
    "canvasHeight" INTEGER NOT NULL,
    "backgroundSourceType" TEXT NOT NULL DEFAULT 'NONE',
    "backgroundAssetId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'GENERIC',
    "previewAssetId" TEXT,
    "mergedAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserComposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCompositionLayer" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "type" "LayerType" NOT NULL,
    "assetId" TEXT,
    "text" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "scaleX" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "scaleY" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "color" TEXT,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "zIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserCompositionLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundPreset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "promptTemplate" TEXT NOT NULL,
    "defaultMood" TEXT,
    "defaultPalette" TEXT,
    "defaultIntensity" TEXT,
    "previewUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedBackground" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT,
    "presetKey" TEXT NOT NULL,
    "mood" TEXT,
    "palette" TEXT,
    "intensity" TEXT,
    "promptNote" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL DEFAULT 1,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedBackground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Font_fileName_key" ON "Font"("fileName");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_slug_key" ON "CreatorProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_stripeAccountId_key" ON "CreatorProfile"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorPlan_code_key" ON "CreatorPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorSubscription_creatorId_key" ON "CreatorSubscription"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorSubscription_providerSubscriptionId_key" ON "CreatorSubscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryItem_slug_key" ON "GalleryItem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Design_slug_key" ON "Design"("slug");

-- CreateIndex
CREATE INDEX "Design_creatorId_status_idx" ON "Design"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Design_status_visibility_publishedAt_idx" ON "Design"("status", "visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "Design_categoryId_idx" ON "Design"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignVersion_designId_versionNumber_key" ON "DesignVersion"("designId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_objectKey_key" ON "Asset"("objectKey");

-- CreateIndex
CREATE INDEX "Asset_sha256_idx" ON "Asset"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "DesignVersionAsset_designVersionId_assetId_type_key" ON "DesignVersionAsset"("designVersionId", "assetId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DesignPolicyVersion_designId_versionNumber_key" ON "DesignPolicyVersion"("designId", "versionNumber");

-- CreateIndex
CREATE INDEX "DesignMetricDaily_designId_date_idx" ON "DesignMetricDaily"("designId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DesignMetricDaily_designId_date_key" ON "DesignMetricDaily"("designId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseGrant_orderItemId_key" ON "LicenseGrant"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StylePack_slug_key" ON "StylePack"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StylePack_previewAssetId_key" ON "StylePack"("previewAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionTemplate_slug_key" ON "CompositionTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionTemplate_previewAssetId_key" ON "CompositionTemplate"("previewAssetId");

-- CreateIndex
CREATE INDEX "PersonalizationSession_userId_status_idx" ON "PersonalizationSession"("userId", "status");

-- CreateIndex
CREATE INDEX "Interpretation_sessionId_idx" ON "Interpretation"("sessionId");

-- CreateIndex
CREATE INDEX "PersonalizationCandidate_sessionId_status_idx" ON "PersonalizationCandidate"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalizationVersion_sessionId_versionNumber_key" ON "PersonalizationVersion"("sessionId", "versionNumber");

-- CreateIndex
CREATE INDEX "AIJob_userId_type_status_idx" ON "AIJob"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "AIJob_sessionId_idx" ON "AIJob"("sessionId");

-- CreateIndex
CREATE INDEX "AIUsageEntry_userId_createdAt_idx" ON "AIUsageEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_slug_key" ON "CatalogProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVariant_sku_key" ON "CatalogVariant"("sku");

-- CreateIndex
CREATE INDEX "CatalogVariant_productId_active_idx" ON "CatalogVariant"("productId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentProviderRecord_code_key" ON "FulfillmentProviderRecord"("code");

-- CreateIndex
CREATE INDEX "ProviderVariant_providerId_active_idx" ON "ProviderVariant"("providerId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVariant_providerId_catalogVariantId_key" ON "ProviderVariant"("providerId", "catalogVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignProduct_designId_catalogProductId_key" ON "DesignProduct"("designId", "catalogProductId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintArea_catalogProductId_placement_key" ON "PrintArea"("catalogProductId", "placement");

-- CreateIndex
CREATE INDEX "ProductMockup_personalizationVersionId_idx" ON "ProductMockup"("personalizationVersionId");

-- CreateIndex
CREATE INDEX "Cart_userId_status_idx" ON "Cart"("userId", "status");

-- CreateIndex
CREATE INDEX "PriceQuote_cartId_idx" ON "PriceQuote"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_buyerId_status_idx" ON "Order"("buyerId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_creatorId_idx" ON "OrderItem"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerChargeId_key" ON "Payment"("providerChargeId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorEarning_orderItemId_key" ON "CreatorEarning"("orderItemId");

-- CreateIndex
CREATE INDEX "CreatorEarning_creatorId_status_idx" ON "CreatorEarning"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorTransfer_providerTransferId_key" ON "CreatorTransfer"("providerTransferId");

-- CreateIndex
CREATE INDEX "CreatorTransfer_creatorId_status_idx" ON "CreatorTransfer"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");

-- CreateIndex
CREATE INDEX "LedgerAccount_ownerType_ownerId_idx" ON "LedgerAccount"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_referenceType_referenceId_idx" ON "LedgerTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "LedgerPosting_transactionId_idx" ON "LedgerPosting"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerPosting_accountId_idx" ON "LedgerPosting"("accountId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_status_idx" ON "WebhookEvent"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "ModerationCase_subjectType_subjectId_idx" ON "ModerationCase"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ModerationCase_status_idx" ON "ModerationCase"("status");

-- CreateIndex
CREATE INDEX "PhraseKnowledge_normalizedInput_inputType_targetLanguage_idx" ON "PhraseKnowledge"("normalizedInput", "inputType", "targetLanguage");

-- CreateIndex
CREATE INDEX "PhraseKnowledge_verificationStatus_idx" ON "PhraseKnowledge"("verificationStatus");

-- CreateIndex
CREATE INDEX "PhraseKnowledge_usageCount_idx" ON "PhraseKnowledge"("usageCount");

-- CreateIndex
CREATE INDEX "GeneratedDesign_phraseKnowledgeId_stylePackId_rendererVersi_idx" ON "GeneratedDesign"("phraseKnowledgeId", "stylePackId", "rendererVersion");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundPreset_key_key" ON "BackgroundPreset"("key");

-- CreateIndex
CREATE INDEX "DeviceVerification_userId_code_idx" ON "DeviceVerification"("userId", "code");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubscription" ADD CONSTRAINT "CreatorSubscription_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubscription" ADD CONSTRAINT "CreatorSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CreatorPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignTag" ADD CONSTRAINT "DesignTag_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignTag" ADD CONSTRAINT "DesignTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersionAsset" ADD CONSTRAINT "DesignVersionAsset_designVersionId_fkey" FOREIGN KEY ("designVersionId") REFERENCES "DesignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersionAsset" ADD CONSTRAINT "DesignVersionAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignPolicyVersion" ADD CONSTRAINT "DesignPolicyVersion_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignMetricDaily" ADD CONSTRAINT "DesignMetricDaily_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseOffer" ADD CONSTRAINT "LicenseOffer_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_licenseOfferId_fkey" FOREIGN KEY ("licenseOfferId") REFERENCES "LicenseOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StylePack" ADD CONSTRAINT "StylePack_previewAssetId_fkey" FOREIGN KEY ("previewAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionTemplate" ADD CONSTRAINT "CompositionTemplate_previewAssetId_fkey" FOREIGN KEY ("previewAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationSession" ADD CONSTRAINT "PersonalizationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationSession" ADD CONSTRAINT "PersonalizationSession_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interpretation" ADD CONSTRAINT "Interpretation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PersonalizationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationCandidate" ADD CONSTRAINT "PersonalizationCandidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PersonalizationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationCandidate" ADD CONSTRAINT "PersonalizationCandidate_interpretationId_fkey" FOREIGN KEY ("interpretationId") REFERENCES "Interpretation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationCandidate" ADD CONSTRAINT "PersonalizationCandidate_stylePackId_fkey" FOREIGN KEY ("stylePackId") REFERENCES "StylePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationCandidate" ADD CONSTRAINT "PersonalizationCandidate_compositionTemplateId_fkey" FOREIGN KEY ("compositionTemplateId") REFERENCES "CompositionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationCandidate" ADD CONSTRAINT "PersonalizationCandidate_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationCandidate" ADD CONSTRAINT "PersonalizationCandidate_previewAssetId_fkey" FOREIGN KEY ("previewAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationVersion" ADD CONSTRAINT "PersonalizationVersion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PersonalizationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationVersion" ADD CONSTRAINT "PersonalizationVersion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "PersonalizationCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationVersion" ADD CONSTRAINT "PersonalizationVersion_designVersionId_fkey" FOREIGN KEY ("designVersionId") REFERENCES "DesignVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationVersion" ADD CONSTRAINT "PersonalizationVersion_printAssetId_fkey" FOREIGN KEY ("printAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PersonalizationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageEntry" ADD CONSTRAINT "AIUsageEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageEntry" ADD CONSTRAINT "AIUsageEntry_aiJobId_fkey" FOREIGN KEY ("aiJobId") REFERENCES "AIJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogVariant" ADD CONSTRAINT "CatalogVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "FulfillmentProviderRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_catalogVariantId_fkey" FOREIGN KEY ("catalogVariantId") REFERENCES "CatalogVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProduct" ADD CONSTRAINT "DesignProduct_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignProduct" ADD CONSTRAINT "DesignProduct_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintArea" ADD CONSTRAINT "PrintArea_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMockup" ADD CONSTRAINT "ProductMockup_catalogVariantId_fkey" FOREIGN KEY ("catalogVariantId") REFERENCES "CatalogVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMockup" ADD CONSTRAINT "ProductMockup_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_catalogVariantId_fkey" FOREIGN KEY ("catalogVariantId") REFERENCES "CatalogVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_personalizationVersionId_fkey" FOREIGN KEY ("personalizationVersionId") REFERENCES "PersonalizationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_catalogVariantId_fkey" FOREIGN KEY ("catalogVariantId") REFERENCES "CatalogVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemSnapshot" ADD CONSTRAINT "OrderItemSnapshot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorEarning" ADD CONSTRAINT "CreatorEarning_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorEarning" ADD CONSTRAINT "CreatorEarning_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorTransfer" ADD CONSTRAINT "CreatorTransfer_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorTransferAllocation" ADD CONSTRAINT "CreatorTransferAllocation_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "CreatorTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorTransferAllocation" ADD CONSTRAINT "CreatorTransferAllocation_creatorEarningId_fkey" FOREIGN KEY ("creatorEarningId") REFERENCES "CreatorEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerPosting" ADD CONSTRAINT "LedgerPosting_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerPosting" ADD CONSTRAINT "LedgerPosting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDesign" ADD CONSTRAINT "GeneratedDesign_phraseKnowledgeId_fkey" FOREIGN KEY ("phraseKnowledgeId") REFERENCES "PhraseKnowledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDesignVariation" ADD CONSTRAINT "GeneratedDesignVariation_generatedDesignId_fkey" FOREIGN KEY ("generatedDesignId") REFERENCES "GeneratedDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserComposition" ADD CONSTRAINT "UserComposition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserComposition" ADD CONSTRAINT "UserComposition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PersonalizationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserComposition" ADD CONSTRAINT "UserComposition_backgroundAssetId_fkey" FOREIGN KEY ("backgroundAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserComposition" ADD CONSTRAINT "UserComposition_previewAssetId_fkey" FOREIGN KEY ("previewAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserComposition" ADD CONSTRAINT "UserComposition_mergedAssetId_fkey" FOREIGN KEY ("mergedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompositionLayer" ADD CONSTRAINT "UserCompositionLayer_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "UserComposition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompositionLayer" ADD CONSTRAINT "UserCompositionLayer_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedBackground" ADD CONSTRAINT "GeneratedBackground_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceVerification" ADD CONSTRAINT "DeviceVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

