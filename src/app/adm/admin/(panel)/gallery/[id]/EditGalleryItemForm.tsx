"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { formatMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";

interface EditGalleryItemFormProps {
  id: string;
  currentCustomImage?: string;
  productImageUrl: string;
  listedPriceMinor?: bigint | string;
  currency?: string;
}

export default function EditGalleryItemForm({
  id,
  currentCustomImage,
  productImageUrl,
  listedPriceMinor,
  currency = "USD",
}: EditGalleryItemFormProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState(currentCustomImage || "");

  const formattedListedPrice =
    listedPriceMinor !== undefined
      ? formatMinor(listedPriceMinor, currency)
      : null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/uploads/background", {
        method: "POST",
        body: formData,
      });

      const uploadData: { url?: string; error?: string } =
        await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "Upload failed");
      }

      const customImageUrl = uploadData.url;
      setPreviewUrl(customImageUrl);

      const saveRes = await fetch(`/api/admin/gallery/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customImageUrl }),
      });

      const saveData: { error?: string } = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || "Failed to save gallery item");
      }

      setSuccess(
        "Custom image saved. It will override dynamic frontend rendering."
      );
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = async () => {
    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      const saveRes = await fetch(`/api/admin/gallery/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customImageUrl: null }),
      });

      const saveData: { error?: string } = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || "Failed to save gallery item");
      }

      setPreviewUrl("");
      setSuccess(
        "Custom image removed. The item will now use dynamic SVG rendering."
      );
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to clear override");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {formattedListedPrice && (
        <p className="font-body-md text-sm text-on-surface-variant">
          Listed Price:{" "}
          <strong className="text-on-surface">{formattedListedPrice}</strong>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div>
          <h3 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
            Original Dynamic Background
          </h3>
          <div className="aspect-[4/5] bg-surface-container-low rounded-lg overflow-hidden border border-surface-variant relative">
            <Image
              src={productImageUrl}
              alt="Original Mockup"
              fill
              unoptimized
              className="object-cover mix-blend-multiply"
            />
          </div>
          <p className="font-body-md text-xs text-on-surface-variant mt-2">
            The blank product mockup (without SVG overlay).
          </p>
        </div>

        <div>
          <h3 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
            Custom Rendered Image Override
          </h3>
          <div className="aspect-[4/5] bg-surface-container-low rounded-lg overflow-hidden border border-surface-variant flex flex-col items-center justify-center relative">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Custom Override"
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="text-on-surface-variant text-center p-4">
                <Upload
                  className="w-8 h-8 mx-auto mb-2 opacity-50"
                  aria-hidden="true"
                />
                <p className="font-body-md text-sm">No custom image set</p>
                <p className="font-body-md text-xs mt-1">
                  Frontend uses dynamic SVG rendering
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-surface-variant">
        {error && (
          <p
            role="alert"
            className="text-on-error-container bg-error-container border border-error/30 rounded p-3 text-sm mb-4"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="text-on-surface bg-surface-container border border-surface-variant rounded p-3 text-sm mb-4"
          >
            {success}
          </p>
        )}

        <div className="flex flex-wrap gap-4">
          <label
            className={`flex-1 flex justify-center items-center py-3 px-4 rounded font-label-caps text-label-caps uppercase text-on-primary bg-primary hover:bg-secondary cursor-pointer transition-colors motion-reduce:transition-none ${
              isUploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {isUploading ? "Uploading..." : "Upload Custom Screenshot"}
            <input
              type="file"
              className="sr-only"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>

          {previewUrl && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isUploading}
            >
              Clear Override
            </Button>
          )}
        </div>
        <p className="font-body-md text-xs text-on-surface-variant mt-3 text-center">
          Uploading an image immediately overrides dynamic rendering on the storefront for this item.
        </p>
      </div>
    </div>
  );
}
