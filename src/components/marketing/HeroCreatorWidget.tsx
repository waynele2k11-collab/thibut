"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paintbrush, ArrowRight } from "lucide-react";

interface HeroCreatorWidgetProps {
  defaultTradition?: "VIETNAMESE_THU_PHAP";
  placeholder?: string;
  buttonText?: string;
}

export function HeroCreatorWidget({
  defaultTradition,
  placeholder = "Enter your name or words...",
  buttonText = "Create Artwork →",
}: HeroCreatorWidgetProps) {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    // Push directly to the /create endpoint which auto-generates a session
    router.push(
      `/create?text=${encodeURIComponent(inputText.trim())}&tradition=${defaultTradition}`
    );
  };

  return (
    <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-xl border border-surface-variant relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] pointer-events-none" />
      
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 relative z-10">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={placeholder}
            className="w-full px-5 py-4 border-2 border-surface-variant rounded-xl font-body-lg text-on-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-on-surface-variant/50"
            required
            autoFocus
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30">
            <Paintbrush className="w-5 h-5" />
          </div>
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || !inputText.trim()}
          className="bg-primary text-on-primary px-8 py-4 rounded-xl font-label-caps uppercase text-sm font-bold tracking-wider hover:bg-surface-tint transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {isSubmitting ? "Loading Studio..." : buttonText}
        </button>
      </form>
      
      <div className="mt-4 flex items-center gap-4 text-xs font-label-caps uppercase text-on-surface-variant/70 tracking-widest justify-center sm:justify-start">
        <span><span className="text-primary font-bold">1.</span> Type Words</span>
        <ArrowRight className="w-3 h-3" />
        <span><span className="text-primary font-bold">2.</span> AI Interpretation</span>
        <ArrowRight className="w-3 h-3" />
        <span><span className="text-primary font-bold">3.</span> Live Brush Artwork</span>
      </div>
    </div>
  );
}
