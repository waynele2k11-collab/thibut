"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Mode = "NAME" | "QUOTE" | "STORY";
type Language = "Vietnamese" | "Japanese" | "Chinese" | "Korean";

const LANGUAGES: Language[] = ["Vietnamese", "Japanese", "Chinese", "Korean"];

const PLACEHOLDERS: Record<Mode, string> = {
  NAME: "Enter your name…",
  QUOTE: "Enter a quote or phrase…",
  STORY: "Share your story in a sentence or two…",
};

export default function HeroInput() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("QUOTE");
  const [inputText, setInputText] = useState("");
  const [language, setLanguage] = useState<Language>("Japanese");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!inputText.trim()) return;
    setLoading(true);

    // Create a session ID and navigate to the wizard
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Store initial state in sessionStorage for the wizard to pick up
    sessionStorage.setItem(`session-${sessionId}`, JSON.stringify({
      inputText: inputText.trim(),
      mode,
      language,
    }));

    router.push(`/create/${sessionId}`);
  }

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Mode tabs */}
      <div className="flex border border-outline-variant bg-surface-container-lowest w-full">
        {(["NAME", "QUOTE", "STORY"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-3 font-label-caps text-label-caps uppercase transition-all ${
              mode === m
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Text input */}
      <div className="relative w-full">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder={PLACEHOLDERS[mode]}
          className="w-full border border-outline-variant bg-surface-container-lowest px-5 py-4 font-body-md text-body-md text-on-background placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors pr-16"
        />
      </div>

      {/* Language pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-4 py-1.5 border font-label-caps text-label-caps uppercase text-sm transition-all ${
              language === lang
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={handleCreate}
        disabled={!inputText.trim() || loading}
        className="w-full bg-primary text-on-primary py-4 font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Starting…" : "Create My Thi Bút →"}
      </button>
    </div>
  );
}
