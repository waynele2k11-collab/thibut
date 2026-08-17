"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDERS = [
  "Never Give Up",
  "David",
  "Family First",
  "Stillness",
  "Enter a name, word, or quote..."
];

export function HeroCreateInput() {
  const [text, setText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // Only animate placeholder if input is empty
    if (text.length > 0) return;
    
    const interval = setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % PLACEHOLDERS.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [text]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      router.push(`/create?text=${encodeURIComponent(text.trim())}`);
    } else {
      router.push(`/create`);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row w-full max-w-xl mx-auto gap-2 mt-8 mb-4 relative z-30"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDERS[placeholderIndex]}
        className="flex-grow px-6 py-4 rounded-xl border border-tb-border bg-tb-surface text-tb-foreground placeholder:text-tb-muted focus:outline-none focus:ring-2 focus:ring-tb-red transition-all text-base"
        required
      />
      <button
        type="submit"
        className="px-8 py-4 bg-tb-red hover:bg-tb-red-hover text-white font-bold tracking-wider uppercase rounded-xl transition-colors duration-200"
      >
        <span className="hidden sm:inline">Create</span>
        <span className="sm:hidden">Create Your Thi Bút</span>
      </button>
    </form>
  );
}
