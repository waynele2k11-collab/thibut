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

  async getStoreProducts(): Promise<any> {
    const url = "https://api.printful.com/store/products";
    console.log("[PrintfulProvider] Fetching products from Printful Store");
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Printful getStoreProducts failed: ${response.status}`);
    }
    return response.json();
  }

  async getProductDetails(externalProductId: string): Promise<any> {
    const url = `https://api.printful.com/store/products/${externalProductId}`;
    console.log(`[PrintfulProvider] Fetching details for product ${externalProductId}`);
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Printful getProductDetails failed: ${response.status}`);
    }
    return response.json();
  }

  async getCatalogProductDetails(productId: string | number): Promise<any> {
    const url = `https://api.printful.com/products/${productId}`;
    console.log(`[PrintfulProvider] Fetching catalog details for product ${productId}`);
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Printful getCatalogProductDetails failed: ${response.status}`);
    }
    return response.json();
  }

  async generateBlankMockups(productId: string | number, variantIds: number[]): Promise<any> {
    const url = `https://api.printful.com/mockup-generator/create-task/${productId}`;
    console.log(`[PrintfulProvider] Generating blank mockups for product ${productId}`);
    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        variant_ids: variantIds,
        format: "jpg",
        files: [] // Empty files array natively requests blank mockups
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Printful generateBlankMockups failed: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  async getMockupTaskResult(taskKey: string): Promise<any> {
    const url = `https://api.printful.com/mockup-generator/task?task_key=${taskKey}`;
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Printful getMockupTaskResult failed: ${response.status}`);
    }
    return response.json();
  }
}
