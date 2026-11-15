"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export default function EditGalleryItemForm({ 
  id, 
  currentCustomImage, 
  productImageUrl 
}: { 
  id: string, 
  currentCustomImage?: string,
  productImageUrl: string 
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState(currentCustomImage || "");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Upload to our generic background upload endpoint (which returns a URL)
      const uploadRes = await fetch("/api/uploads/background", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const customImageUrl = uploadData.url;
      setPreviewUrl(customImageUrl);

      // Save the new custom image URL to the gallery item
      const saveRes = await fetch(`/api/admin/gallery/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customImageUrl })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save gallery item");

      setSuccess("Custom image successfully saved! It will now override the dynamic frontend rendering.");
      router.refresh();
      
    } catch (err: any) {
      setError(err.message);
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
        body: JSON.stringify({ customImageUrl: null })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save gallery item");

      setPreviewUrl("");
      setSuccess("Custom image removed. The item will now use dynamic SVG rendering.");
      router.refresh();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Original Dynamic Background</h3>
          <div className="aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
            <img src={productImageUrl} alt="Original Mockup" className="w-full h-full object-cover mix-blend-multiply" />
          </div>
          <p className="text-xs text-gray-500 mt-2">The blank product mockup (without SVG overlay).</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Custom Rendered Image Override</h3>
          <div className="aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex flex-col items-center justify-center relative">
            {previewUrl ? (
              <img src={previewUrl} alt="Custom Override" className="w-full h-full object-cover" />
            ) : (
              <div className="text-gray-400 text-center p-4">
                <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No custom image set</p>
                <p className="text-xs mt-1">Frontend uses dynamic SVG rendering</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        {error && <p className="text-red-600 text-sm mb-4 font-medium">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 font-medium">{success}</p>}

        <div className="flex gap-4">
          <label className={`flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#B3261E] hover:bg-[#9A2119] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B3261E] cursor-pointer transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? "Uploading..." : "Upload Custom Screenshot"}
            <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleUpload} disabled={isUploading} />
          </label>

          {previewUrl && (
            <button
              onClick={handleClear}
              disabled={isUploading}
              className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B3261E]"
            >
              Clear Override
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          Uploading an image will immediately override the dynamic rendering on the storefront for this item.
        </p>
      </div>
    </div>
  );
}
