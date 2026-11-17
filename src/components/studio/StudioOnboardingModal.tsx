"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

const ONBOARDING_KEY = "thibut_onboarded_v1";

const subscribeOnboarding = () => () => {};
const readOnboardingCompleted = () => {
  try {
    return Boolean(window.localStorage.getItem(ONBOARDING_KEY));
  } catch {
    return false;
  }
};
const getServerOnboardingCompleted = () => true;

const STEPS = [
  { emoji: "✍️", title: "Type your words", desc: "Enter your name, a quote, or a phrase. In English or Vietnamese." },
  { emoji: "🖌️", title: "Choose your brush style", desc: "Pick a font, ink color, and layout. Watch your art update live." },
  { emoji: "👕", title: "Put it on a product", desc: "Preview on hoodies, posters, and more. We print and ship worldwide." },
];

export function StudioOnboardingModal() {
  const isOnboardedInStorage = useSyncExternalStore(
    subscribeOnboarding,
    readOnboardingCompleted,
    getServerOnboardingCompleted
  );
  const [dismissed, setDismissed] = useState(false);
  const visible = !isOnboardedInStorage && !dismissed;

  const dismiss = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // Ignore storage errors in restricted browsing modes
    }
    setDismissed(true);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease]">
        {/* Header */}
        <div className="bg-[#0B0B0B] px-6 pt-6 pb-5 text-center relative">
          <button onClick={dismiss} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Skip">
            <X className="w-4 h-4 text-white" />
          </button>
          <span className="font-vn-dancing text-3xl text-white block mb-1">Thi Bút</span>
          <p className="text-white/60 text-xs uppercase tracking-widest font-semibold">Words Become Art · 3 steps</p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-[#E5E0D8] bg-[#FAF8F5]">
              <span className="text-2xl leading-none shrink-0">{step.emoji}</span>
              <div>
                <p className="font-bold text-sm text-[#111111] mb-0.5">{step.title}</p>
                <p className="text-[11px] text-[#66635D] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button onClick={dismiss} className="w-full bg-[#B3261E] text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-[#9b1e17] active:scale-[0.99] transition-all">
            Let&rsquo;s Create →
          </button>
          <button onClick={dismiss} className="text-center text-[11px] text-[#888580] hover:text-[#111111] transition-colors py-1">
            Skip — I know what I&rsquo;m doing
          </button>
        </div>
      </div>
    </div>
  );
}
