"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeroCreatorWidgetProps {
  defaultTradition?: "VIETNAMESE_THU_PHAP";
  placeholder?: string;
  buttonText?: string;
}

export function HeroCreatorWidget({
  defaultTradition,
  placeholder = "Enter your name or words...",
  buttonText = "Create Artwork",
}: HeroCreatorWidgetProps) {
  const router = useRouter();
  const inputId = useId();
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const params = new URLSearchParams({ text: inputText.trim() });
    if (defaultTradition) {
      params.set("tradition", defaultTradition);
    }
    router.push(`/create?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-2xl bg-surface-container-lowest p-6 rounded-lg border border-surface-variant relative overflow-hidden">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-4 relative z-10"
      >
        <div className="flex-1 relative">
          <label htmlFor={inputId} className="sr-only">
            Words or name to personalize
          </label>
          <Input
            id={inputId}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={placeholder}
            className="h-12 pr-10"
            required
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
            <Paintbrush className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || !inputText.trim()}
        >
          {isSubmitting ? "Loading Studio..." : buttonText}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3 font-label-caps text-label-caps uppercase text-on-surface-variant justify-center sm:justify-start">
        <span>
          <strong className="text-primary">1.</strong> Type Words
        </span>
        <ArrowRight className="w-3 h-3" aria-hidden="true" />
        <span>
          <strong className="text-primary">2.</strong> AI Interpretation
        </span>
        <ArrowRight className="w-3 h-3" aria-hidden="true" />
        <span>
          <strong className="text-primary">3.</strong> Live Brush Artwork
        </span>
      </div>
    </div>
  );
}
