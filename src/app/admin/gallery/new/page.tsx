import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
        <form className="space-y-6">
          
          <div className="space-y-2">
            <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
              Design
            </label>
            <select className="w-full bg-[#EAE4DA] border border-[#D5D0C8] rounded-md px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#B3261E]">
              <option value="">Select a published design...</option>
              {designs.map(d => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
              Catalog Product
            </label>
            <select className="w-full bg-[#EAE4DA] border border-[#D5D0C8] rounded-md px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#B3261E]">
              <option value="">Select a base product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
              Default Placement
            </label>
            <select className="w-full bg-[#EAE4DA] border border-[#D5D0C8] rounded-md px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#B3261E]">
              <option value="FRONT_CENTER">Front Center</option>
              <option value="BACK_CENTER">Back Center</option>
              <option value="LEFT_CHEST">Left Chest</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="font-label-caps text-xs text-[#111111] uppercase tracking-wider block">
              Status
            </label>
            <div className="flex items-center gap-4">
               <label className="flex items-center gap-2 text-sm text-[#111111]">
                 <input type="radio" name="status" value="active" defaultChecked className="accent-[#B3261E]" /> Active
               </label>
               <label className="flex items-center gap-2 text-sm text-[#111111]">
                 <input type="radio" name="status" value="draft" className="accent-[#B3261E]" /> Draft
               </label>
            </div>
          </div>

          <div className="pt-6 border-t border-[#E5E0D8] flex justify-end gap-4">
             <Link href="/admin/gallery" className="px-6 py-2.5 rounded-full font-label-caps text-xs text-[#4A4844] hover:bg-[#EAE4DA] transition-colors uppercase">
               Cancel
             </Link>
             <button type="button" className="px-6 py-2.5 rounded-full bg-[#B3261E] text-white font-label-caps text-xs tracking-wider uppercase hover:bg-[#9A2119] transition-colors">
               Create Product
             </button>
          </div>

        </form>
      </div>
    </div>
  );
}
