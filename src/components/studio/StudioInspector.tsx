"use client";

import { Check, Info, Settings2, Sliders } from "lucide-react";
import { MOCK_PRODUCTS } from "./ProductSelectionModal";

export type WordTreatment = "KEEP_ORIGINAL" | "MATCH_SOUND" | "TRANSLATE_MEANING";
export type InkPigment = string;

interface StudioInspectorProps {
  isAdmin: boolean;
  inputText: string;
  setInputText: (v: string) => void;
  treatment: WordTreatment;
  setTreatment: (v: WordTreatment) => void;
  inkColor: InkPigment;
  setInkColor: (v: InkPigment) => void;
  hasSeal: boolean;
  setHasSeal: (v: boolean) => void;
  sealText: string;
  setSealText: (v: string) => void;
  sealFontFamily: string;
  setSealFontFamily: (v: string) => void;
  fontFamily: string;
  setFontFamily: (f: string) => void;
  selectedProduct: any;
  selectedVariantId?: string;
  onSelectVariant: (v: string) => void;
  onSelectProduct: () => void;
}

export function StudioInspector({
  isAdmin,
  inputText,
  setInputText,
  treatment,
  setTreatment,
  inkColor,
  setInkColor,
  hasSeal,
  setHasSeal,
  sealText,
  setSealText,
  sealFontFamily,
  setSealFontFamily,
  fontFamily,
  setFontFamily,
  selectedProduct,
  selectedVariantId,
  onSelectVariant,
  onSelectProduct
}: StudioInspectorProps) {
  
  const pigments = [
    { name: "Sumi Black", hex: "#121212" },
    { name: "Pure White", hex: "#FFFFFF" },
    { name: "Cinnabar Red", hex: "#B3261E" },
    { name: "Imperial Gold", hex: "#C5A059" },
    { name: "Rice Paper Ivory", hex: "#F6F1E7" },
  ];

  const SEAL_FONTS = [
    { label: "Classic Seal", name: "VNI Ong do" },
    { label: "Brush Seal", name: "UTM Thư Pháp Thiên Ân" },
    { label: "Ancient Seal", name: "VNI Netbut" }
  ];

  return (
    <div className="w-full h-full bg-[#F6F1E8] border-l border-[#E5DEC9] flex flex-col">
      <div className="p-6 border-b border-[#E5DEC9]">
        <h2 className="text-lg font-semibold text-stone-900 mb-1">Creative Inspector</h2>
        <p className="text-xs text-stone-500">Customize your artwork settings</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* TEXT INPUT */}
        <section>
          <label className="block text-xs font-semibold tracking-wider text-stone-500 uppercase mb-3">
            Canvas Words
          </label>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-900 text-lg font-serif focus:ring-2 focus:ring-stone-400 focus:outline-none placeholder-stone-400"
            placeholder="Enter a word or phrase..."
          />
        </section>

        {/* AI INTENT - 3 Segment Pill Switch */}
        <section>
          <label className="block text-xs font-semibold tracking-wider text-stone-500 uppercase mb-3 flex items-center justify-between">
            <span>Translation Intent</span>
            <Info className="w-4 h-4 text-stone-400" />
          </label>
          
          <div className="grid grid-cols-3 gap-1 bg-[#ECE5D8] p-1 rounded-xl text-xs">
            <button 
              onClick={() => setTreatment("KEEP_ORIGINAL")}
              className={`py-2 rounded-lg font-medium transition-all ${treatment === "KEEP_ORIGINAL" ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"}`}
            >
              Exact Words
            </button>
            <button 
              onClick={() => setTreatment("MATCH_SOUND")}
              className={`py-2 rounded-lg font-medium transition-all ${treatment === "MATCH_SOUND" ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"}`}
            >
              Phonetic
            </button>
            <button 
              onClick={() => setTreatment("TRANSLATE_MEANING")}
              className={`py-2 rounded-lg font-medium transition-all ${treatment === "TRANSLATE_MEANING" ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"}`}
            >
              Meaning
            </button>
          </div>
        </section>


        {/* FONT SELECTOR - Visual Chips */}
        <section>
          <label className="block text-xs font-semibold tracking-wider text-stone-500 uppercase mb-3">
            Master Brush Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "UTM ThuPhap Thien An", label: "Thiên Ân (Classic)", type: "Bold & Flowing" },
              { id: "Fz_ThuPhapButBi_Full", label: "Bút Bi", type: "Sharp & Swift" },
              { id: "Fz_DucThuyThuPhap", label: "Đức Thủy", type: "Elegant & Restrained" },
              { id: "HY-Thu_phap_7", label: "HY Thư Pháp", type: "Modern Expressive" }
            ].map(font => (
              <button
                key={font.id}
                onClick={() => setFontFamily(font.id)}
                className={`p-3 text-left border rounded-xl transition-all ${fontFamily === font.id ? "border-stone-900 bg-white ring-1 ring-stone-900" : "border-stone-200 bg-white hover:border-stone-400"}`}
              >
                <div className="font-serif text-lg text-stone-900 leading-tight mb-1" style={{ fontFamily: font.id }}>
                  Tâm
                </div>
                <div className="text-[10px] font-medium text-stone-900">{font.label}</div>
                <div className="text-[9px] text-stone-500">{font.type}</div>
              </button>
            ))}
          </div>
        </section>

        {/* CHOP SEAL CUSTOMIZATION */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold tracking-wider text-stone-500 uppercase">
              Include Chop Seal
            </label>
            <button
              onClick={() => setHasSeal(!hasSeal)}
              className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${
                hasSeal ? "bg-[#B3261E]" : "bg-stone-300"
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                hasSeal ? "left-5" : "left-0.5"
              }`} />
            </button>
          </div>
          
          {hasSeal && (
            <div className="grid grid-cols-2 gap-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Initials (Max 3)</label>
                <input 
                  type="text" 
                  maxLength={3}
                  value={sealText}
                  onChange={(e) => setSealText(e.target.value)}
                  className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm font-semibold text-stone-900 bg-white focus:border-stone-900 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Seal Font</label>
                <select 
                  value={sealFontFamily}
                  onChange={(e) => setSealFontFamily(e.target.value)}
                  className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm font-medium text-stone-900 bg-white cursor-pointer focus:border-stone-900 outline-none transition-all"
                >
                  {SEAL_FONTS.map(f => (
                    <option key={f.name} value={f.name}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* PIGMENT PALETTE (Horizontal Swatch Bar) */}
        <section>
          <label className="block text-xs font-semibold tracking-wider text-stone-500 uppercase mb-3">
            Ink Pigment
          </label>
          <div className="flex items-center gap-3">
            {pigments.map(pigment => (
              <button
                key={pigment.name}
                onClick={() => setInkColor(pigment.hex)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${inkColor === pigment.hex ? 'ring-2 ring-offset-2 ring-stone-900 ring-offset-[#F6F1E8] scale-110' : 'hover:scale-105 shadow-sm'}`}
                style={{ backgroundColor: pigment.hex }}
                title={pigment.name}
              >
                {inkColor === pigment.hex && (
                  <Check className={`w-4 h-4 ${pigment.hex === '#F6F1E7' ? 'text-stone-900' : 'text-white'}`} />
                )}
              </button>
            ))}
          </div>
        </section>



        {/* PRODUCT SELECTOR */}
        <section className="pt-4 border-t border-[#E5DEC9]">
           <label className="block text-xs font-semibold tracking-wider text-stone-500 uppercase mb-3">
            Merchandise
          </label>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover opacity-80" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-stone-400 truncate">{selectedProduct.name}</p>
                  <p className="text-sm font-semibold">${selectedProduct.price.toFixed(2)}</p>
                </div>
              </div>
              <button onClick={onSelectProduct} className="ml-3 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-xs font-medium transition-colors shrink-0">
                Change
              </button>
            </div>
            {selectedProduct.variants && selectedProduct.variants.length > 0 && (
              <div className="mt-3">
                <select
                  value={selectedVariantId || ""}
                  onChange={(e) => onSelectVariant(e.target.value)}
                  className="w-full bg-[#EAE4DA] border border-stone-200 text-stone-900 text-sm rounded-lg px-3 py-2 outline-none focus:border-stone-900"
                >
                  {selectedProduct.variants.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.color || "Default Color"} {v.size ? `- Size ${v.size}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

      </div>
    </div>
  );
}
