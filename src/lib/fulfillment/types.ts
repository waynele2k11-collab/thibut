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
  placement: "FRONT_CENTER" | "BACK_CENTER" | "LEFT_CHEST" | "SLEEVE_LEFT" | "SLEEVE_RIGHT";
  widthPx: number;
  heightPx: number;
  safeWidthPx: number;
  safeHeightPx: number;
  dpi: number;
  schemaJson: any;
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
  name: string; // e.g., "Standard", "Express"
  rateMinor: bigint;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}

export interface FulfillmentOrderRequest {
  externalId: string; // e.g. TB-10482
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
  id: string; // The provider's internal order ID
  externalId: string; // Thi Bút Order ID
  status: "DRAFT" | "PENDING" | "PROCESSING" | "IN_PRODUCTION" | "SHIPPED" | "DELIVERED" | "FAILED" | "CANCELLED";
  totalCostMinor: bigint;
  currency: string;
}

export interface FulfillmentEvent {
  type: "MOCKUP_COMPLETED" | "MOCKUP_FAILED" | "ORDER_SHIPPED" | "ORDER_FAILED" | "ORDER_CANCELED";
  externalEventId: string;
  payload: any;
}

export interface FulfillmentProvider {
  getProducts(): Promise<ProviderProduct[]>;
  getVariants(productId: string): Promise<ProviderVariant[]>;
  getPricing(variantId: string): Promise<ProviderPrice>;
  getPrintAreas(productId: string): Promise<PrintAreaMetadata[]>;
  generateMockups(input: MockupRequest): Promise<MockupJob>;
  getShippingRates(input: ShippingQuoteRequest): Promise<ShippingRate[]>;
  createDraftOrder(input: FulfillmentOrderRequest): Promise<ProviderOrder>;
  confirmOrder(providerOrderId: string): Promise<void>;
  cancelOrder(providerOrderId: string): Promise<void>;
  getOrder(providerOrderId: string): Promise<ProviderOrder>;
  parseWebhook(payload: unknown): Promise<FulfillmentEvent>;
}
