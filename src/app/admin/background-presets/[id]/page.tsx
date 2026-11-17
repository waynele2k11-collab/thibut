import type { BackgroundPreset } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { PresetForm } from "../PresetForm";

export default async function EditBackgroundPresetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        <Link
          href="/admin/background-presets"
          aria-label="Back to background presets"
          className="text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
        >
          <ArrowLeft className="w-6 h-6" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="font-headline-md text-headline-md text-primary mb-1">
            Edit Preset
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Update &ldquo;{preset.name}&rdquo;
          </p>
        </div>
      </div>

      <PresetForm preset={preset} />
    </div>
  );
}
