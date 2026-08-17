export interface FulfillmentProvider {
  createOrder(orderData: any): Promise<any>;
  calculateShipping(address: any, items: any[]): Promise<any>;
  syncProducts(): Promise<any>;
}
