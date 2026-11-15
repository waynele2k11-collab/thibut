/**
 * Thi Bút Cart Store — localStorage persistence
 * Stores cart items client-side. No login required.
 */

export interface CartItem {
  id: string;
  variantId: string;
  designDataUrl: string;
  productName: string;
  variantLabel: string;
  price: number;
  quantity: number;
  previewSvg: string;
  config: {
    text: string;
    fontFamily: string;
    inkColor: string;
    hasSeal: boolean;
    layoutMode: string;
    tradition: string;
  };
  addedAt: string;
}

const CART_KEY = "thibut_cart_v1";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToCart(item: Omit<CartItem, "id" | "addedAt">): CartItem {
  const cart = getCart();
  const newItem: CartItem = {
    ...item,
    id: `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    addedAt: new Date().toISOString(),
  };
  const updated = [...cart, newItem];
  localStorage.setItem(CART_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("thibut-cart-update", { detail: updated }));
  return newItem;
}

export function removeFromCart(id: string): CartItem[] {
  const updated = getCart().filter((item) => item.id !== id);
  localStorage.setItem(CART_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("thibut-cart-update", { detail: updated }));
  return updated;
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new CustomEvent("thibut-cart-update", { detail: [] }));
}

export function getCartCount(): number {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}
