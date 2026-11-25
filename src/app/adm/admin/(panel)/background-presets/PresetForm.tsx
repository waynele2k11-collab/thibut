"use client";

import { adminPath } from "@/lib/admin-path";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackgroundPreset } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPreset, updatePreset } from "./actions";

export function PresetForm({ preset }: { preset?: BackgroundPreset }) {
  const router = useRouter();
  const baseId = useId();
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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : type === "number"
            ? Number.parseInt(value, 10) || 0
            : value,
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
      router.push(adminPath("/background-presets"));
    } else {
      setError(res.error || "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div
            role="alert"
            className="bg-error-container border border-error/30 text-on-error-container p-4 rounded text-sm"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-name`}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Name
            </label>
            <Input
              id={`${baseId}-name`}
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-key`}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Unique Key
            </label>
            <Input
              id={`${baseId}-key`}
              type="text"
              name="key"
              required
              disabled={Boolean(preset)}
              value={formData.key}
              onChange={handleChange}
              placeholder="e.g. zen-ivory"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-category`}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Category
            </label>
            <Input
              id={`${baseId}-category`}
              type="text"
              name="category"
              required
              value={formData.category}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-sortOrder`}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Sort Order
            </label>
            <Input
              id={`${baseId}-sortOrder`}
              type="number"
              name="sortOrder"
              required
              value={formData.sortOrder}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`${baseId}-description`}
            className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
          >
            Description
          </label>
          <textarea
            id={`${baseId}-description`}
            name="description"
            rows={2}
            value={formData.description}
            onChange={handleChange}
            className="w-full rounded border border-outline-variant p-3 font-body-md text-body-md bg-surface-container-lowest text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`${baseId}-promptTemplate`}
            className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
          >
            Prompt Template
          </label>
          <textarea
            id={`${baseId}-promptTemplate`}
            name="promptTemplate"
            rows={5}
            required
            value={formData.promptTemplate}
            onChange={handleChange}
            className="w-full rounded border border-outline-variant p-3 text-sm font-mono bg-surface-container-lowest text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            placeholder="Use {{mood}}, {{palette}}, {{intensity}}, and {{userNote}}"
          />
          <p className="font-body-md text-xs text-on-surface-variant">
            Available variables:{" "}
            <code className="bg-surface-container px-1 rounded">{"{{mood}}"}</code>,{" "}
            <code className="bg-surface-container px-1 rounded">{"{{palette}}"}</code>,{" "}
            <code className="bg-surface-container px-1 rounded">{"{{intensity}}"}</code>,{" "}
            <code className="bg-surface-container px-1 rounded">{"{{userNote}}"}</code>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-defaultMood`}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Default Mood
            </label>
            <Input
              id={`${baseId}-defaultMood`}
              type="text"
              name="defaultMood"
              value={formData.defaultMood}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-defaultPalette`}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Default Palette
            </label>
            <Input
              id={`${baseId}-defaultPalette`}
              type="text"
              name="defaultPalette"
              value={formData.defaultPalette}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-defaultIntensity`}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Default Intensity
            </label>
            <Input
              id={`${baseId}-defaultIntensity`}
              type="text"
              name="defaultIntensity"
              value={formData.defaultIntensity}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="enabled"
            id={`${baseId}-enabled`}
            checked={formData.enabled}
            onChange={handleChange}
            className="w-4 h-4 accent-primary"
          />
          <label
            htmlFor={`${baseId}-enabled`}
            className="font-body-md text-sm font-medium text-on-surface"
          >
            Enabled
          </label>
        </div>

        <div className="flex gap-4 pt-4 border-t border-surface-variant">
          <Button
            variant="outline"
            onClick={() => router.push(adminPath("/background-presets"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? "Saving..."
              : preset
                ? "Save Changes"
                : "Create Preset"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
