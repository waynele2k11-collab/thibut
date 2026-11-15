import prisma from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { DeleteGalleryItemButton } from "@/components/admin/DeleteGalleryItemButton";

export default async function AdminGalleryPage() {
  const galleryProducts = await prisma.galleryItem.findMany({
    take: 50,
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Gallery</h1>
          <p className="font-body text-[#A09D96]">Manage shoppable design catalog.</p>
        </div>
        <Link 
          href="/admin/gallery/new"
          className="inline-flex items-center justify-center bg-[#B3261E] text-white px-6 py-2.5 rounded-full font-label-caps text-xs tracking-wider uppercase hover:bg-[#9A2119] transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> New Gallery Product
        </Link>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
            <tr>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Image</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Title</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Product Name</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Price</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Created</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {galleryProducts.map((gp) => (
              <tr key={gp.id} className="hover:bg-[#F4EFE6]/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-[#EAE4DA]">
                    {gp.productImageUrl && (
                      <img src={gp.productImageUrl} alt={gp.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Link href={`/admin/gallery/${gp.id}`} className="font-medium text-[#B3261E] hover:underline">
                    {gp.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {gp.productName}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-[10px] rounded-full font-medium ${
                    gp.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {gp.published ? 'ACTIVE' : 'DRAFT'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  ${(gp.listedPriceCents / 100).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm text-[#A09D96]">
                  {format(new Date(gp.createdAt), "MMM d, yyyy")}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end text-gray-400 hover:text-red-600 transition-colors">
                    <DeleteGalleryItemButton id={gp.id} title={gp.title} />
                  </div>
                </td>
              </tr>
            ))}
            {galleryProducts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-[#A09D96]">No gallery products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
