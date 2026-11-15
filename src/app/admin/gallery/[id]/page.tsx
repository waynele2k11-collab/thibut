import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditGalleryItemForm from "./EditGalleryItemForm";

export default async function EditGalleryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await prisma.galleryItem.findUnique({
    where: { id }
  });

  if (!item) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="font-display-md text-3xl text-[#111111] mb-6">Edit Gallery Item</h1>
      
      <div className="bg-white p-6 rounded-xl border border-[#E5E0D8] shadow-sm">
        <h2 className="font-bold text-lg mb-4">{item.title}</h2>
        <p className="text-sm text-gray-500 mb-6">ID: {item.id}</p>
        
        <EditGalleryItemForm 
          id={item.id} 
          currentCustomImage={(item.mockupTransform as any)?.customImageUrl}
          productImageUrl={item.productImageUrl}
        />
      </div>
    </div>
  );
}
