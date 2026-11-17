"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { CheckCircle, Loader2, Search, XCircle } from "lucide-react";
import type { ProviderProduct } from "@/lib/fulfillment/types";
import {
  importPrintfulProductAction,
  toggleProductStatusAction,
  type ImportedProductStatusEntry,
} from "@/app/actions/printful-admin";
import { formatMinor } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProductsGridProps {
  products: ProviderProduct[];
  statusMap: Record<string, ImportedProductStatusEntry>;
}

export function ProductsGrid({ products, statusMap }: ProductsGridProps) {
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"discover" | "synced">("discover");
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const filteredProducts = products.filter((p) => {
    const isImported = Boolean(statusMap[p.id]);
    if (activeTab === "synced" && !isImported) return false;

    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleImport = async (productId: string) => {
    setLoadingMap((prev) => ({ ...prev, [productId]: true }));
    const res = await importPrintfulProductAction(productId);
    setLoadingMap((prev) => ({ ...prev, [productId]: false }));

    if (!res.success) {
      alert(`Failed to import: ${res.error}`);
    }
  };

  const handleToggle = async (
    productId: string,
    slug: string,
    currentStatus: string
  ) => {
    setLoadingMap((prev) => ({ ...prev, [productId]: true }));
    const res = await toggleProductStatusAction(slug, currentStatus);
    setLoadingMap((prev) => ({ ...prev, [productId]: false }));

    if (!res.success) {
      alert(`Failed to toggle status: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(next) =>
            setActiveTab(next === "synced" ? "synced" : "discover")
          }
          className="w-full sm:w-auto"
        >
          <TabsList aria-label="Catalog view" className="w-full sm:w-auto">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="synced">Synced</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <label htmlFor={searchInputId} className="sr-only">
            Search Printful catalog
          </label>
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none"
            aria-hidden="true"
          />
          <Input
            id={searchInputId}
            type="search"
            placeholder={
              activeTab === "synced"
                ? "Search your synced products..."
                : "Search Printful catalog by name, ID, or category..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const importedData = statusMap[product.id];
          const isImported = Boolean(importedData);
          const isActive = importedData?.status === "ACTIVE";
          const isLoading = Boolean(loadingMap[product.id]);
          const displayCost =
            importedData?.formattedCost ??
            (importedData?.priceMinor
              ? formatMinor(importedData.priceMinor, "USD")
              : null);

          return (
            <Card key={product.id} className="overflow-hidden flex flex-col">
              <div className="aspect-square relative bg-surface-container-low p-4 flex items-center justify-center">
                {product.imageUrls[0] ? (
                  <Image
                    src={product.imageUrls[0]}
                    alt={product.name}
                    width={400}
                    height={400}
                    unoptimized
                    className="max-w-full max-h-full w-auto h-auto object-contain mix-blend-multiply"
                  />
                ) : (
                  <div className="text-on-surface-variant font-label-caps text-label-caps uppercase">
                    No Image
                  </div>
                )}

                {isImported && (
                  <Badge
                    variant={isActive ? "default" : "outline"}
                    className="absolute top-3 right-3 gap-1"
                  >
                    {isActive ? (
                      <CheckCircle className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <XCircle className="w-3 h-3" aria-hidden="true" />
                    )}
                    {isActive ? "Active" : "Disabled"}
                  </Badge>
                )}
              </div>

              <div className="p-4 border-t border-surface-variant flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                    ID: {product.id} &bull; {product.category}
                  </span>
                  {isImported && displayCost && (
                    <span className="font-body-md text-sm font-semibold text-primary shrink-0">
                      {displayCost}
                    </span>
                  )}
                </div>
                <h3 className="font-body-md text-body-md font-semibold text-on-surface line-clamp-2 leading-tight min-h-10 mb-4">
                  {product.name}
                </h3>

                <div className="mt-auto flex gap-2">
                  {!isImported ? (
                    <Button
                      onClick={() => handleImport(product.id)}
                      disabled={isLoading}
                      size="sm"
                      className="flex-1"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        "Sync & Enable"
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant={isActive ? "outline" : "primary"}
                      size="sm"
                      onClick={() =>
                        handleToggle(
                          product.id,
                          importedData!.slug,
                          importedData!.status
                        )
                      }
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : isActive ? (
                        "Disable"
                      ) : (
                        "Enable"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 font-body-md text-body-md text-on-surface-variant">
          No products found matching &ldquo;{searchQuery}&rdquo;
        </div>
      )}
    </div>
  );
}
