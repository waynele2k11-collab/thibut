import type { BackgroundPreset } from "@prisma/client";
import Link from "next/link";
import { Plus } from "lucide-react";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PresetRow } from "./PresetRow";

export default async function BackgroundPresetsPage() {
  const presets: BackgroundPreset[] = prisma.backgroundPreset
    ? await prisma.backgroundPreset.findMany({
        orderBy: { sortOrder: "asc" },
      })
    : await prisma.$queryRaw<BackgroundPreset[]>`
        SELECT * FROM "BackgroundPreset"
        ORDER BY "sortOrder" ASC
      `;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary mb-2">
            Background Presets
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manage prompts and styles for the AI Background Generator.
          </p>
        </div>
        <Link
          href="/admin/background-presets/new"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Preset
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-surface-variant">
              <tr>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Name / Key
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Category
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Settings
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Sort
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-right font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {presets.map((preset) => (
                <PresetRow key={preset.id} preset={preset} />
              ))}
              {presets.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                  >
                    No presets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
