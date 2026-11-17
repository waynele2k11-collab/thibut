"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";

const PLACEHOLDERS = [
  "Never Give Up",
  "David",
  "Family First",
  "Stillness",
  "Enter a name, word, or quote...",
];

export function HeroCreateInput() {
  const [text, setText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    if (text.length > 0 || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [text, prefersReducedMotion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      router.push(`/create?text=${encodeURIComponent(text.trim())}`);
    } else {
      router.push("/create");
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row w-full max-w-xl mx-auto gap-3 mt-6 mb-4 relative z-30"
      >
        <label htmlFor="hero-create-phrase" className="sr-only">
          Enter a name, word, or quote to personalize
        </label>
        <input
          id="hero-create-phrase"
          name="text"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          className="grow px-5 py-4 rounded border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors motion-reduce:transition-none"
        />
        <button
          type="submit"
          className="px-8 py-4 bg-primary text-on-primary hover:bg-secondary hover:text-on-secondary font-label-caps text-label-caps uppercase rounded transition-colors duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        >
          <span className="hidden sm:inline">Create</span>
          <span className="sm:hidden">Create Your Thi Bút</span>
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-on-surface-variant font-label-caps text-label-caps uppercase mt-1 mb-2">
        <span>4.9 Rating · 1,200+ Artworks</span>
        <span className="opacity-40 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>Printed in USA</span>
        <span className="opacity-40 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>Ships Worldwide</span>
        <span className="opacity-40 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>300 DPI Print Master</span>
      </div>
    </div>
  );
}
