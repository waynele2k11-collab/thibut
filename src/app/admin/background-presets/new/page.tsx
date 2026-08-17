import { PresetForm } from "../PresetForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewBackgroundPresetPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/background-presets" className="text-[#A09D96] hover:text-[#111111] transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">New Preset</h1>
          <p className="font-body text-[#A09D96]">Create a new generative AI background style.</p>
        </div>
      </div>

      <PresetForm />
    </div>
  );
}
