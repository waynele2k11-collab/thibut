import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/utils/admin/auth";
import { PresetForm } from "../PresetForm";

export default async function NewBackgroundPresetPage() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={adminPath("/background-presets")}
          aria-label="Back to background presets"
          className="text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
        >
          <ArrowLeft className="w-6 h-6" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="font-headline-md text-headline-md text-primary mb-1">
            New Preset
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Create a new generative AI background style.
          </p>
        </div>
      </div>

      <PresetForm />
    </div>
  );
}
