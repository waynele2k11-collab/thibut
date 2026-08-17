"use client";

import { useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { ImagePlus, RotateCw, ZoomIn, ZoomOut, Trash2 } from "lucide-react";

interface CompositionEditorProps {
  artworkUrl: string;
  onContinue: (compositionData: any) => void;
  onBack: () => void;
}

function recolorSvg(svgUrl: string, targetColor: "black" | "ivory" | "vermilion" | "gold"): string {
  if (!svgUrl) return svgUrl;

  const colorMap = {
    black: "#0B0B0B",
    ivory: "#F6F1E7",
    vermilion: "#B3261E",
    gold: "#C5A059",
  };
  const targetHex = colorMap[targetColor] || "#0B0B0B";

  if (svgUrl.startsWith("data:image/svg+xml")) {
    const isBase64 = svgUrl.includes(";base64,");
    if (isBase64) {
      try {
        const base64Content = svgUrl.split(";base64,")[1];
        let svgString = typeof window !== "undefined" ? atob(base64Content) : Buffer.from(base64Content, "base64").toString("utf-8");
        svgString = svgString
          .replace(/fill="#[0-9a-fA-F]{6}"/gi, `fill="${targetHex}"`)
          .replace(/stroke="#[0-9a-fA-F]{6}"/gi, `stroke="${targetHex}"`);
        const encoded = typeof window !== "undefined" ? btoa(svgString) : Buffer.from(svgString).toString("base64");
        return `data:image/svg+xml;base64,${encoded}`;
      } catch {
        return svgUrl;
      }
    } else {
      const encodedHex = encodeURIComponent(targetHex);
      let res = svgUrl
        .replaceAll("#0B0B0B", targetHex)
        .replaceAll("#0b0b0b", targetHex)
        .replaceAll("#111111", targetHex)
        .replaceAll("%230B0B0B", encodedHex)
        .replaceAll("%230b0b0b", encodedHex)
        .replaceAll("%23111111", encodedHex);

      return res;
    }
  }

  return svgUrl;
}

export function CompositionEditor({ artworkUrl, onContinue, onBack }: CompositionEditorProps) {
  // Safe print area dimensions (aspect ratio 3:4 roughly)
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;
  
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgMode, setBgMode] = useState<"product" | "photo" | "generate" | "none">("none");
  const [selectedProduct, setSelectedProduct] = useState<string>("hoodie");
  
  // Generation State
  const [genPreset, setGenPreset] = useState("zen-ivory");
  const [genMood, setGenMood] = useState("Calm");
  const [genPalette, setGenPalette] = useState("Ivory / Ink");
  const [genIntensity, setGenIntensity] = useState("Minimal");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedBg, setGeneratedBg] = useState<string | null>(null);
  
  const MVP_PRODUCTS = [
    { id: "hoodie", name: "Premium Hoodie", mockup: "/mockups/blank_hoodie.jpg" },
    { id: "poster", name: "Fine Art Poster", mockup: "/mockups/fine-art-poster.jpg" },
    { id: "tee", name: "Classic Tee", mockup: "/mockups/model-male.jpg" },
  ];

  // Layer State
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [color, setColor] = useState<"black" | "ivory" | "vermilion" | "gold">("black");
  const [resetKey, setResetKey] = useState(0);

  const recoloredArtwork = useMemo(() => {
    return recolorSvg(artworkUrl, color);
  }, [artworkUrl, color]);

  const resetArtwork = () => {
    setScale(1);
    setRotation(0);
    setColor("black");
    setResetKey(k => k + 1);
  };

  const displayBg = bgMode === "product" 
    ? MVP_PRODUCTS.find(p => p.id === selectedProduct)?.mockup 
    : bgMode === "generate" ? generatedBg 
    : bgMode === "photo" ? bgImage : null;

  const handleUploadBg = () => {
    setBgMode("photo");
  };

  const clearBg = () => {
    setBgImage(null);
    setGeneratedBg(null);
    setBgMode("none");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 1. Instant client-side preview via FileReader
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setBgImage(dataUrl);
        setBgMode("photo");
      }
    };
    reader.readAsDataURL(file);

    // 2. Asynchronous background upload to server
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    fetch("/api/uploads/background", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.url) {
          setBgImage(data.url);
        }
      })
      .catch((err) => {
        console.warn("Server upload fallback, using local preview:", err);
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  const handleGenerateBg = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/backgrounds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetKey: genPreset,
          mood: genMood,
          palette: genPalette,
          intensity: genIntensity,
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedBg(data.url);
      } else {
        alert(data.error || "Generation failed");
      }
    } catch (err) {
      alert("Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 w-full items-start">
      
      {/* LEFT: Canvas */}
      <div className="flex-1 flex justify-center w-full bg-surface-container py-8 border border-outline-variant relative overflow-hidden">
        
        {/* Physical constraints wrapper */}
        <div 
          className="relative bg-white shadow-md overflow-hidden" 
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {/* Background Image */}
          {displayBg && (
            <img 
              src={displayBg} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}

          {/* Safe Print Area Dashed Box */}
          {bgMode === "product" && (
            <div className="absolute top-[10%] left-[10%] w-[80%] h-[80%] border-2 border-dashed border-[#cc2222]/40 pointer-events-none flex items-start justify-center pt-2">
              <span className="text-[10px] uppercase font-bold text-[#cc2222]/40 font-mono tracking-widest bg-white/50 px-1 rounded-sm">
                Safe Print Area
              </span>
            </div>
          )}

          {/* Draggable Calligraphy Layer */}
          <motion.div
            key={resetKey}
            drag
            dragConstraints={bgMode === "product" ? {
              top: -CANVAS_HEIGHT * 0.4,
              bottom: CANVAS_HEIGHT * 0.4,
              left: -CANVAS_WIDTH * 0.4,
              right: CANVAS_WIDTH * 0.4,
            } : {
              top: -CANVAS_HEIGHT/2,
              bottom: CANVAS_HEIGHT/2,
              left: -CANVAS_WIDTH/2,
              right: CANVAS_WIDTH/2,
            }}
            dragElastic={bgMode === "product" ? 0.2 : 0}
            dragMomentum={false}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing w-[65%] flex items-center justify-center origin-center"
            style={{
              scale,
              rotate: rotation,
              filter: color === "ivory" && !displayBg ? "drop-shadow(0px 2px 4px rgba(0,0,0,0.35))" : undefined,
            }}
          >
            <img 
              src={recoloredArtwork} 
              alt="Generated Calligraphy" 
              className="w-full h-auto select-none pointer-events-none"
              draggable={false}
            />
          </motion.div>
        </div>

      </div>

      {/* RIGHT: Controls */}
      <div className="w-full lg:w-[350px] flex flex-col gap-6 bg-surface p-6 border border-outline-variant">
        <div>
          <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-4 tracking-widest">
            Background
          </h2>

          {/* Mode Toggle */}
          <div className="flex p-1 bg-surface-tint border border-outline-variant mb-4">
            <button onClick={() => setBgMode("none")} className={`flex-1 text-[10px] uppercase py-1.5 font-medium transition-colors ${bgMode === "none" ? "bg-white shadow-sm font-bold text-black" : "text-on-surface-variant"}`}>None</button>
            <button onClick={() => setBgMode("photo")} className={`flex-1 text-[10px] uppercase py-1.5 font-medium transition-colors ${bgMode === "photo" ? "bg-white shadow-sm font-bold text-black" : "text-on-surface-variant"}`}>Upload</button>
            <button onClick={() => setBgMode("generate")} className={`flex-1 text-[10px] uppercase py-1.5 font-medium transition-colors ${bgMode === "generate" ? "bg-white shadow-sm font-bold text-black" : "text-on-surface-variant"}`}>Generate</button>
            <button onClick={() => setBgMode("product")} className={`flex-1 text-[10px] uppercase py-1.5 font-medium transition-colors ${bgMode === "product" ? "bg-white shadow-sm font-bold text-black" : "text-on-surface-variant"}`}>Product</button>
          </div>

          {bgMode === "product" ? (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">Select Product</span>
              <select 
                value={selectedProduct} 
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full border border-outline-variant p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              >
                {MVP_PRODUCTS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-error/80 mt-1 leading-tight">
                Keep your artwork inside the safe print area for best results.
              </p>
            </div>
          ) : bgMode === "generate" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">Style Preset</span>
                <select value={genPreset} onChange={(e) => setGenPreset(e.target.value)} className="w-full border border-outline-variant p-2 text-sm bg-white">
                  <option value="zen-ivory">Zen Ivory</option>
                  <option value="sumi-mist">Sumi Mist</option>
                  <option value="bamboo-shadow">Bamboo Shadow</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">Mood</span>
                  <select value={genMood} onChange={(e) => setGenMood(e.target.value)} className="w-full border border-outline-variant p-2 text-xs bg-white">
                    <option>Calm</option>
                    <option>Elegant</option>
                    <option>Powerful</option>
                    <option>Spiritual</option>
                    <option>Mysterious</option>
                  </select>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">Palette</span>
                  <select value={genPalette} onChange={(e) => setGenPalette(e.target.value)} className="w-full border border-outline-variant p-2 text-xs bg-white">
                    <option>Ivory / Ink</option>
                    <option>Beige / Black</option>
                    <option>Vermilion Accent</option>
                    <option>Soft Gold</option>
                  </select>
                </div>
              </div>
              
              <button 
                onClick={handleGenerateBg}
                disabled={isGenerating}
                className="w-full bg-black text-white py-2 font-label-caps uppercase text-xs hover:bg-black/80 transition-colors disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : generatedBg ? "Regenerate" : "Generate Background"}
              </button>
            </div>
          ) : bgMode === "photo" ? (
            <div>
              {bgImage ? (
                 <button onClick={clearBg} className="w-full flex items-center justify-center gap-2 border border-outline-variant py-2 hover:bg-surface-tint transition-colors text-xs font-label-caps uppercase">
                   <Trash2 className="w-4 h-4 text-[#B3261E]" /> Remove Background
                 </button>
              ) : (
                <label className="w-full flex items-center justify-center gap-2 border border-outline-variant py-2.5 bg-black text-white hover:bg-black/80 transition-colors cursor-pointer text-xs font-label-caps uppercase tracking-wider">
                   {isUploading ? "Processing Image..." : <><ImagePlus className="w-4 h-4" /> Upload Photo</>}
                   <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                </label>
              )}
              <p className="text-[10px] text-on-surface-variant mt-2 leading-tight">
                Uploaded photos are strictly Private + Personal Use Only. I confirm I have the right to use this image.
              </p>
            </div>
          ) : (
            <div className="text-sm text-on-surface-variant italic py-2">
              No background selected. Your calligraphy will be printed with a transparent background.
            </div>
          )}
        </div>

        <hr className="border-outline-variant" />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
              Artwork Layer
            </h2>
            <button onClick={resetArtwork} className="text-[10px] uppercase font-bold text-on-surface-variant hover:text-black transition-colors">
              Reset
            </button>
          </div>
          
          {/* Color */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase font-medium">Ink Color</span>
              <span className="text-xs font-mono capitalize text-on-surface-variant">{color}</span>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setColor("black")} 
                title="Sumi Black (#0B0B0B)"
                className={`w-8 h-8 rounded-full bg-[#0B0B0B] ring-offset-2 transition-all ${color === "black" ? "ring-2 ring-black scale-105" : "hover:scale-110 opacity-70"}`} 
              />
              <button 
                onClick={() => setColor("vermilion")} 
                title="Cinnabar Red (#B3261E)"
                className={`w-8 h-8 rounded-full bg-[#B3261E] ring-offset-2 transition-all ${color === "vermilion" ? "ring-2 ring-[#B3261E] scale-105" : "hover:scale-110 opacity-70"}`} 
              />
              <button 
                onClick={() => setColor("ivory")} 
                title="Rice Paper Ivory (#F6F1E7)"
                className={`w-8 h-8 rounded-full bg-[#F6F1E7] border border-outline ring-offset-2 transition-all ${color === "ivory" ? "ring-2 ring-black scale-105" : "hover:scale-110 opacity-70"}`} 
              />
              <button 
                onClick={() => setColor("gold")} 
                title="Imperial Gold (#C5A059)"
                className={`w-8 h-8 rounded-full bg-[#C5A059] ring-offset-2 transition-all ${color === "gold" ? "ring-2 ring-[#C5A059] scale-105" : "hover:scale-110 opacity-70"}`} 
              />
            </div>
          </div>

          {/* Scale */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase font-medium">Scale</span>
              <span className="text-xs font-mono text-on-surface-variant">{Math.round(scale * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="hover:text-primary"><ZoomOut className="w-4 h-4" /></button>
              <input 
                type="range" min="0.5" max="2.0" step="0.05" 
                value={scale} 
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-black"
              />
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="hover:text-primary"><ZoomIn className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Rotation */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase font-medium">Rotation</span>
              <span className="text-xs font-mono text-on-surface-variant">{rotation}°</span>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="range" min="-180" max="180" step="1" 
                value={rotation} 
                onChange={(e) => setRotation(parseInt(e.target.value))}
                className="flex-1 accent-black"
              />
              <button onClick={() => setRotation(0)} className="text-xs border px-2 py-1 hover:bg-surface-tint"><RotateCw className="w-3 h-3" /></button>
            </div>
          </div>

        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button 
            onClick={() => onContinue({ 
              scale, 
              rotation, 
              color, 
              recoloredArtworkUrl: recoloredArtwork,
              bgImage: displayBg,
              productMode: bgMode,
              selectedProduct: bgMode === "product" ? selectedProduct : null 
            })}
            className="w-full bg-primary text-on-primary py-3 font-label-caps uppercase hover:bg-surface-tint transition-colors"
          >
            {bgMode === "product" ? "Continue to Checkout →" : "Continue to Product →"}
          </button>
          <button 
            onClick={onBack}
            className="w-full text-center text-xs uppercase font-medium text-on-surface-variant hover:text-black transition-colors"
          >
            Cancel Edit
          </button>
        </div>

      </div>
    </div>
  );
}
