import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

export default async function AdminArtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const design = await prisma.design.findUnique({
    where: { id },
    include: {
      creator: true,
      category: true,
      versions: { orderBy: { versionNumber: "desc" } },
      products: { include: { catalogProduct: true } }
    }
  });

  if (!design) {
    notFound();
  }

  // Find latest version assets
  const latestVersion = design.versions[0];

  return (
    <div className="space-y-8">
      <Link href="/admin/art" className="inline-flex items-center text-sm font-label-caps uppercase text-[#A09D96] hover:text-[#111111] transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Art
      </Link>

      <div>
        <h1 className="font-display-md text-display-sm text-[#111111] mb-2">{design.title}</h1>
        <p className="font-body text-[#A09D96]">By {design.creator.displayName}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Artwork Preview</h2>
            <div className="w-full aspect-video bg-[#EAE4DA] rounded-lg border border-[#D5D0C8] flex flex-col items-center justify-center text-[#A09D96]">
               <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
               <p className="text-sm font-medium">Source Preview Placeholder</p>
            </div>
          </div>

          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Metadata</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Category</span>
                <span className="col-span-2 text-sm text-[#111111]">{design.category?.name || "Uncategorized"}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Visibility</span>
                <span className="col-span-2 text-sm text-[#111111]">{design.visibility}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Description</span>
                <span className="col-span-2 text-sm text-[#111111]">{design.description || "No description provided."}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Gallery Usage</h2>
             {design.products.length > 0 ? (
              <div className="space-y-4">
                {design.products.map(dp => (
                  <div key={dp.id} className="flex items-center justify-between py-2 border-b border-[#E5E0D8] last:border-0">
                    <div>
                      <Link href={`/admin/gallery/${dp.id}`} className="text-sm font-medium text-[#B3261E] hover:underline">
                        {dp.catalogProduct.name} - {dp.defaultPlacement || "Default Placement"}
                      </Link>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-[10px] rounded-full font-medium ${
                      dp.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {dp.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#A09D96] italic">Not used in any gallery products.</p>
            )}
          </div>
          
        </div>

        <div className="space-y-8">
          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#4A4844]">Current Status</span>
                <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                  design.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 
                  design.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {design.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#4A4844]">Latest Version</span>
                <span className="text-sm font-mono text-[#111111]">
                  v{latestVersion?.versionNumber || 1}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#FFF5F5] border border-[#FEE2E2] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#B3261E] mb-6">Admin Actions</h2>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 rounded-lg transition-colors">
                Publish
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors">
                Pause
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-[#B3261E] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                Takedown / Archive
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
