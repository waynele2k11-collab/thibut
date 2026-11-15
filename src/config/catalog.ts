import { PricingBreakdown } from "@/lib/pricing/engine";

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
  mockup: string;
}

export interface ProductConfig {
  id: string;
  name: string;
  price: number; // Keep for backwards compatibility, but represents base retail price
  pricing?: PricingBreakdown; // Authoritative pricing breakdown
  category: "apparel" | "wall_art" | "merch" | "digital";
  sizes: string[];
  colors: ProductColor[];
  defaultSize: string;
  defaultColor: string;
  supportedPlacements?: ("front" | "back")[];
  printArea?: {
    topPct: number;
    leftPct: number;
    widthPct: number;
    heightPct: number;
  };
}

export const PRODUCT_CATALOG: Record<string, ProductConfig> = {
  "Premium Hoodie": {
    id: "Premium Hoodie",
    name: "Premium Heavyweight Hoodie",
    price: 99.00,
    category: "apparel",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: [
      { id: "bone-white", name: "Bone White", hex: "#F6F1E7", mockup: "/mockups/printful/premium-hoodie-white.jpg" },
      { id: "pitch-black", name: "Pitch Black", hex: "#111111", mockup: "/mockups/printful/premium-hoodie-black.jpg" },
      { id: "heather-grey", name: "Heather Grey", hex: "#A8A8A8", mockup: "/mockups/printful/premium-hoodie-grey.jpg" },
    ],
    defaultSize: "L",
    defaultColor: "Bone White",
    supportedPlacements: ["front", "back"],
    printArea: { topPct: 22, leftPct: 26, widthPct: 48, heightPct: 58 },
  },
  "Classic T-Shirt": {
    id: "Classic T-Shirt",
    name: "Classic Organic Cotton T-Shirt",
    price: 45.00,
    category: "apparel",
    sizes: ["XS", "S", "M", "L", "XL", "2XL"],
    colors: [
      { id: "bone-white", name: "Bone White", hex: "#F6F1E7", mockup: "/mockups/printful/classic-t-shirt-white.jpg" },
      { id: "pitch-black", name: "Pitch Black", hex: "#111111", mockup: "/mockups/printful/classic-t-shirt-black.jpg" },
      { id: "slate-navy", name: "Slate Navy", hex: "#1E293B", mockup: "/mockups/printful/classic-t-shirt-navy.jpg" },
    ],
    defaultSize: "L",
    defaultColor: "Bone White",
    supportedPlacements: ["front", "back"],
    printArea: { topPct: 20, leftPct: 25, widthPct: 50, heightPct: 62 },
  },
  "Fine Art Poster": {
    id: "Fine Art Poster",
    name: "Archival Fine Art Poster",
    price: 25.00,
    category: "wall_art",
    sizes: ["12x16 in", "18x24 in", "24x36 in"],
    colors: [
      { id: "natural-matte", name: "Natural Matte", hex: "#FAF8F5", mockup: "/mockups/printful/fine-art-poster.jpg" },
      { id: "gallery-black", name: "Gallery Black", hex: "#111111", mockup: "/mockups/printful/fine-art-poster.jpg" },
    ],
    defaultSize: "18x24 in",
    defaultColor: "Natural Matte",
    printArea: { topPct: 10, leftPct: 10, widthPct: 80, heightPct: 80 },
  },
  "Canvas Print": {
    id: "Canvas Print",
    name: "Gallery Stretched Canvas",
    price: 49.00,
    category: "wall_art",
    sizes: ["12x16 in", "16x20 in", "18x24 in", "24x36 in"],
    colors: [
      { id: "museum-wrap", name: "Museum Wrap", hex: "#F6F1E7", mockup: "/mockups/printful/canvas-print.jpg" },
      { id: "black-frame", name: "Floating Frame", hex: "#111111", mockup: "/mockups/printful/canvas-print.jpg" },
    ],
    defaultSize: "18x24 in",
    defaultColor: "Museum Wrap",
    printArea: { topPct: 5, leftPct: 5, widthPct: 90, heightPct: 90 },
  },
  "Tote Bag": {
    id: "Tote Bag",
    name: "Heavy Cotton Canvas Tote",
    price: 29.00,
    category: "merch",
    sizes: ["Standard (15x16 in)"],
    colors: [
      { id: "natural-canvas", name: "Natural Canvas", hex: "#EAE4DA", mockup: "/mockups/printful/tote-bag-natural.jpg" },
      { id: "black-canvas", name: "Black Canvas", hex: "#111111", mockup: "/mockups/printful/tote-bag-black.jpg" },
    ],
    defaultSize: "Standard (15x16 in)",
    defaultColor: "Natural Canvas",
    printArea: { topPct: 15, leftPct: 15, widthPct: 70, heightPct: 70 },
  },
  "Coffee Mug": {
    id: "Coffee Mug",
    name: "Artisan Ceramic Mug",
    price: 19.00,
    category: "merch",
    sizes: ["11 oz", "15 oz"],
    colors: [
      { id: "glossy-white", name: "Glossy White", hex: "#FFFFFF", mockup: "/mockups/printful/coffee-mug-white.jpg" },
      { id: "matte-black", name: "Matte Black", hex: "#181818", mockup: "/mockups/printful/coffee-mug-black.jpg" },
    ],
    defaultSize: "15 oz",
    defaultColor: "Glossy White",
    printArea: { topPct: 20, leftPct: 35, widthPct: 30, heightPct: 60 },
  },
  "Digital Download (All 6)": {
    id: "Digital Download (All 6)",
    name: "Ultra-HD Vector Master Files",
    price: 9.99,
    category: "digital",
    sizes: ["4500x5400 px @ 300 DPI"],
    colors: [
      { id: "vector-svg", name: "Lossless Vector", hex: "#B3261E", mockup: "" },
    ],
    defaultSize: "4500x5400 px @ 300 DPI",
    defaultColor: "Lossless Vector",
    printArea: { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 },
  },
};
