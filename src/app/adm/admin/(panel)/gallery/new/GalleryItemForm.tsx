"use client";

import { adminPath } from "@/lib/admin-path";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGalleryItem } from "@/app/actions/gallery";
import { minorToDecimalInput, parseDecimalDollarsToMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GalleryItemFormProps {
  designs: { id: string; title: string }[];
  products: { id: string; name: string; category: string }[];
}

export function GalleryItemForm({ designs, products }: GalleryItemFormProps) {
  const router = useRouter();
  const designSelectId = useId();
  const productSelectId = useId();
  const priceInputId = useId();
  const mockupFileId = useId();

  const [priceText, setPriceText] = useState(() => minorToDecimalInput(3500n));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const parsedMinor = parseDecimalDollarsToMinor(priceText);
      const formData = new FormData(e.currentTarget);
      formData.set("price", minorToDecimalInput(parsedMinor));

      const res = await createGalleryItem(formData);

      if (res.success) {
        router.push(adminPath("/gallery"));
        router.refresh();
      } else {
        setError(res.error || "An unknown error occurred.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="bg-error-container text-on-error-container border border-error/30 p-4 rounded text-sm"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor={designSelectId}
          className="font-label-caps text-label-caps text-on-surface uppercase block"
        >
          Design
        </label>
        <select
          id={designSelectId}
          name="designId"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-2.5 font-body-md text-body-md text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        >
          <option value="">Select a published design...</option>
          {designs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor={productSelectId}
          className="font-label-caps text-label-caps text-on-surface uppercase block"
        >
          Catalog Product
        </label>
        <select
          id={productSelectId}
          name="catalogProductId"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-2.5 font-body-md text-body-md text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        >
          <option value="">Select a base product...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.category})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor={priceInputId}
          className="font-label-caps text-label-caps text-on-surface uppercase block"
        >
          Listed Price (USD)
        </label>
        <Input
          id={priceInputId}
          type="text"
          inputMode="decimal"
          name="price"
          value={priceText}
          onChange={(e) => setPriceText(e.target.value)}
          placeholder="35.00"
          required
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor={mockupFileId}
          className="font-label-caps text-label-caps text-on-surface uppercase block"
        >
          Product Mockup Image (Required)
        </label>
        <Input
          id={mockupFileId}
          type="file"
          name="productImage"
          accept="image/png,image/jpeg,image/webp"
          required
        />
        <p className="font-body-md text-xs text-on-surface-variant">
          Upload a PNG, JPEG, or WEBP product mockup image (max 10MB).
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-label-caps text-label-caps text-on-surface uppercase block">
          Status
        </legend>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 font-body-md text-sm text-on-surface">
            <input
              type="radio"
              name="status"
              value="active"
              defaultChecked
              className="accent-secondary"
            />
            Active
          </label>
          <label className="flex items-center gap-2 font-body-md text-sm text-on-surface">
            <input
              type="radio"
              name="status"
              value="draft"
              className="accent-secondary"
            />
            Draft
          </label>
        </div>
      </fieldset>

      <div className="pt-6 border-t border-surface-variant flex justify-end gap-4">
        <Link
          href={adminPath("/gallery")}
          className="px-6 py-2.5 rounded border border-outline font-label-caps text-label-caps text-primary hover:bg-surface-container-high transition-colors motion-reduce:transition-none uppercase inline-flex items-center"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
