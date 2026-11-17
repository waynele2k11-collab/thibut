export interface ProviderProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrls: string[];
}

export interface ProviderVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  color: string;
  colorHex?: string;
  size: string;
  priceMinor: bigint;
  currency: string;
  inStock: boolean;
  imageUrls: string[];
}

export interface ProviderPrice {
  variantId: string;
  priceMinor: bigint;
  currency: string;
}

export interface PrintAreaMetadata {
  placement:
    | "FRONT_CENTER"
    | "BACK_CENTER"
    | "LEFT_CHEST"
    | "SLEEVE_LEFT"
    | "SLEEVE_RIGHT";
  widthPx: number;
  heightPx: number;
  safeWidthPx: number;
  safeHeightPx: number;
  dpi: number;
  schemaJson: Record<string, unknown>;
}

export interface MockupRequest {
  variantId: string;
  placement: string;
  assetUrl: string;
}

export interface MockupJob {
  taskId: string;
  status: "PENDING" | "READY" | "FAILED";
  mockupUrl?: string;
  error?: string;
}

export interface ShippingQuoteRequest {
  variantIds: string[];
  quantities: number[];
  recipient: {
    address1: string;
    city: string;
    countryCode: string; // ISO 3166-1 alpha-2
    stateCode?: string;
    zip: string;
  };
}

export interface ShippingRate {
  id: string;
  name: string;
  rateMinor: bigint;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}

export interface FulfillmentOrderRequest {
  externalId: string;
  recipient: {
    name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    stateCode?: string;
    countryCode: string;
    zip: string;
    phone?: string;
    email: string;
  };
  items: Array<{
    variantId: string;
    quantity: number;
    retailPriceMinor?: bigint;
    files: Array<{
      url: string;
      placement: string;
    }>;
  }>;
}

export interface ProviderOrder {
  id: string;
  externalId: string;
  status:
    | "DRAFT"
    | "PENDING"
    | "PROCESSING"
    | "IN_PRODUCTION"
    | "SHIPPED"
    | "DELIVERED"
    | "FAILED"
    | "CANCELLED";
  totalCostMinor: bigint;
  currency: string;
}

export interface PrintfulStoreProductSummary {
  id: number | string;
  name: string;
  thumbnail_url?: string | null;
}

export interface PrintfulSyncVariantFile {
  type?: string;
  preview_url?: string | null;
}

export interface PrintfulSyncVariant {
  id: number | string;
  name: string;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
  price?: string | number | null;
  retail_price?: string | number | null;
  currency?: string | null;
  files?: PrintfulSyncVariantFile[];
}

export interface PrintfulStoreProductDetailsResult {
  sync_product?: PrintfulStoreProductSummary;
  sync_variants?: PrintfulSyncVariant[];
}

export interface PrintfulCatalogProductVariantRaw {
  id: number;
  product_id?: number;
  name: string;
  sku?: string | null;
  color?: string | null;
  color_code?: string | null;
  colorHex?: string | null;
  size?: string | null;
  price: string | number;
  in_stock?: boolean;
  image?: string | null;
}

export interface PrintfulCatalogProductDetailsResponse {
  result: {
    product: {
      id: number;
      title: string;
      type?: string;
      description?: string | null;
      image?: string | null;
    };
    variants: PrintfulCatalogProductVariantRaw[];
  };
}

export interface FulfillmentEventPayload {
  order?: {
    id?: string | number;
    external_id?: string;
  };
  shipment?: Record<string, unknown>;
  task_key?: string;
  mockups?: Array<Record<string, unknown>>;
  reason?: string;
}

export type FulfillmentEventType =
  | "MOCKUP_COMPLETED"
  | "MOCKUP_FAILED"
  | "ORDER_SHIPPED"
  | "ORDER_FAILED"
  | "ORDER_CANCELED"
  | "IGNORED";

export interface FulfillmentEvent {
  type: FulfillmentEventType;
  rawType: string;
  externalEventId: string;
  orderExternalId?: string;
  payload: FulfillmentEventPayload;
}

export interface FulfillmentProvider {
  getProducts(): Promise<ProviderProduct[]>;
  getVariants(productId: string): Promise<ProviderVariant[]>;
  getStoreProducts(): Promise<{ result: PrintfulStoreProductSummary[] }>;
  getProductDetails(
    productId: string | number
  ): Promise<{ result: PrintfulStoreProductDetailsResult }>;
  getCatalogProductDetails(
    productId: string | number
  ): Promise<PrintfulCatalogProductDetailsResponse>;
  generateBlankMockups(
    productId: string | number,
    variantIds: number[],
    placement?: string
  ): Promise<Record<string, unknown>>;
  getMockupTaskResult(taskKey: string): Promise<Record<string, unknown>>;
  getPricing(variantId: string): Promise<ProviderPrice>;
  getPrintAreas(productId: string): Promise<PrintAreaMetadata[]>;
  generateMockups(input: MockupRequest): Promise<MockupJob>;
  getShippingRates(input: ShippingQuoteRequest): Promise<ShippingRate[]>;
  createDraftOrder(input: FulfillmentOrderRequest): Promise<ProviderOrder>;
  confirmOrder(providerOrderId: string): Promise<void>;
  cancelOrder(providerOrderId: string): Promise<void>;
  getOrder(providerOrderId: string): Promise<ProviderOrder>;
  parseWebhook(payload: unknown, rawBodyText?: string): Promise<FulfillmentEvent>;
}
