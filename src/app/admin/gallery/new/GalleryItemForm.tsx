"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGalleryItem } from "@/app/actions/gallery";

interface GalleryItemFormProps {
  designs: { id: string; title: string }[];
  products: { id: string; name: string; category: string }[];
}

export function GalleryItemForm({ designs, products }: GalleryItemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await createGalleryItem(formData);
      
      if (res.success) {
        router.push("/admin/gallery");
        router.refresh();
      } else {
        setError(res.error || "An unknown error occurred.");
      }
    } catch (err: any) {
      setError(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
          Design
        </label>
        <select 
          name="designId" 
          required
          className="w-full bg-[#EAE4DA] border border-[#D5D0C8] rounded-md px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#B3261E]"
        >
          <option value="">Select a published design...</option>
          {designs.map(d => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
          Catalog Product
        </label>
        <select 
          name="catalogProductId" 
          required
          className="w-full bg-[#EAE4DA] border border-[#D5D0C8] rounded-md px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#B3261E]"
        >
          <option value="">Select a base product...</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
          Price (USD)
        </label>
        <input 
          type="number" 
          name="price" 
          step="0.01" 
          min="0"
          placeholder="35.00"
          required
          className="w-full bg-[#EAE4DA] border border-[#D5D0C8] rounded-md px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#B3261E]"
        />
      </div>

      <div className="space-y-2">
        <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
          Product Mockup Image (Required)
        </label>
        <input 
          type="file" 
          name="productImage" 
          accept="image/*"
          required
          className="w-full bg-[#EAE4DA] border border-[#D5D0C8] rounded-md px-4 py-2 text-sm text-[#111111] outline-none focus:border-[#B3261E]"
        />
        <p className="text-xs text-[#A09D96]">Upload the generated product mockup image to display in the gallery.</p>
      </div>

      <div className="space-y-2">
        <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
          Status
        </label>
        <div className="flex items-center gap-4">
           <label className="flex items-center gap-2 text-sm text-[#111111]">
             <input type="radio" name="status" value="active" defaultChecked className="accent-[#B3261E]" /> Active
           </label>
           <label className="flex items-center gap-2 text-sm text-[#111111]">
             <input type="radio" name="status" value="draft" className="accent-[#B3261E]" /> Draft
           </label>
        </div>
      </div>

      <div className="pt-6 border-t border-[#E5E0D8] flex justify-end gap-4">
         <Link href="/admin/gallery" className="px-6 py-2.5 rounded-full font-label-caps text-xs text-[#4A4844] hover:bg-[#EAE4DA] transition-colors uppercase">
           Cancel
         </Link>
         <button 
          type="submit" 
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-full bg-[#B3261E] text-white font-label-caps text-xs tracking-wider uppercase hover:bg-[#9A2119] transition-colors disabled:opacity-50"
         >
           {isSubmitting ? "Creating..." : "Create Product"}
         </button>
      </div>
    </form>
  );
}
