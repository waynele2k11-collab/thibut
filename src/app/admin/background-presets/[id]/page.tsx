import { PresetForm } from "../PresetForm";
import prisma from "@/lib/prisma";
import type { BackgroundPreset } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function EditBackgroundPresetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let preset: BackgroundPreset | null = null;
  if (prisma.backgroundPreset) {
    preset = await prisma.backgroundPreset.findUnique({
      where: { id },
    });
  } else {
    const records = await prisma.$queryRaw<BackgroundPreset[]>`
      SELECT * FROM "BackgroundPreset" WHERE "id" = ${id} LIMIT 1
    `;
    preset = records[0] || null;
  }

  if (!preset) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/background-presets" className="text-[#A09D96] hover:text-[#111111] transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Edit Preset</h1>
          <p className="font-body text-[#A09D96]">Update &ldquo;{preset.name}&rdquo;</p>
        </div>
      </div>

      <PresetForm preset={preset} />
    </div>
  );
}
