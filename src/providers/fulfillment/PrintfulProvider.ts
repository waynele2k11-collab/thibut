import { FulfillmentProvider } from "./FulfillmentProvider";

export class PrintfulProvider implements FulfillmentProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.PRINTFUL_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[PrintfulProvider] WARNING: PRINTFUL_API_KEY is not set in environment.");
    }
  }

  async createOrder(orderData: any): Promise<any> {
    const url = "https://api.printful.com/orders";
    console.log("[PrintfulProvider] Creating order with data:", orderData);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[PrintfulProvider] createOrder failed:", error);
      throw new Error(`Printful createOrder failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async calculateShipping(address: any, items: any[]): Promise<any> {
    const url = "https://api.printful.com/shipping/rates";
    console.log("[PrintfulProvider] Calculating shipping for", items.length, "items");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient: address, items }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[PrintfulProvider] calculateShipping failed:", error);
      throw new Error(`Printful calculateShipping failed: ${response.status}`);
    }
    return response.json();
  }

  async syncProducts(): Promise<any> {
    const url = "https://api.printful.com/sync/products";
    console.log("[PrintfulProvider] Syncing products from Printful Catalog");
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Printful syncProducts failed: ${response.status}`);
    }
    return response.json();
  }
}
