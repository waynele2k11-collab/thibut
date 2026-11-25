"use client";

import { adminPath } from "@/lib/admin-path";
import { useState } from "react";
import Link from "next/link";
import type { BackgroundPreset } from "@prisma/client";
import { Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { deletePreset, togglePresetStatus } from "./actions";

export function PresetRow({ preset }: { preset: BackgroundPreset }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    await togglePresetStatus(preset.id, !preset.enabled);
    setIsToggling(false);
  };

  const handleDelete = async () => {
    if (
      !confirm(`Are you sure you want to delete the preset "${preset.name}"?`)
    ) {
      return;
    }
    setIsDeleting(true);
    await deletePreset(preset.id);
    setIsDeleting(false);
  };

  return (
    <tr className="hover:bg-surface-container-low transition-colors motion-reduce:transition-none">
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-on-surface">{preset.name}</span>
          <span className="font-body-md text-xs text-on-surface-variant">
            {preset.key}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
        {preset.category}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-0.5 font-label-caps text-[10px] uppercase text-on-surface-variant">
          <span>
            Mood:{" "}
            <strong className="text-on-surface">
              {preset.defaultMood || "N/A"}
            </strong>
          </span>
          <span>
            Pal:{" "}
            <strong className="text-on-surface">
              {preset.defaultPalette || "N/A"}
            </strong>
          </span>
          <span>
            Int:{" "}
            <strong className="text-on-surface">
              {preset.defaultIntensity || "N/A"}
            </strong>
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-mono text-on-surface-variant">
        {preset.sortOrder}
      </td>
      <td className="px-6 py-4">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isToggling}
          className={`cursor-pointer ${isToggling ? "opacity-50" : ""}`}
        >
          <Badge variant={preset.enabled ? "default" : "outline"}>
            {preset.enabled ? "ACTIVE" : "DISABLED"}
          </Badge>
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-3">
          <Link
            href={adminPath(`/background-presets/${preset.id}`)}
            aria-label={`Edit ${preset.name}`}
            className="text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={`Delete ${preset.name}`}
            className="text-error hover:opacity-80 transition-opacity motion-reduce:transition-none disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}
