import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { parseUsdDecimalToMinor } from "@/lib/pricing/quote";
import type {
  FulfillmentEvent,
  FulfillmentEventType,
  FulfillmentOrderRequest,
  FulfillmentProvider,
  MockupJob,
  MockupRequest,
  PrintAreaMetadata,
  PrintfulCatalogProductDetailsResponse,
  PrintfulStoreProductDetailsResult,
  PrintfulStoreProductSummary,
  ProviderOrder,
  ProviderPrice,
  ProviderProduct,
  ProviderVariant,
  ShippingQuoteRequest,
  ShippingRate,
} from "./types";

export const PrintfulWebhookOrderSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    external_id: z.string().optional(),
  })
  .passthrough();

export const PrintfulWebhookPayloadSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    type: z.string().min(1).max(120),
    created: z.number().int().nonnegative().optional(),
    retries: z.number().int().nonnegative().optional(),
    store: z.number().int().optional(),
    data: z
      .object({
        order: PrintfulWebhookOrderSchema.optional(),
        shipment: z.record(z.string(), z.unknown()).optional(),
        task_key: z.string().optional(),
        mockups: z.array(z.record(z.string(), z.unknown())).optional(),
        reason: z.string().optional(),
      })
      .passthrough()
      .optional(),
    order: PrintfulWebhookOrderSchema.optional(),
  })
  .passthrough();

export type PrintfulWebhookPayload = z.infer<typeof PrintfulWebhookPayloadSchema>;

function formatMinorForPrintfulDecimal(minor: bigint): string {
  const abs = minor < 0n ? -minor : minor;
  const dollars = abs / 100n;
  const cents = (abs % 100n).toString().padStart(2, "0");
  return `${minor < 0n ? "-" : ""}${dollars.toString()}.${cents}`;
}

interface RawPrintfulProductItem {
  id: string | number;
  title?: string;
  name?: string;
  type?: string;
  description?: string;
  image?: string;
}

interface RawPrintfulShippingRate {
  id: string;
  name: string;
  rate: string | number;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}

interface RawPrintfulOrderResponse {
  result: {
    id: string | number;
    external_id: string;
    status: string;
    costs: {
      total: string | number;
      currency: string;
    };
  };
}

export class PrintfulProvider implements FulfillmentProvider {
  private readonly baseUrl = "https://api.printful.com";

