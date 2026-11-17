"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteGalleryItemButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      router.refresh();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      aria-label={`Delete ${title}`}
      className={`p-2 rounded transition-colors motion-reduce:transition-none ${
        isDeleting
          ? "opacity-50 cursor-not-allowed bg-surface-container text-on-surface-variant"
          : "text-error hover:bg-error-container hover:text-on-error-container"
      }`}
    >
      <Trash2 className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
