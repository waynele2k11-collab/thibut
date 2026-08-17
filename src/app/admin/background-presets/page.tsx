import prisma from "@/lib/prisma";
import Link from "next/link";
import { PresetRow } from "./PresetRow";
import { Plus } from "lucide-react";

export default async function BackgroundPresetsPage() {
  const presets: any[] = prisma.backgroundPreset
    ? await prisma.backgroundPreset.findMany({
        orderBy: { sortOrder: "asc" },
      })
    : await prisma.$queryRaw`
        SELECT * FROM "BackgroundPreset"
        ORDER BY "sortOrder" ASC
      `;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Background Presets</h1>
          <p className="font-body text-[#A09D96]">Manage prompts and styles for the AI Background Generator.</p>
        </div>
        <Link 
          href="/admin/background-presets/new"
          className="flex items-center gap-2 bg-[#111111] text-white px-4 py-2 rounded-lg font-label-caps text-sm uppercase hover:bg-black/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Preset
        </Link>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
            <tr>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Name / Key</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Settings</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Sort</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {presets.map((preset) => (
              <PresetRow key={preset.id} preset={preset} />
            ))}
            {presets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[#A09D96]">No presets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
