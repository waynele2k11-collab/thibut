"use client";

import { useState } from "react";
import Link from "next/link";
import { BackgroundPreset } from "@prisma/client";
import { togglePresetStatus, deletePreset } from "./actions";
import { Edit2, Trash2 } from "lucide-react";

export function PresetRow({ preset }: { preset: BackgroundPreset }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    await togglePresetStatus(preset.id, !preset.enabled);
    setIsToggling(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the preset "${preset.name}"?`)) return;
    setIsDeleting(true);
    await deletePreset(preset.id);
    setIsDeleting(false);
  };

  return (
    <tr className="hover:bg-[#F4EFE6]/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-[#111111]">{preset.name}</span>
          <span className="text-xs text-[#A09D96]">{preset.key}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-[#4A4844]">
        {preset.category}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[#A09D96] uppercase">Mood: <span className="text-[#4A4844]">{preset.defaultMood || "N/A"}</span></span>
          <span className="text-[10px] text-[#A09D96] uppercase">Pal: <span className="text-[#4A4844]">{preset.defaultPalette || "N/A"}</span></span>
          <span className="text-[10px] text-[#A09D96] uppercase">Int: <span className="text-[#4A4844]">{preset.defaultIntensity || "N/A"}</span></span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-mono text-[#A09D96]">
        {preset.sortOrder}
      </td>
      <td className="px-6 py-4">
        <button 
          onClick={handleToggle}
          disabled={isToggling}
          className={`inline-flex px-2 py-1 text-[10px] rounded-full font-medium transition-colors ${
            preset.enabled 
              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          } ${isToggling ? 'opacity-50' : ''}`}
        >
          {preset.enabled ? 'ACTIVE' : 'DISABLED'}
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-3">
          <Link href={`/admin/background-presets/${preset.id}`} className="text-[#4A4844] hover:text-[#111111] transition-colors">
            <Edit2 className="w-4 h-4" />
          </Link>
          <button 
            onClick={handleDelete} 
            disabled={isDeleting}
            className="text-[#B3261E]/70 hover:text-[#B3261E] transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
