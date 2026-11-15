"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as fabric from "fabric";

export interface MainStageCanvasRef {
  downloadHighRes: () => void;
  getCanvasDataUrl: () => string | null;
}

interface MainStageCanvasProps {
  viewMode: "RAW_ART" | "MOCKUP";
  layoutMode: "HORIZONTAL" | "VERTICAL";
  artworkSvgUrl: string; // the base64 SVG or generated SVG string
  fontFamily: string; // Used for preloading
  productImageUrl?: string; // background for mockup mode
  hasSeal: boolean;
  sealStyle: string;
  sealColor: string; // Vermilion Red (#B3261E)
  sealText?: string;
  sealFontFamily?: string;
}

export const MainStageCanvas = forwardRef<MainStageCanvasRef, MainStageCanvasProps>(({
  viewMode,
  layoutMode,
  artworkSvgUrl,
  fontFamily,
  productImageUrl,
  hasSeal,
  sealStyle,
  sealColor,
  sealText,
  sealFontFamily,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Initialize Fabric Canvas
    const fCanvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 800,
      preserveObjectStacking: true,
      selection: true,
    });
    
    setCanvas(fCanvas);

    return () => {
      fCanvas.dispose();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    downloadHighRes: () => {
      if (!canvas) return;
      const dataUrl = canvas.toDataURL({
        format: "png",
        multiplier: 3, // 300 DPI equivalent for 800px base
      });
      const link = document.createElement("a");
      link.download = `thibut-mockup-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    getCanvasDataUrl: () => {
      if (!canvas) return null;
      return canvas.toDataURL({
        format: "png",
        multiplier: 1,
      });
    }
  }));

  // Handle Background updates
  useEffect(() => {
    if (!canvas) return;

    if (viewMode === "RAW_ART") {
      // Warm Ivory Texture Background
      canvas.backgroundColor = "#FAF7F2";
      canvas.backgroundImage = undefined;
      canvas.renderAll();
    } else if (viewMode === "MOCKUP" && productImageUrl) {
      fabric.Image.fromURL(productImageUrl).then((img) => {
        const scaleX = canvas.width! / (img.width || 1);
        const scaleY = canvas.height! / (img.height || 1);
        const scale = Math.max(scaleX, scaleY); // Use Math.max for cover, Math.min for contain

        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: 'center',
          originY: 'center',
          left: canvas.width! / 2,
          top: canvas.height! / 2
        });

        canvas.backgroundImage = img;
        canvas.renderAll();
      });
    }
  }, [canvas, viewMode, productImageUrl]);

  // Handle Artwork updates
  useEffect(() => {
    if (!canvas || !artworkSvgUrl) return;

    let isCancelled = false;
    let cachedState = {
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      scaleX: 1,
      scaleY: 1,
      angle: 0
    };

    const existingArtwork = canvas.getObjects().find(obj => obj.name === "artwork");
    if (existingArtwork) {
      cachedState = {
        left: existingArtwork.left ?? cachedState.left,
        top: existingArtwork.top ?? cachedState.top,
        scaleX: existingArtwork.scaleX ?? cachedState.scaleX,
        scaleY: existingArtwork.scaleY ?? cachedState.scaleY,
        angle: existingArtwork.angle ?? cachedState.angle
      };
      canvas.remove(existingArtwork);
    }

    const loadArtwork = () => {
      fabric.loadSVGFromURL(artworkSvgUrl).then(({ objects, options }) => {
        if (isCancelled) return;
        
        // Remove any artwork that might have been added by a concurrent load
        const currentArtwork = canvas.getObjects().find(obj => obj.name === "artwork");
        if (currentArtwork) {
          canvas.remove(currentArtwork);
        }

        const artworkGroup = fabric.util.groupSVGElements(objects, options);
        
        // Auto-scale to fit canvas bounds
        let finalScaleX = cachedState.scaleX;
        let finalScaleY = cachedState.scaleY;
        
        if (!existingArtwork) {
          const padding = 80; // 40px padding on each side
          const scaleToFitWidth = (canvas.width! - padding) / (artworkGroup.width || canvas.width!);
          const scaleToFitHeight = (canvas.height! - padding) / (artworkGroup.height || canvas.height!);
          const minScale = Math.min(scaleToFitWidth, scaleToFitHeight, 1);
          finalScaleX = minScale;
          finalScaleY = minScale;
        }

        artworkGroup.set({
          name: "artwork",
          left: cachedState.left,
          top: cachedState.top,
          originX: "center",
          originY: "center",
          scaleX: finalScaleX,
          scaleY: finalScaleY,
          angle: cachedState.angle,
          cornerColor: "#B3261E",
          cornerStyle: "circle",
          transparentCorners: false,
          borderColor: "#B3261E",
          globalCompositeOperation: "source-over",
        });
        
        canvas.add(artworkGroup);
        canvas.setActiveObject(artworkGroup);
        canvas.renderAll();
      });
    };

    // Ensure the specific font is loaded before loading SVG onto canvas
    const fontToLoad = fontFamily ? `12px "${fontFamily}"` : '12px serif';
    document.fonts.load(fontToLoad).then(() => {
      if (isCancelled) return;
      loadArtwork();
    }).catch(err => {
      console.warn("Font loading failed, rendering with fallback", err);
      if (isCancelled) return;
      loadArtwork();
    });

    return () => {
      isCancelled = true;
    };
  }, [canvas, artworkSvgUrl, layoutMode, viewMode, fontFamily]);

  // Handle Seal updates
  useEffect(() => {
    if (!canvas) return;

    let isCancelled = false;
    let cachedState = {
      left: canvas.width! / 2 + 150,
      top: canvas.height! / 2 + 100,
      scaleX: 1,
      scaleY: 1,
      angle: 0
    };

    const existingSeal = canvas.getObjects().find(obj => obj.name === "seal");
    if (existingSeal) {
      cachedState = {
        left: existingSeal.left ?? cachedState.left,
        top: existingSeal.top ?? cachedState.top,
        scaleX: existingSeal.scaleX ?? cachedState.scaleX,
        scaleY: existingSeal.scaleY ?? cachedState.scaleY,
        angle: existingSeal.angle ?? cachedState.angle
      };
      canvas.remove(existingSeal);
    }

    if (hasSeal) {
      const displaySealText = sealText || "印";
      const fontSize = displaySealText.length > 2 ? 34 : 50;
      const displayFont = sealFontFamily ? `'${sealFontFamily}', serif` : "serif";

      const renderSeal = () => {
        if (isCancelled) return;
        const sealSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <rect x="5" y="5" width="90" height="90" fill="${sealColor}" stroke="none"/>
            <rect x="9" y="9" width="82" height="82" fill="none" stroke="#FFFFFF" stroke-width="2"/>
            <text x="50" y="55" font-family="${displayFont}" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${displaySealText}</text>
          </svg>
        `;
        const blob = new Blob([sealSvg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);

        fabric.loadSVGFromURL(url).then(({ objects, options }) => {
          if (isCancelled) return;
          
          // Ensure no concurrent seal was added
          const currentSeal = canvas.getObjects().find(obj => obj.name === "seal");
          if (currentSeal) {
            canvas.remove(currentSeal);
          }

          const sealGroup = fabric.util.groupSVGElements(objects, options);
          sealGroup.set({
            name: "seal",
            left: cachedState.left,
            top: cachedState.top,
            scaleX: cachedState.scaleX,
            scaleY: cachedState.scaleY,
            angle: cachedState.angle,
            originX: "center",
            originY: "center",
            cornerColor: "#B3261E",
            cornerStyle: "circle",
            transparentCorners: false,
            borderColor: "#B3261E",
            globalCompositeOperation: "source-over",
          });
          canvas.add(sealGroup);
          canvas.renderAll();
          URL.revokeObjectURL(url);
        });
      };

      if (sealFontFamily) {
        document.fonts.load(`${fontSize}px '${sealFontFamily}'`).then(renderSeal).catch(renderSeal);
      } else {
        renderSeal();
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [canvas, hasSeal, sealStyle, sealColor, sealText, sealFontFamily, viewMode]);

  return (
    <div className="w-full h-full flex items-center justify-center p-8 overflow-auto">
      <div className="relative bg-white shadow-xl shadow-stone-900/10 rounded-sm overflow-hidden shrink-0" style={{ width: 800, height: 800 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
});
