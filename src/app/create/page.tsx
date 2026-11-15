'use client';

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function CreateIndex({ searchParams }: { searchParams: Promise<{ text?: string, tradition?: string, treatment?: string }> }) {
  const params = use(searchParams);
  const router = useRouter();

  useEffect(() => {
    const newSessionId = crypto.randomUUID();
    const searchProps = new URLSearchParams();
    if (params.text) searchProps.set("text", params.text);
    if (params.tradition) searchProps.set("tradition", params.tradition);
    if (params.treatment) searchProps.set("treatment", params.treatment);

    const queryString = searchProps.toString() ? `?${searchProps.toString()}` : "";
    router.replace(`/create/${newSessionId}${queryString}`);
  }, [params, router]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-[#FAF7F2]">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-8 h-8 border-4 border-[#B3261E] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-stone-500 font-medium tracking-wide">Preparing Studio...</p>
      </div>
    </div>
  );
}
