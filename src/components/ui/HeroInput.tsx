"use client";

import { useState } from "react";
import { Sparkles, Languages } from "lucide-react";

export function HeroInput() {
  const [activeTab, setActiveTab] = useState<"NAME" | "QUOTE" | "STORY">("NAME");
  const [activeLang, setActiveLang] = useState("Vietnamese");

  const tabs = ["NAME", "QUOTE", "STORY"] as const;
  const languages = ["Vietnamese", "Japanese", "Chinese", "Korean"];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex items-center justify-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all duration-300 ${
              activeTab === tab
                ? "bg-bg-surface text-accent-gold border border-accent-gold/30"
                : "text-neutral-400 hover:text-text-primary border border-transparent"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-2 backdrop-blur-sm flex items-center focus-within:border-neutral-700 transition-colors shadow-2xl">
        <div className="pl-4 pr-2 text-neutral-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <input
          type="text"
          placeholder={`Enter your ${activeTab.toLowerCase()}...`}
          className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-text-primary placeholder:text-neutral-600 text-lg"
        />
        <button className="bg-accent-seal text-text-primary px-6 py-3 rounded-xl font-medium hover:bg-accent-seal/90 transition-colors shadow-lg">
          Transform
        </button>
      </div>

      {/* Language Selector */}
      <div className="flex items-center justify-center gap-3 mt-2">
        <Languages className="w-4 h-4 text-neutral-500" />
        <div className="flex gap-2 flex-wrap justify-center">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeLang === lang
                  ? "bg-neutral-800 text-text-primary"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
