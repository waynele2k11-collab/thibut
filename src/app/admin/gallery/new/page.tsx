import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GalleryItemForm } from "./GalleryItemForm";

export default async function AdminNewGalleryProductPage() {
  const [designs, products] = await Promise.all([
    prisma.design.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true } }),
    prisma.catalogProduct.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, category: true } })
  ]);

  return (
    <div className="space-y-8 max-w-3xl">
      <Link href="/admin/gallery" className="inline-flex items-center text-sm font-label-caps uppercase text-[#A09D96] hover:text-[#111111] transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Gallery
      </Link>

      <div>
        <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Create Gallery Product</h1>
        <p className="font-body text-[#A09D96]">Publish a new shoppable design configuration.</p>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-8">
        <GalleryItemForm designs={designs} products={products} />
      </div>
    </div>
  );
}
