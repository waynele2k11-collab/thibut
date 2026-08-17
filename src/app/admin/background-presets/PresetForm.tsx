"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackgroundPreset } from "@prisma/client";
import { createPreset, updatePreset } from "./actions";

export function PresetForm({ preset }: { preset?: BackgroundPreset }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    key: preset?.key || "",
    name: preset?.name || "",
    category: preset?.category || "Style",
    description: preset?.description || "",
    promptTemplate: preset?.promptTemplate || "",
    defaultMood: preset?.defaultMood || "",
    defaultPalette: preset?.defaultPalette || "",
    defaultIntensity: preset?.defaultIntensity || "",
    enabled: preset ? preset.enabled : true,
    sortOrder: preset?.sortOrder || 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = preset 
      ? await updatePreset(preset.id, formData)
      : await createPreset(formData);

    if (res.success) {
      router.push("/admin/background-presets");
    } else {
      setError(res.error || "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-[#FCFAF6] border border-[#E5E0D8] p-6 rounded-xl">
      {error && (
        <div className="bg-[#FFF5F5] border border-[#FEE2E2] text-[#B3261E] p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Name</label>
          <input 
            type="text" name="name" required
            value={formData.name} onChange={handleChange}
            className="w-full border border-[#E5E0D8] p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Unique Key</label>
          <input 
            type="text" name="key" required disabled={!!preset}
            value={formData.key} onChange={handleChange}
            className="w-full border border-[#E5E0D8] p-2 text-sm bg-[#F4EFE6] focus:outline-none disabled:opacity-70"
            placeholder="e.g. zen-ivory"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Category</label>
          <input 
            type="text" name="category" required
            value={formData.category} onChange={handleChange}
            className="w-full border border-[#E5E0D8] p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Sort Order</label>
          <input 
            type="number" name="sortOrder" required
            value={formData.sortOrder} onChange={handleChange}
            className="w-full border border-[#E5E0D8] p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Description</label>
        <textarea 
          name="description" rows={2}
          value={formData.description} onChange={handleChange}
          className="w-full border border-[#E5E0D8] p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Prompt Template</label>
        <textarea 
          name="promptTemplate" rows={5} required
          value={formData.promptTemplate} onChange={handleChange}
          className="w-full border border-[#E5E0D8] p-2 text-sm font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
          placeholder="Use {{mood}}, {{palette}}, {{intensity}}, and {{userNote}}"
        />
        <p className="text-[10px] text-[#A09D96] mt-1">
          Available variables: <code className="bg-[#EAE4DA] px-1 rounded">{"{{mood}}"}</code>, <code className="bg-[#EAE4DA] px-1 rounded">{"{{palette}}"}</code>, <code className="bg-[#EAE4DA] px-1 rounded">{"{{intensity}}"}</code>, <code className="bg-[#EAE4DA] px-1 rounded">{"{{userNote}}"}</code>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Default Mood</label>
          <input 
            type="text" name="defaultMood"
            value={formData.defaultMood} onChange={handleChange}
            className="w-full border border-[#E5E0D8] p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Default Palette</label>
          <input 
            type="text" name="defaultPalette"
            value={formData.defaultPalette} onChange={handleChange}
            className="w-full border border-[#E5E0D8] p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#A09D96] tracking-widest mb-1">Default Intensity</label>
          <input 
            type="text" name="defaultIntensity"
            value={formData.defaultIntensity} onChange={handleChange}
            className="w-full border border-[#E5E0D8] p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input 
          type="checkbox" name="enabled" id="enabled"
          checked={formData.enabled} onChange={handleChange}
          className="w-4 h-4 accent-[#111111]"
        />
        <label htmlFor="enabled" className="text-sm font-medium text-[#111111]">Enabled</label>
      </div>

      <div className="flex gap-4 pt-4 border-t border-[#E5E0D8]">
        <button 
          type="button" 
          onClick={() => router.push("/admin/background-presets")}
          className="flex-1 bg-[#EAE4DA] text-[#111111] py-2 font-label-caps uppercase text-sm hover:bg-[#E5E0D8] transition-colors"
        >
          Cancel
        </button>
        <button 
          type="submit" disabled={isSubmitting}
          className="flex-1 bg-[#111111] text-white py-2 font-label-caps uppercase text-sm hover:bg-black/80 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : preset ? "Save Changes" : "Create Preset"}
        </button>
      </div>
    </form>
  );
}
