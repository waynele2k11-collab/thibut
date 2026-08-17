"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HeroAnimation() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [loopCount, setLoopCount] = useState(0);

  // Animation cycle sequence
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 0) {
      // Typing phase
      timer = setTimeout(() => setPhase(1), 3000);
    } else if (phase === 1) {
      // Translation/Calligraphy phase
      timer = setTimeout(() => setPhase(2), 3000);
    } else if (phase === 2) {
      // Product overlay phase
      timer = setTimeout(() => {
        setPhase(0);
        setLoopCount((c) => c + 1);
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [phase]);

  const modelImage = loopCount % 2 === 0 ? "/hero/female-model.jpg" : "/hero/male-model.jpg";

  // Framer motion variants for the typing effect
  const typingContainer = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.5 },
    },
  };

  const typingLetter = {
    hidden: { opacity: 0, display: "none" },
    visible: { opacity: 1, display: "inline-block" },
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto aspect-[3/4] sm:aspect-[4/5] bg-surface-container-lowest overflow-hidden shadow-2xl rounded-sm">
      
      {/* Background Layer: Animation Sequence */}
      <div className="absolute inset-0 z-0">
        
        {/* Phase 2: Product Image */}
        <AnimatePresence>
          {phase === 2 && (
            <motion.img
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              src={modelImage}
              alt="Model wearing calligraphy t-shirt"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </AnimatePresence>

        {/* Phase 0: Input Box */}
        <AnimatePresence>
          {phase === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-3/4 max-w-xs bg-background border border-outline-variant px-5 py-4 flex items-center shadow-lg"
            >
              <span className="text-on-surface-variant font-label-caps text-label-caps mr-3 uppercase select-none">Input</span>
              <motion.div
                variants={typingContainer}
                initial="hidden"
                animate="visible"
                className="font-headline-sm text-headline-sm text-on-background flex"
              >
                {"David".split("").map((char, index) => (
                  <motion.span key={index} variants={typingLetter}>
                    {char}
                  </motion.span>
                ))}
              </motion.div>
              <motion.div 
                animate={{ opacity: [0, 1, 0] }} 
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-[2px] h-6 bg-primary ml-1" 
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 1 & 2: Calligraphy */}
        <AnimatePresence>
          {(phase === 1 || phase === 2) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              animate={{ 
                opacity: phase === 2 ? 0.85 : 1, 
                scale: 1, 
                filter: "blur(0px)"
              }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className={`absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none w-full ${phase === 2 ? "mix-blend-multiply" : ""}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" className="w-[30%] sm:w-[35%] md:w-[40%] h-auto transition-transform duration-1000">
                 {/* Vertical Japanese Calligraphy for David */}
                 <text x="185" y="180" fontFamily="'Noto Serif JP', serif" fontSize="64" fill="#111111" textAnchor="middle" dominantBaseline="central" fontWeight="500" letterSpacing="8" style={{ writingMode: "vertical-rl" }}>
                   デイビッド
                 </text>
                 <text x="200" y="340" fontFamily="'Cormorant Garamond', serif" fontSize="16" fill="#444444" textAnchor="middle" letterSpacing="4" fontStyle="italic">
                   Deibiddo
                 </text>
                 {/* Red Seal Mockup */}
                 <rect x="250" y="270" width="24" height="24" fill="#d32f2f" opacity="0.9" />
                 <text x="262" y="282" fontFamily="'Noto Serif JP', serif" fontSize="10" fill="#ffffff" textAnchor="middle" dominantBaseline="central" style={{ writingMode: "vertical-rl" }}>
                   印
                 </text>
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Overlay Gradient at the bottom for readability */}
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />

      {/* Foreground Content: Hero Text & CTA */}
      <div className="absolute bottom-6 md:bottom-10 inset-x-0 z-20 w-full px-6 flex flex-col items-center text-center gap-4">
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white leading-tight drop-shadow-md">
          Turn Words Into Art.
        </h1>
        <p className="text-sm sm:text-base text-stone-200 max-w-xs sm:max-w-md mx-auto leading-relaxed drop-shadow-sm">
          Transform your name, quote or story into culturally inspired calligraphy and wearable design.
        </p>
        
        <Link 
          href="/create" 
          className="bg-primary text-on-primary py-3 px-6 text-xs tracking-widest font-label-caps uppercase hover:bg-surface-tint transition-colors flex items-center gap-2 mt-2 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 pointer-events-auto"
        >
          Personalize Now <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      
    </div>
  );
}
