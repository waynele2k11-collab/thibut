"use client";

import Image from "next/image";
import { Check, Download, Grid, PackageX, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMinor } from "@/lib/money";
import { DIGITAL_TOTAL_MINOR } from "@/lib/pricing/quote";
import type { PlacementValue } from "@/lib/print/types";
import {
  extractProductColorOptions,
  extractSizesForSelectedColor,
  findVariantForColorSwitch,
} from "@/lib/studio/garmentSwatches";
import type { FulfillmentFormat } from "@/lib/studio/studioStore";
import type { ProductMock } from "./ProductSelectionModal";

const PLACEMENT_CARDS: ReadonlyArray<{
  value: PlacementValue;
  title: string;
  feeBadge: string;
}> = [
  { value: "front", title: "Center Front", feeBadge: "Included" },
  { value: "left_chest", title: "Left Chest", feeBadge: "Included" },
  { value: "back", title: "Full Back", feeBadge: "+$5.00" },
  { value: "both", title: "Front & Back", feeBadge: "+$9.00" },
];

export interface StepProductPanelProps {
  locked: boolean;
  isAdmin: boolean;
  fulfillmentFormat: FulfillmentFormat;
  onChangeFulfillmentFormat: (format: FulfillmentFormat) => void;
  products: readonly ProductMock[];
  selectedProduct?: ProductMock;
  selectedVariantId?: string;
  onSelectProductId: (productId: string) => void;
  onSelectVariantId: (variantId: string) => void;
  onOpenProductModal: () => void;
  placement: PlacementValue;
  onChangePlacement: (placement: PlacementValue) => void;
}

