"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

type PresetMode = "japanese" | "korean";

export default function DualHero() {
  const [activePreset, setActivePreset] = useState<PresetMode>("japanese");
  const [inputText, setInputText] = useState("David");
  const [isTranslating, setIsTranslating] = useState(false);

  // Simulated translation dictionary
  const getTranslation = (text: string, mode: PresetMode) => {
    const t = text.toLowerCase().trim();
    if (mode === "japanese") {
      if (t === "david") return { main: "デイビッド", sub: "Deibiddo" };
      if (t === "eternity") return { main: "永遠", sub: "Eien" };
      return { main: "カタカナ", sub: "Katakana" }; // Fallback
    } else {
      if (t === "david") return { main: "데이비드", sub: "Deibideu" };
      if (t === "eternity") return { main: "영원", sub: "Yeong-won" };
      return { main: "한글", sub: "Hangeul" }; // Fallback
    }
  };

  const handlePresetClick = (mode: PresetMode) => {
    setActivePreset(mode);
    setInputText(mode === "japanese" ? "David" : "Eternity");
  };

  // Simulate typing delay
  useEffect(() => {
    setIsTranslating(true);
    const timer = setTimeout(() => setIsTranslating(false), 400);
    return () => clearTimeout(timer);
  }, [inputText, activePreset]);

  const translation = getTranslation(inputText, activePreset);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-12 relative pb-8">
      
      {/* 1. Interactive Input Pill / Bar */}
      <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-2 bg-surface-container-lowest p-2 rounded-2xl shadow-sm border border-outline-variant z-20">
        
        {/* Presets */}
        <div className="flex w-full sm:w-auto bg-surface-container-high rounded-xl p-1 gap-1">
          <button 
            onClick={() => handlePresetClick("japanese")}
            className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 text-xs font-label-caps uppercase tracking-wider rounded-lg transition-colors ${activePreset === "japanese" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface hover:bg-surface-container-highest"}`}
          >
            Japanese
          </button>
          <button 
            onClick={() => handlePresetClick("korean")}
            className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 text-xs font-label-caps uppercase tracking-wider rounded-lg transition-colors ${activePreset === "korean" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface hover:bg-surface-container-highest"}`}
          >
            Korean
          </button>
        </div>

        <div className="h-px sm:h-8 w-full sm:w-px bg-outline-variant" />

        {/* Input */}
        <div className="flex-1 flex items-center px-4 py-2 w-full">
          <Sparkles className="w-4 h-4 text-primary mr-3 opacity-50 shrink-0" />
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="bg-transparent border-none outline-none font-body-lg text-on-background placeholder:text-on-surface-variant w-full"
            placeholder="Type a word..."
          />
        </div>
      </div>

      {/* 2. Dual Mockup Stage */}
      {/* Using snap scroll on mobile, grid on desktop */}
      <div className="w-full flex md:grid md:grid-cols-2 gap-6 relative z-10 overflow-x-auto snap-x snap-mandatory px-4 md:px-0 scrollbar-hide pb-4">
        
        {/* Model A: Japanese Streetwear */}
        <div className={`relative w-[85vw] md:w-full shrink-0 snap-center mx-auto aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-900 border ${activePreset === "japanese" ? "border-primary shadow-2xl scale-100" : "border-neutral-800 scale-[0.98] opacity-60 md:opacity-100"} transition-all duration-500`}>
          <Image 
            src="/mockups/model-male.jpg" 
            alt="Japanese Streetwear Mockup" 
            fill 
            className="object-cover object-top"
            priority
          />
          
          {/* Print Zone */}
          <div className={`absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] flex flex-col items-center pointer-events-none select-none transition-opacity duration-300 ${isTranslating && activePreset === "japanese" ? "opacity-0" : "opacity-100"}`}>
            {activePreset === "japanese" ? (
              <svg viewBox="0 0 400 400" className="w-full h-auto drop-shadow-md">
                 <text x="185" y="180" fontFamily="'Noto Serif JP', serif" fontSize="64" fill="#111111" textAnchor="middle" dominantBaseline="central" fontWeight="500" letterSpacing="8" style={{ writingMode: "vertical-rl" }}>
                   {translation.main}
                 </text>
                 <text x="200" y="340" fontFamily="'Cormorant Garamond', serif" fontSize="16" fill="#444444" textAnchor="middle" letterSpacing="4" fontStyle="italic">
                   {translation.sub}
                 </text>
                 <rect x="250" y="270" width="24" height="24" fill="#d32f2f" opacity="0.9" />
                 <text x="262" y="282" fontFamily="'Noto Serif JP', serif" fontSize="10" fill="#ffffff" textAnchor="middle" dominantBaseline="central" style={{ writingMode: "vertical-rl" }}>
                   印
                 </text>
              </svg>
            ) : (
               <svg viewBox="0 0 400 400" className="w-full h-auto opacity-30">
                 <text x="185" y="180" fontFamily="'Noto Serif JP', serif" fontSize="64" fill="#111111" textAnchor="middle" dominantBaseline="central" fontWeight="500" letterSpacing="8" style={{ writingMode: "vertical-rl" }}>
                   デイビッド
                 </text>
                 <text x="200" y="340" fontFamily="'Cormorant Garamond', serif" fontSize="16" fill="#444444" textAnchor="middle" letterSpacing="4" fontStyle="italic">
                   Deibiddo
                 </text>
                 <rect x="250" y="270" width="24" height="24" fill="#d32f2f" opacity="0.9" />
                 <text x="262" y="282" fontFamily="'Noto Serif JP', serif" fontSize="10" fill="#ffffff" textAnchor="middle" dominantBaseline="central" style={{ writingMode: "vertical-rl" }}>
                   印
                 </text>
              </svg>
            )}
          </div>
          
          <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white text-[10px] sm:text-xs px-3 py-1 rounded-full uppercase tracking-widest">
            Japanese Streetwear
          </div>
        </div>

        {/* Model B: Korean Clean Luxury */}
        <div className={`relative w-[85vw] md:w-full shrink-0 snap-center mx-auto aspect-[4/5] rounded-2xl overflow-hidden bg-[#e0ded8] border ${activePreset === "korean" ? "border-primary shadow-2xl scale-100" : "border-neutral-300 scale-[0.98] opacity-60 md:opacity-100"} transition-all duration-500`}>
          <Image 
            src="/mockups/model-female.jpg" 
            alt="Korean Clean Luxury Mockup" 
            fill 
            className="object-cover object-top"
            priority
          />
          
          {/* Print Zone */}
          <div className={`absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] flex flex-col items-center pointer-events-none select-none transition-opacity duration-300 ${isTranslating && activePreset === "korean" ? "opacity-0" : "opacity-100"}`}>
            {activePreset === "korean" ? (
              <div className="flex flex-col items-center drop-shadow-sm text-[#3b3a36]">
                <span className="text-[clamp(1.5rem,5vw,3rem)] font-serif font-medium tracking-[0.2em] [writing-mode:vertical-rl]">
                  {translation.main}
                </span>
                <span className="mt-4 text-[clamp(0.6rem,1.5vw,0.85rem)] font-sans uppercase tracking-[0.3em] opacity-70">
                  {translation.sub}
                </span>
                <div className="mt-4 border border-[#b23a3a] text-[#b23a3a] px-1 py-1 text-[8px] tracking-widest font-serif">
                  道
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center opacity-30 text-[#3b3a36]">
                <span className="text-[clamp(1.5rem,5vw,3rem)] font-serif font-medium tracking-[0.2em] [writing-mode:vertical-rl]">
                  영원
                </span>
                <span className="mt-4 text-[clamp(0.6rem,1.5vw,0.85rem)] font-sans uppercase tracking-[0.3em] opacity-70">
                  Yeong-won
                </span>
                <div className="mt-4 border border-[#b23a3a] text-[#b23a3a] px-1 py-1 text-[8px] tracking-widest font-serif">
                  道
                </div>
              </div>
            )}
          </div>
          
          <div className="absolute top-4 left-4 bg-white/60 backdrop-blur-md text-stone-900 text-[10px] sm:text-xs px-3 py-1 rounded-full uppercase tracking-widest">
            Korean Minimal
          </div>
        </div>

      </div>

      {/* 3. Hero Content & CTA Layout */}
      <div className="w-full flex flex-col items-center text-center mt-6 z-20 px-6">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-[#f5f2eb] font-bold drop-shadow-lg mb-6">
          Turn Words Into Art.
        </h1>
        <p className="font-body-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed mb-10">
          Transform any name, quote, or story into culturally authentic Japanese, Korean, or Vietnamese wearable calligraphy.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link 
            href="/create" 
            className="bg-[#d32f2f] text-white px-8 py-4 text-sm tracking-widest font-label-caps uppercase hover:bg-[#b71c1c] transition-colors flex items-center justify-center w-full sm:w-auto gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0"
          >
            Start Personalizing — Studio Lab <ArrowRight className="w-4 h-4" />
          </Link>
          <a 
            href="#explore"
            className="text-on-surface hover:text-primary px-8 py-4 text-sm tracking-widest font-label-caps uppercase transition-colors"
          >
            Explore Gallery
          </a>
        </div>
      </div>
      
    </div>
  );
}
