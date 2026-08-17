import React from 'react';
import { Layers } from 'lucide-react';

interface CanvasPreviewProps {
  inputText: string;
  interpretation: string;
  stylePack: string;
}

export function CanvasPreview({ inputText, interpretation, stylePack }: CanvasPreviewProps) {
  return (
    <div className="w-full h-full min-h-[60vh] md:min-h-[80vh] relative bg-surface-container-highest flex items-center justify-center p-8 rounded-lg overflow-hidden group">
      {/* Simulated texture/garment background */}
      <img
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDA-xqdAr5uF8q7H2XYGhT6BxFjLjWe-1669EcvwFCPiTr9gFVtnzc_BSmRmq0_sngcI867AcXOqrFKBz_EpttmTdRgHANT4YNsjtaqfibOQ9IlKn7nR1VRdd6Wg7g2-8rUunhJ0QcV-NDwyBACOqZR7eFJu-SlskItrkE-J5SyZUQQ_wpI9xzkcgS6xFoiDq5dHBJsCWXePnLba63MwEoTYE5a2NfeeR_JCNzw84vAh0X0LSmjWYf2"
        alt="Garment Preview"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      />
      
      {/* Interactive Composition Bounding Box */}
      <div className="relative z-10 w-[200px] h-[300px] md:w-[250px] md:h-[350px] border-2 border-dashed border-primary/40 group-hover:border-primary/80 transition-colors flex flex-col items-center justify-center p-4 bg-background/30 backdrop-blur-sm rounded">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-surface px-2 py-0.5 text-[10px] font-label-caps text-on-surface-variant uppercase border border-outline-variant rounded">
          Print Area
        </div>
        
        {/* Placeholder for actual generated calligraphy */}
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <Layers className="w-8 h-8 text-primary/50" />
          <div className="font-display-lg text-primary text-3xl">
            {inputText || "Your Words"}
          </div>
          <div className="text-sm font-label-caps text-on-surface-variant">
            {stylePack} Style
          </div>
          <div className="text-xs text-primary/60 italic font-body-md">
            {interpretation} Interpretation
          </div>
        </div>
      </div>
    </div>
  );
}