  private get headers(): Record<string, string> {
    const token = process.env.PRINTFUL_ACCESS_TOKEN || process.env.PRINTFUL_API_KEY;
    if (!token) {
      throw new Error(
        "PRINTFUL_ACCESS_TOKEN or PRINTFUL_API_KEY environment variable is missing."
      );
    }

    const hdrs: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const storeId = process.env.PRINTFUL_STORE_ID?.trim();
    if (storeId) {
      hdrs["X-PF-Store-Id"] = storeId;
    }

    return hdrs;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Printful API Error: ${res.status} ${res.statusText}`, text);
      throw new Error(`Printful API Error ${res.status}`);
    }

    return (await res.json()) as T;
  }

  async getProducts(): Promise<ProviderProduct[]> {
    const data = await this.request<{ result: RawPrintfulProductItem[] }>("/products");

    return (data.result ?? []).map((p) => ({
      id: String(p.id),
      name: p.title || p.name || `Product ${String(p.id)}`,
      category: p.type || "apparel",
      description: p.description || "",
      imageUrls: p.image ? [p.image] : [],
    }));
  }

  async getStoreProducts(): Promise<{ result: PrintfulStoreProductSummary[] }> {
    return this.request<{ result: PrintfulStoreProductSummary[] }>("/store/products");
  }

  async getProductDetails(
    productId: string | number
  ): Promise<{ result: PrintfulStoreProductDetailsResult }> {
    return this.request<{ result: PrintfulStoreProductDetailsResult }>(
      `/store/products/${productId}`
    );
  }

  async getCatalogProductDetails(
    productId: string | number
  ): Promise<PrintfulCatalogProductDetailsResponse> {
    return this.request<PrintfulCatalogProductDetailsResponse>(
      `/products/${productId}`
    );
  }

  async generateBlankMockups(
    productId: string | number,
    variantIds: number[],
    placement: string = "default"
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/mockup-generator/create-task/${productId}`,
      {
        method: "POST",
        body: JSON.stringify({
          variant_ids: variantIds,
          format: "jpg",
          files: [
            {
              placement,
              image_url:
                "https://raw.githubusercontent.com/mathiasbynens/transparent-pixels/master/transparent.png",
              position: {
                area_width: 100,
                area_height: 100,
                width: 1,
                height: 1,
                top: 0,
                left: 0,
              },
            },
          ],
        }),
      }
    );
  }

  async getMockupTaskResult(taskKey: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`
    );
  }

  async getVariants(productId: string): Promise<ProviderVariant[]> {
    const data = await this.getCatalogProductDetails(productId);

    return (data.result?.variants ?? []).map((v) => ({
      id: String(v.id),
      productId: String(v.product_id ?? productId),
      name: v.name,
      sku: v.sku || `PF-${v.id}`,
      color: v.color || v.color_code || "",
      colorHex: v.color_code || v.colorHex || undefined,
      size: v.size || "Standard",
      priceMinor: parseUsdDecimalToMinor(v.price),
      currency: "USD",
      inStock: Boolean(v.in_stock),
      imageUrls: v.image ? [v.image] : [],
    }));
  }

  async getPricing(variantId: string): Promise<ProviderPrice> {
    const data = await this.request<{
      result: { variant: { price: string | number; currency?: string } };
    }>(`/products/variant/${variantId}`);

    return {
      variantId,
      priceMinor: parseUsdDecimalToMinor(data.result.variant.price),
      currency: (data.result.variant.currency || "USD").toUpperCase(),
    };
  }

  async getPrintAreas(): Promise<PrintAreaMetadata[]> {
    return [
      {
        placement: "FRONT_CENTER",
        widthPx: 3600,
        heightPx: 4800,
        safeWidthPx: 3000,
        safeHeightPx: 4000,
        dpi: 300,
        schemaJson: {},
      },
    ];
  }

  async generateMockups(input: MockupRequest): Promise<MockupJob> {
    const payload = {
      variant_ids: [Number.parseInt(input.variantId, 10)],
      format: "png",
      files: [
        {
          placement: input.placement.toLowerCase(),
          image_url: input.assetUrl,
        },
      ],
    };

    const data = await this.request<{ result: { task_key: string } }>(
      "/mockup-generator/create-task/1",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    return {
      taskId: data.result.task_key,
      status: "PENDING",
    };
  }

  async getShippingRates(input: ShippingQuoteRequest): Promise<ShippingRate[]> {
    const payload = {
      recipient: {
        address1: input.recipient.address1,
        city: input.recipient.city,
        country_code: input.recipient.countryCode,
        state_code: input.recipient.stateCode,
        zip: input.recipient.zip,
      },
      items: input.variantIds.map((vid, idx) => ({
        variant_id: Number.parseInt(vid, 10),
        quantity: input.quantities[idx],
      })),
    };

    const data = await this.request<{ result: RawPrintfulShippingRate[] }>(
      "/shipping/rates",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    return (data.result ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      rateMinor: parseUsdDecimalToMinor(r.rate),
      currency: (r.currency || "USD").toUpperCase(),
      minDeliveryDays: r.minDeliveryDays,
      maxDeliveryDays: r.maxDeliveryDays,
    }));
  }

  async createDraftOrder(input: FulfillmentOrderRequest): Promise<ProviderOrder> {
    const payload = {
      external_id: input.externalId,
      recipient: {
        name: input.recipient.name,
        company: input.recipient.company,
        address1: input.recipient.address1,
        address2: input.recipient.address2,
        city: input.recipient.city,
        state_code: input.recipient.stateCode,
        country_code: input.recipient.countryCode,
        zip: input.recipient.zip,
        phone: input.recipient.phone,
        email: input.recipient.email,
      },
      items: input.items.map((item) => ({
        variant_id: Number.parseInt(item.variantId, 10),
        quantity: item.quantity,
        retail_price:
          item.retailPriceMinor !== undefined
            ? formatMinorForPrintfulDecimal(item.retailPriceMinor)
            : undefined,
        files: item.files.map((f) => ({
          url: f.url,
          placement: f.placement.toLowerCase(),
        })),
      })),
    };

    const data = await this.request<RawPrintfulOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify({ ...payload, confirm: false }),
    });

    return {
      id: String(data.result.id),
      externalId: data.result.external_id,
      status: "DRAFT",
      totalCostMinor: parseUsdDecimalToMinor(data.result.costs.total),
      currency: (data.result.costs.currency || "USD").toUpperCase(),
    };
  }

  async confirmOrder(providerOrderId: string): Promise<void> {
    await this.request<unknown>(`/orders/${providerOrderId}/confirm`, {
      method: "POST",
    });
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    await this.request<unknown>(`/orders/${providerOrderId}`, {
      method: "DELETE",
    });
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrder> {
    const data = await this.request<RawPrintfulOrderResponse>(
      `/orders/${providerOrderId}`
    );

    let mappedStatus: ProviderOrder["status"] = "PENDING";
    switch (data.result.status) {
      case "draft":
        mappedStatus = "DRAFT";
        break;
      case "pending":
        mappedStatus = "PENDING";
        break;
      case "inprocess":
        mappedStatus = "IN_PRODUCTION";
        break;
      case "fulfilled":
        mappedStatus = "SHIPPED";
        break;
      case "canceled":
        mappedStatus = "CANCELLED";
        break;
      case "failed":
        mappedStatus = "FAILED";
        break;
      default:
        mappedStatus = "PENDING";
    }

    return {
      id: String(data.result.id),
      externalId: data.result.external_id,
      status: mappedStatus,
      totalCostMinor: parseUsdDecimalToMinor(data.result.costs.total),
      currency: (data.result.costs.currency || "USD").toUpperCase(),
    };
  }

  async parseWebhook(
    rawInput: unknown,
    rawBodyText?: string
  ): Promise<FulfillmentEvent> {
    const parsed = PrintfulWebhookPayloadSchema.parse(rawInput);

    const resolvedOrder = parsed.data?.order ?? parsed.order;
    const orderExternalId =
      resolvedOrder?.external_id?.trim() ||
      (resolvedOrder?.id !== undefined ? String(resolvedOrder.id) : undefined) ||
      parsed.data?.task_key?.trim() ||
      undefined;

    let externalEventId: string;
    if (parsed.created !== undefined && orderExternalId) {
      externalEventId = `${parsed.type}:${parsed.created}:${orderExternalId}`;
    } else {
      const canonical = rawBodyText ?? JSON.stringify(parsed);
      const digest = crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
      externalEventId = `${parsed.type}:sha256:${digest}`;
    }

    let mappedType: FulfillmentEventType;
    switch (parsed.type) {
      case "package_shipped":
        mappedType = "ORDER_SHIPPED";
        break;
      case "order_failed":
        mappedType = "ORDER_FAILED";
        break;
      case "order_canceled":
      case "order_cancelled":
        mappedType = "ORDER_CANCELED";
        break;
      case "mockup_task_finished":
        mappedType = "MOCKUP_COMPLETED";
        break;
      default:
        // Unknown events MUST be ignored, NEVER mapped to ORDER_FAILED (T-107)
        mappedType = "IGNORED";
    }

    return {
      type: mappedType,
      rawType: parsed.type,
      externalEventId,
      orderExternalId: resolvedOrder?.external_id?.trim() || undefined,
      payload: {
        order: resolvedOrder,
        shipment: parsed.data?.shipment,
        task_key: parsed.data?.task_key,
        mockups: parsed.data?.mockups,
        reason: parsed.data?.reason,
      },
    };
  }
}
