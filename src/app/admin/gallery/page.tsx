import prisma from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";

export default async function AdminGalleryPage() {
  const galleryProducts = await prisma.designProduct.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      design: { select: { title: true } },
      catalogProduct: { select: { name: true, category: true } }
    }
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
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Design</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Product</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Placement</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {galleryProducts.map((gp) => (
              <tr key={gp.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/admin/gallery/${gp.id}`} className="font-medium text-[#B3261E] hover:underline">
                    {gp.design.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {gp.catalogProduct.name}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-[10px] rounded-full font-medium ${
                    gp.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {gp.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {gp.defaultPlacement || "Default"}
                </td>
                <td className="px-6 py-4 text-sm text-[#A09D96]">
                  {format(new Date(gp.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
            {galleryProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[#A09D96]">No gallery products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
