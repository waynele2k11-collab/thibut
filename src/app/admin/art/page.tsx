import prisma from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";

export default async function AdminArtPage() {
  const designs = await prisma.design.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      creator: true,
      category: true,
      _count: {
        select: { products: true, versions: true }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Artwork & Designs</h1>
          <p className="font-body text-[#A09D96]">Manage original designs and interpretations.</p>
        </div>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
            <tr>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Title</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Creator</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Gallery Usage</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {designs.map((design) => (
              <tr key={design.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <Link href={`/admin/art/${design.id}`} className="font-medium text-[#B3261E] hover:underline">
                      {design.title}
                    </Link>
                    <span className="text-xs text-[#A09D96]">{design._count.versions} versions</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Link href={`/admin/sellers/${design.creatorId}`} className="text-sm text-[#111111] hover:underline">
                    {design.creator.displayName}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {design.category?.name || "Uncategorized"}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                    design.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 
                    design.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {design.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {design._count.products} Products
                </td>
                <td className="px-6 py-4 text-sm text-[#A09D96]">
                  {format(new Date(design.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
            {designs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[#A09D96]">No artwork found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
