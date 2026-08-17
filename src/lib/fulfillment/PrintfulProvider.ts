import {
  FulfillmentProvider,
  ProviderProduct,
  ProviderVariant,
  ProviderPrice,
  PrintAreaMetadata,
  MockupRequest,
  MockupJob,
  ShippingQuoteRequest,
  ShippingRate,
  FulfillmentOrderRequest,
  ProviderOrder,
  FulfillmentEvent
} from "./types";

export class PrintfulProvider implements FulfillmentProvider {
  private readonly baseUrl = "https://api.printful.com";

  private get headers() {
    const token = process.env.PRINTFUL_ACCESS_TOKEN || process.env.PRINTFUL_API_KEY;
    if (!token) {
      throw new Error("PRINTFUL_ACCESS_TOKEN or PRINTFUL_API_KEY environment variable is missing.");
    }
    return {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-PF-Store-Id": process.env.PRINTFUL_STORE_ID || "",
    };
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // In local MVP testing, we might want to stub if token isn't fully active
    // But since the token was provided, we'll try to use it for real.
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Printful API Error: ${res.status} ${res.statusText}`, text);
      throw new Error(`Printful API Error ${res.status}: ${text}`);
    }

    return await res.json();
  }

  async getProducts(): Promise<ProviderProduct[]> {
    // Printful Catalog API v2 (or v1 depending on exact endpoint availability)
    const data = await this.request("/products");
    
    // Map Printful response to our ProviderProduct format
    return data.result.map((p: any) => ({
      id: String(p.id),
      name: p.title || p.name,
      category: p.type || "apparel",
      description: p.description || "",
      imageUrls: [p.image || ""]
    }));
  }

  async getVariants(productId: string): Promise<ProviderVariant[]> {
    const data = await this.request(`/products/${productId}`);
    
    return data.result.variants.map((v: any) => ({
      id: String(v.id),
      productId: String(v.product_id),
      name: v.name,
      sku: v.sku,
      color: v.color || v.color_code || "",
      size: v.size,
      priceMinor: BigInt(Math.round(parseFloat(v.price) * 100)),
      currency: "USD", // Assuming USD for now
      inStock: v.in_stock,
      imageUrls: [v.image]
    }));
  }

  async getPricing(variantId: string): Promise<ProviderPrice> {
    // Usually bundled in variants, but if we need live quotes:
    // (This is a simplified stub, Printful exposes price in variant details)
    const data = await this.request(`/products/variant/${variantId}`);
    return {
      variantId,
      priceMinor: BigInt(Math.round(parseFloat(data.result.variant.price) * 100)),
      currency: data.result.variant.currency || "USD"
    };
  }

  async getPrintAreas(productId: string): Promise<PrintAreaMetadata[]> {
    // Mock mapping - Printful doesn't expose clean "safe width" via one simple endpoint often
    return [
      {
        placement: "FRONT_CENTER",
        widthPx: 3600,
        heightPx: 4800,
        safeWidthPx: 3000,
        safeHeightPx: 4000,
        dpi: 300,
        schemaJson: {}
      }
    ];
  }

  async generateMockups(input: MockupRequest): Promise<MockupJob> {
    const payload = {
      variant_ids: [parseInt(input.variantId, 10)],
      format: "png",
      files: [
        {
          placement: input.placement.toLowerCase(),
          image_url: input.assetUrl,
        }
      ]
    };

    const data = await this.request("/mockup-generator/create-task/1", { // Assuming product ID 1 for URL struct
      method: "POST",
      body: JSON.stringify(payload)
    });

    return {
      taskId: data.result.task_key,
      status: "PENDING"
    };
  }

  async getShippingRates(input: ShippingQuoteRequest): Promise<ShippingRate[]> {
    const payload = {
      recipient: {
        address1: input.recipient.address1,
        city: input.recipient.city,
        country_code: input.recipient.countryCode,
        state_code: input.recipient.stateCode,
        zip: input.recipient.zip
      },
      items: input.variantIds.map((vid, idx) => ({
        variant_id: parseInt(vid, 10),
        quantity: input.quantities[idx]
      }))
    };

    const data = await this.request("/shipping/rates", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    return data.result.map((r: any) => ({
      id: r.id,
      name: r.name,
      rateMinor: BigInt(Math.round(parseFloat(r.rate) * 100)),
      currency: r.currency,
      minDeliveryDays: r.minDeliveryDays,
      maxDeliveryDays: r.maxDeliveryDays
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
      items: input.items.map(item => ({
        variant_id: parseInt(item.variantId, 10),
        quantity: item.quantity,
        retail_price: item.retailPriceMinor ? (Number(item.retailPriceMinor) / 100).toFixed(2) : undefined,
        files: item.files.map(f => ({
          url: f.url,
          placement: f.placement.toLowerCase() // "front", "back"
        }))
      }))
    };

    const data = await this.request("/orders", {
      method: "POST",
      // confirm: false creates a draft
      body: JSON.stringify({ ...payload, confirm: false }) 
    });

    return {
      id: String(data.result.id),
      externalId: data.result.external_id,
      status: "DRAFT",
      totalCostMinor: BigInt(Math.round(parseFloat(data.result.costs.total) * 100)),
      currency: data.result.costs.currency
    };
  }

  async confirmOrder(providerOrderId: string): Promise<void> {
    await this.request(`/orders/${providerOrderId}/confirm`, {
      method: "POST"
    });
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    await this.request(`/orders/${providerOrderId}`, {
      method: "DELETE"
    });
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrder> {
    const data = await this.request(`/orders/${providerOrderId}`);
    
    // Map Printful statuses to ours
    let mappedStatus: ProviderOrder["status"] = "PENDING";
    switch (data.result.status) {
      case "draft": mappedStatus = "DRAFT"; break;
      case "pending": mappedStatus = "PENDING"; break;
      case "inprocess": mappedStatus = "IN_PRODUCTION"; break;
      case "fulfilled": mappedStatus = "SHIPPED"; break;
      case "canceled": mappedStatus = "CANCELLED"; break;
      case "failed": mappedStatus = "FAILED"; break;
      default: mappedStatus = "PENDING";
    }

    return {
      id: String(data.result.id),
      externalId: data.result.external_id,
      status: mappedStatus,
      totalCostMinor: BigInt(Math.round(parseFloat(data.result.costs.total) * 100)),
      currency: data.result.costs.currency
    };
  }

  async parseWebhook(payload: any): Promise<FulfillmentEvent> {
    // Printful wraps events in type
    const type = payload.type;

    let mappedType: FulfillmentEvent["type"] = "ORDER_FAILED";
    if (type === "mockup_task_finished") mappedType = "MOCKUP_COMPLETED";
    if (type === "package_shipped") mappedType = "ORDER_SHIPPED";
    if (type === "order_canceled") mappedType = "ORDER_CANCELED";
    if (type === "order_failed") mappedType = "ORDER_FAILED";

    return {
      type: mappedType,
      externalEventId: payload.id || payload.type,
      payload: payload.data
    };
  }
}
