"use client";

import { useState } from "react";
import { ProviderProduct } from "@/lib/fulfillment/types";
import { importPrintfulProductAction, toggleProductStatusAction } from "@/app/actions/printful-admin";
import { Loader2, Search, CheckCircle, XCircle } from "lucide-react";
import Image from "next/image";

interface ProductsGridProps {
  products: ProviderProduct[];
  statusMap: Record<string, { id: string, slug: string, status: string, priceMinor?: number }>;
}

export function ProductsGrid({ products, statusMap }: ProductsGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"discover" | "synced">("discover");
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const filteredProducts = products.filter(p => {
    const isImported = !!statusMap[p.id];
    
    // Tab filtering
    if (activeTab === "synced" && !isImported) return false;
    
    // Search filtering
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleImport = async (productId: string) => {
    setLoadingMap(prev => ({ ...prev, [productId]: true }));
    const res = await importPrintfulProductAction(productId);
    setLoadingMap(prev => ({ ...prev, [productId]: false }));
    
    if (!res.success) {
      alert(`Failed to import: ${res.error}`);
    }
  };

  const handleToggle = async (productId: string, slug: string, currentStatus: string) => {
    setLoadingMap(prev => ({ ...prev, [productId]: true }));
    const res = await toggleProductStatusAction(slug, currentStatus);
    setLoadingMap(prev => ({ ...prev, [productId]: false }));
    
    if (!res.success) {
      alert(`Failed to toggle status: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("discover")}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "discover" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => setActiveTab("synced")}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "synced" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Synced
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder={activeTab === "synced" ? "Search your synced products..." : "Search Printful catalog by name, ID, or category..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => {
          const importedData = statusMap[product.id];
          const isImported = !!importedData;
          const isActive = importedData?.status === "ACTIVE";
          const isLoading = loadingMap[product.id];

          return (
            <div key={product.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-square relative bg-gray-50 p-4 flex items-center justify-center">
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
                  <div className="text-gray-300">No Image</div>
                )}
                
                {isImported && (
                  <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {isActive ? "Active" : "Disabled"}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-gray-100">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs font-medium text-gray-500">ID: {product.id} &bull; {product.category.toUpperCase()}</div>
                  {isImported && importedData.priceMinor && (
                    <div className="text-sm font-semibold text-green-700">
                      ${(importedData.priceMinor / 100).toFixed(2)}
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-[#111111] line-clamp-2 leading-tight h-10 mb-4">{product.name}</h3>
                
                <div className="flex gap-2">
                  {!isImported ? (
                    <button
                      onClick={() => handleImport(product.id)}
                      disabled={isLoading}
                      className="flex-1 bg-[#111111] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync & Enable"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggle(product.id, importedData.slug, importedData.status)}
                      disabled={isLoading}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border ${
                        isActive 
                          ? 'border-gray-200 text-gray-700 hover:bg-gray-50' 
                          : 'bg-[#111111] text-white hover:bg-gray-900'
                      } disabled:opacity-50`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isActive ? (
                        "Disable"
                      ) : (
                        "Enable"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No products found matching &ldquo;{searchQuery}&rdquo;
        </div>
      )}
    </div>
  );
}
