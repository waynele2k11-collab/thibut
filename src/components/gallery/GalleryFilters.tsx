"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { id: "all", label: "All Works" },
  { id: "names", label: "Names & Identity" },
  { id: "quotes", label: "Poetry & Quotes" },
  { id: "heritage", label: "Heritage & Values" },
  { id: "abstract", label: "Abstract" },
];

export function GalleryFilters({ activeFilter }: { activeFilter: string }) {
  const router = useRouter();

  const setFilter = (id: string) => {
    if (id === "all") {
      router.push("/gallery");
    } else {
      router.push(`/gallery?filter=${id}`);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mb-2">
      {FILTERS.map((f) => {
        const isActive = f.id === activeFilter || (f.id === "all" && activeFilter === "all");
        return (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-[0.97] ${
              isActive
                ? "bg-[#111111] text-white shadow-sm"
                : "bg-white border border-[#E0DBD1] text-[#444] hover:border-black"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
