import React from 'react';
import { Type, MessageSquare, BookOpen, CheckCircle2 } from 'lucide-react';

interface ControlsDrawerProps {
  activeTab: 'NAME' | 'QUOTE' | 'STORY';
  setActiveTab: (tab: 'NAME' | 'QUOTE' | 'STORY') => void;
  inputText: string;
  setInputText: (text: string) => void;
  interpretation: string;
  setInterpretation: (val: string) => void;
  stylePack: string;
  setStylePack: (val: string) => void;
  composition: string;
  setComposition: (val: string) => void;
}

const STYLE_PACKS = [
  { id: 'Classic', label: 'Thi Bút Classic', desc: 'Signature House Style' },
  { id: 'Shodō', label: 'Shodō', desc: 'Traditional Japanese Brush' },
  { id: 'Ink', label: 'Ink', desc: 'Bold Sumi-e Strokes' },
  { id: 'Zen', label: 'Zen', desc: 'Minimalist & Flowing' },
  { id: 'Seal', label: 'Seal', desc: 'Ancient Stamp Script' },
  { id: 'Modern', label: 'Modern', desc: 'Clean & Contemporary' },
  { id: 'Luxury', label: 'Luxury', desc: 'Gold-accented Elegance' },
  { id: 'Street', label: 'Street', desc: 'Urban Brush Energy' },
  { id: 'Minimal', label: 'Minimal', desc: 'Negative Space Focus' },
];

const COMPOSITIONS = [
  { id: 'Vertical', label: 'Vertical', desc: 'Top-to-Bottom' },
  { id: 'Centered', label: 'Centered', desc: 'Chest Center' },
  { id: 'LeftChest', label: 'Left Chest', desc: 'Small Logo Placement' },
  { id: 'FullBack', label: 'Full Back', desc: 'Statement Back Print' },
  { id: 'Sleeve', label: 'Sleeve', desc: 'Sleeve Band' },
];


export function ControlsDrawer({
  activeTab,
  setActiveTab,
  inputText,
  setInputText,
  interpretation,
  setInterpretation,
  stylePack,
  setStylePack,
  composition,
  setComposition
}: ControlsDrawerProps) {
  return (
    <div className="w-full flex flex-col space-y-10 pb-32">
      {/* 1. Mode Tabs */}
      <div className="space-y-4">
        <h2 className="font-headline-sm text-primary">1. Choose Meaning</h2>
        <div className="flex p-1 bg-surface-container-highest rounded-lg">
          {(['NAME', 'QUOTE', 'STORY'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-label-caps uppercase transition-all rounded-md ${
                activeTab === tab 
                  ? 'bg-background text-primary shadow-sm' 
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Enter your ${activeTab.toLowerCase()}...`}
          className="w-full bg-background border border-outline-variant rounded-lg p-4 font-body-md text-primary placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors resize-none h-32"
        />
      </div>

      {/* 2. Interpretation Selector */}
      <div className="space-y-4">
        <h2 className="font-headline-sm text-primary">2. Cultural Translation</h2>
        <div className="grid grid-cols-3 gap-3">
          {['Literal', 'Natural', 'Poetic'].map((opt) => (
            <button
              key={opt}
              onClick={() => setInterpretation(opt)}
              className={`py-3 px-2 border rounded-lg font-body-md text-sm transition-all ${
                interpretation === opt 
                  ? 'border-secondary bg-secondary/5 text-secondary' 
                  : 'border-outline-variant text-on-surface-variant hover:border-primary'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Style Pack Grid */}
      <div className="space-y-4">
        <h2 className="font-headline-sm text-primary">3. Visual Style</h2>
        <div className="grid grid-cols-3 gap-3">
          {STYLE_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setStylePack(pack.id)}
              className={`relative p-3 border flex flex-col items-start text-left transition-all ${
                stylePack === pack.id
                  ? 'border-primary bg-surface-container-highest'
                  : 'border-outline-variant bg-background hover:border-primary'
              }`}
            >
              {stylePack === pack.id && (
                <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
              )}
              <span className="font-body-md text-primary font-medium text-sm mb-0.5">{pack.label}</span>
              <span className="font-label-caps text-on-surface-variant text-[10px] leading-tight">{pack.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Composition Selector */}
      <div className="space-y-4">
        <h2 className="font-headline-sm text-primary">4. Composition</h2>
        <div className="flex flex-wrap gap-3">
          {COMPOSITIONS.map((comp) => (
            <button
              key={comp.id}
              onClick={() => setComposition(comp.id)}
              className={`px-4 py-2 border font-label-caps text-label-caps uppercase transition-all ${
                composition === comp.id
                  ? 'border-primary bg-surface-container-highest text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary'
              }`}
            >
              {comp.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
