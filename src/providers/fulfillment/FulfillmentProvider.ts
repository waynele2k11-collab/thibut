export interface FulfillmentProvider {
  createOrder(orderData: any): Promise<any>;
  calculateShipping(address: any, items: any[]): Promise<any>;
  getStoreProducts(): Promise<any>;
  getProductDetails(externalProductId: string): Promise<any>;
  getCatalogProductDetails(productId: string | number): Promise<any>;
  generateBlankMockups(productId: string | number, variantIds: number[]): Promise<any>;
  getMockupTaskResult(taskKey: string): Promise<any>;
}
