"use client";

import { useState, useSyncExternalStore } from "react";
import { Paintbrush, Shirt, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  {
    icon: Sparkles,
    title: "Type your words",
    desc: "Enter your name, a quote, or a phrase in English or Vietnamese.",
  },
  {
    icon: Paintbrush,
    title: "Choose your brush style",
    desc: "Pick a font, ink pigment, and layout. Watch your art update live.",
  },
  {
    icon: Shirt,
    title: "Place it on a medium",
    desc: "Preview on apparel, prints, and digital masters at 300 DPI.",
  },
] as const;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Thi Bút Studio"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
    >
      <div
        className="absolute inset-0 bg-on-background/45 backdrop-blur-xs"
        onClick={dismiss}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden animate-[slideUp_0.3s_ease] motion-reduce:animate-none">
        <div className="bg-primary text-on-primary px-6 pt-6 pb-5 text-center relative">
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-on-primary/10 flex items-center justify-center hover:bg-on-primary/20 transition-colors motion-reduce:transition-none"
            aria-label="Close welcome guide"
          >
            <X className="w-4 h-4 text-on-primary" aria-hidden="true" />
          </button>
          <span className="font-headline-md text-headline-md text-on-primary block mb-1">
            Thi Bút
          </span>
          <p className="font-label-caps text-label-caps uppercase text-on-primary/75">
            Words Become Art · 3 Steps
          </p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex items-start gap-4 p-4 rounded-lg border border-surface-variant bg-surface-container-low"
              >
                <div className="w-8 h-8 rounded bg-surface-container-lowest border border-surface-variant flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-secondary" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-body-md text-sm font-semibold text-on-surface mb-0.5">
                    {step.title}
                  </p>
                  <p className="font-body-md text-xs text-on-surface-variant leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button onClick={dismiss} size="lg" className="w-full">
            Start Creating
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="text-center font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none py-2"
          >
            Skip Guide
          </button>
        </div>
      </div>
    </div>
  );
}