export function StepProductPanel({
  locked,
  isAdmin,
  fulfillmentFormat,
  onChangeFulfillmentFormat,
  products,
  selectedProduct,
  selectedVariantId,
  onSelectProductId,
  onSelectVariantId,
  onOpenProductModal,
  placement,
  onChangePlacement,
}: StepProductPanelProps) {
  const digitalPriceFormatted = formatMinor(DIGITAL_TOTAL_MINOR, "USD");

  const activeVariant =
    selectedProduct?.variants?.find((v) => v.id === selectedVariantId) ??
    selectedProduct?.variants?.[0];

  const colorOptions = extractProductColorOptions(selectedProduct);
  const activeColorKey = (
    (activeVariant?.color ?? "").trim() || "Paper White"
  ).toLowerCase();
  const activeColorOption =
    colorOptions.find((c) => c.key === activeColorKey) ?? colorOptions[0];

  const sizeVariants = extractSizesForSelectedColor(
    selectedProduct,
    activeColorKey
  );
  const hasDistinctSizes = sizeVariants.some((v) => Boolean(v.size?.trim()));

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <section>
          <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2.5">
            Edition Format
          </span>
          <Tabs
            value={fulfillmentFormat}
            onValueChange={(val) => {
              if (locked) return;
              if (val === "PHYSICAL" || val === "DIGITAL") {
                onChangeFulfillmentFormat(val);
              }
            }}
          >
            <TabsList aria-label="Fulfillment format" className="w-full grid grid-cols-2">
              <TabsTrigger value="PHYSICAL" disabled={locked} className="min-h-10 px-2">
                Physical Medium
              </TabsTrigger>
              <TabsTrigger value="DIGITAL" disabled={locked} className="min-h-10 px-2">
                Digital Master · {digitalPriceFormatted}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </section>
      )}

      {fulfillmentFormat === "DIGITAL" ? (
        <Card className="p-5 space-y-4 bg-surface-container-lowest">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="seal" className="mb-2">
                Instant 300 DPI Master
              </Badge>
              <h3 className="font-headline-sm text-headline-sm text-primary">
                Museum-Grade Print File
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant mt-1 leading-relaxed">
                Server-rendered directly from vector outlines at{" "}
                <strong className="text-on-background">4500 × 5400 px (300 DPI)</strong>{" "}
                transparent PNG — ready for fine-art framing, archival giclée printing, or personal keepsakes.
              </p>
            </div>
            <Download className="w-6 h-6 text-secondary shrink-0" aria-hidden="true" />
          </div>

          <ul className="space-y-2 pt-3 border-t border-surface-variant font-body-md text-xs text-on-surface-variant">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>Exact 15&Prime; × 18&Prime; @ 300 DPI lossless transparent PNG</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>Includes Personal Digital &amp; Archival Print License</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>No shipping wait — signed download unlocked after checkout</span>
            </li>
          </ul>
        </Card>
      ) : products.length === 0 || !selectedProduct ? (
        <Card className="p-5 bg-surface-container-lowest flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <PackageX
              className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-body-md text-sm font-semibold text-on-surface">
                Physical blanks refreshing
              </p>
              <p className="font-body-md text-xs text-on-surface-variant mt-1 leading-relaxed">
                Apparel and gallery prints are syncing. Switch to the{" "}
                <strong className="text-on-background">300 DPI Digital Master ({digitalPriceFormatted})</strong>{" "}
                to download your high-resolution calligraphy immediately, or save your session draft.
              </p>
            </div>
          </div>
          {!isAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={locked}
              onClick={() => onChangeFulfillmentFormat("DIGITAL")}
              className="w-full"
            >
              Switch to 300 DPI Digital Master ({digitalPriceFormatted})
            </Button>
          )}
        </Card>
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                Product Blank
              </span>
              {products.length > 1 && (
                <button
                  type="button"
                  disabled={locked}
                  onClick={onOpenProductModal}
                  className="inline-flex items-center gap-1 font-label-caps text-[10px] uppercase text-secondary hover:underline cursor-pointer"
                >
                  <Grid className="w-3 h-3" aria-hidden="true" />
                  All ({products.length})
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
              {products.slice(0, 5).map((product) => {
                const isSelected = product.id === selectedProduct.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={locked}
                    onClick={() => onSelectProductId(product.id)}
                    className={`shrink-0 min-h-11 px-4 py-2 rounded-lg border font-label-caps text-label-caps uppercase transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                      isSelected
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary"
                    }`}
                  >
                    {product.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 p-3 rounded-lg bg-surface-container-lowest border border-surface-variant flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-surface-container overflow-hidden relative shrink-0 border border-surface-variant">
                <Image
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body-md text-sm font-semibold text-on-background truncate">
                  {selectedProduct.name}
                </p>
                <p className="font-body-md text-xs text-on-surface-variant line-clamp-1">
                  {selectedProduct.description}
                </p>
              </div>
            </div>
          </section>

          {colorOptions.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Material Color
                </span>
                <span className="font-body-md text-xs font-medium text-on-background">
                  {activeColorOption?.label ?? "Standard"}
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="Material color"
                className="flex items-center gap-3 flex-wrap"
              >
                {colorOptions.map((colorOpt) => {
                  const selected = colorOpt.key === activeColorOption?.key;
                  return (
                    <button
                      key={colorOpt.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Material color ${colorOpt.label}`}
                      disabled={locked}
                      onClick={() => {
                        const nextVariantId = findVariantForColorSwitch(
                          selectedProduct,
                          colorOpt.key,
                          activeVariant?.size
                        );
                        if (nextVariantId) {
                          onSelectVariantId(nextVariantId);
                        }
                      }}
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform motion-reduce:transition-none motion-reduce:transform-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                        colorOpt.swatchClass
                      } ${
                        selected
                          ? "ring-2 ring-offset-2 ring-primary ring-offset-surface-container-low scale-105"
                          : "hover:scale-105"
                      }`}
                    >
                      {selected && (
                        <Check
                          className={`w-4 h-4 ${colorOpt.checkClass}`}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {hasDistinctSizes && sizeVariants.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Size
                </span>
                <span className="font-body-md text-xs text-on-surface-variant">
                  {activeVariant?.size ? `Selected: ${activeVariant.size}` : "Standard Fit"}
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="Garment size"
                className="grid grid-cols-4 gap-2"
              >
                {sizeVariants.map((variant) => {
                  const isSelected = variant.id === activeVariant?.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={locked}
                      onClick={() => onSelectVariantId(variant.id)}
                      className={`min-h-11 py-2.5 px-2 rounded-lg text-center font-body-md text-sm transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                        isSelected
                          ? "border-2 border-primary bg-primary text-on-primary font-semibold"
                          : "border border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary"
                      }`}
                    >
                      {variant.size || "One Size"}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2.5">
              Artwork Placement
            </span>
            <div
              role="radiogroup"
              aria-label="Artwork print placement"
              className="grid grid-cols-2 gap-2"
            >
              {PLACEMENT_CARDS.map((card) => {
                const selected = placement === card.value;
                return (
                  <button
                    key={card.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={locked}
                    onClick={() => onChangePlacement(card.value)}
                    className={`min-h-13 p-3 rounded-lg border text-left flex flex-col justify-between transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                      selected
                        ? "border-2 border-primary bg-surface-container-lowest"
                        : "border-surface-variant bg-surface-container-lowest hover:border-outline"
                    }`}
                  >
                    <span className="font-label-caps text-[11px] uppercase text-on-background">
                      {card.title}
                    </span>
                    <span className="font-body-md text-xs text-on-surface-variant mt-0.5">
                      {card.feeBadge}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
