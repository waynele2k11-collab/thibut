import Link from "next/link";
import { ShieldCheck, Package, Lock, CheckCircle2 } from "lucide-react";
import prisma from "@/lib/prisma";
import { CheckoutButton } from "./CheckoutButton";

const PRODUCT_DEFAULTS: Record<string, { size: string; color: string; mockup: string; price: number }> = {
  "Premium Hoodie": { size: "L", color: "Bone White", mockup: "/mockups/blank_hoodie.jpg", price: 99.00 },
  "Classic T-Shirt": { size: "L", color: "Bone White", mockup: "/mockups/model-male.jpg", price: 45.00 },
  "Fine Art Poster": { size: "18x24 in", color: "Natural Matte", mockup: "/mockups/fine-art-poster.jpg", price: 25.00 },
  "Poster": { size: "18x24 in", color: "Natural Matte", mockup: "/mockups/fine-art-poster.jpg", price: 25.00 },
  "Canvas Print": { size: "18x24 in", color: "Museum Wrap", mockup: "/mockups/framed_print.jpg", price: 49.00 },
  "Tote Bag": { size: "Standard (15x16 in)", color: "Natural Canvas", mockup: "/mockups/model-female.jpg", price: 29.00 },
  "Coffee Mug": { size: "15 oz", color: "Glossy White", mockup: "/mockups/fine-art-poster.jpg", price: 19.00 },
  "Digital Download (All 6)": { size: "4500x5400 px @ 300 DPI", color: "Lossless Vector (SVG + PNG)", mockup: "", price: 9.99 },
};

interface SearchParams {
  candidate?: string;
  product?: string;
  size?: string;
  color?: string;
  mockup?: string;
  sessionId?: string;
  text?: string;
  interpretedText?: string;
  interpretation?: string;
  meaning?: string;
  romanization?: string;
  style?: string;
  image?: string;
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const candidateId = params.candidate;
  const productId = params.product || "Premium Hoodie";
  const sessionId = params.sessionId || "00000000-0000-0000-0000-000000000000";

  const defaultCfg = PRODUCT_DEFAULTS[productId] || PRODUCT_DEFAULTS["Premium Hoodie"];
  const selectedSize = params.size || defaultCfg.size;
  const selectedColor = params.color || defaultCfg.color;
  const selectedMockup = params.mockup || defaultCfg.mockup;

  let calligraphyData: {
    sessionId: string;
    candidateId: string;
    imageUrl: string;
    inputText: string;
    interpretation: string;
    interpretedText: string;
    romanization: string;
    meaning: string;
    culturalNote: string;
  } | null = null;

  // 1. Try finding variation directly by ID in DB
  if (candidateId) {
    try {
      const candidate = await prisma.generatedDesignVariation.findUnique({
        where: { id: candidateId },
        include: {
          generatedDesign: {
            include: {
              phraseKnowledge: true,
            },
          },
        },
      });

      if (candidate) {
        const pk = candidate.generatedDesign.phraseKnowledge;
        calligraphyData = {
          sessionId,
          candidateId: candidate.id,
          imageUrl: candidate.assetId || "",
          inputText: pk.displayInput || pk.normalizedInput || pk.renderedText,
          interpretation: pk.interpretationType || "Original",
          interpretedText: pk.renderedText,
          romanization: pk.romanization || "",
          meaning: pk.meaning || pk.displayInput || "Custom calligraphy",
          culturalNote: pk.explanation || "Authentic brush vector composition.",
        };
      }
    } catch {
      // ignore
    }
  }

  // 2. If candidateId is a compound string (e.g. cand_<phraseKnowledgeId>_...)
  if (!calligraphyData && candidateId && candidateId.startsWith("cand_")) {
    try {
      const parts = candidateId.split("_");
      const pkid = parts[1];
      if (pkid) {
        const pk = await prisma.phraseKnowledge.findUnique({
          where: { id: pkid },
          include: {
            generatedDesigns: {
              include: {
                variations: true,
              },
            },
          },
        });

        if (pk) {
          const firstDesign = pk.generatedDesigns?.[0];
          const variation = firstDesign?.variations?.[0];
          calligraphyData = {
            sessionId,
            candidateId: variation?.id || candidateId,
            imageUrl: variation?.assetId || "",
            inputText: pk.displayInput || pk.normalizedInput || pk.renderedText,
            interpretation: pk.interpretationType || "Original",
            interpretedText: pk.renderedText,
            romanization: pk.romanization || "",
            meaning: pk.meaning || pk.displayInput || "Custom calligraphy",
            culturalNote: pk.explanation || "Authentic brush vector composition.",
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback to passed query params (from creation flow)
  if (!calligraphyData && (params.text || params.interpretedText)) {
    calligraphyData = {
      sessionId,
      candidateId: candidateId || "custom-candidate",
      imageUrl: params.image || "",
      inputText: params.text || params.interpretedText || "Custom Calligraphy",
      interpretation: params.interpretation || "Original Phrase",
      interpretedText: params.interpretedText || params.text || "Custom Calligraphy",
      romanization: params.romanization || "",
      meaning: params.meaning || params.text || "Personalized calligraphy art",
      culturalNote: "Created via Authentic Controlled Calligraphy Engine.",
    };
  }

  // 4. Default fallback if visited completely empty
  if (!calligraphyData) {
    calligraphyData = {
      sessionId: "00000000-0000-0000-0000-000000000000",
      candidateId: "mock-candidate-123",
      imageUrl: "",
      inputText: "Thi Bút",
      interpretation: "Original Masterwork",
      interpretedText: "Thi Bút",
      romanization: "Thi Bút",
      meaning: "Words Become Art (Poetic Calligraphy)",
      culturalNote: "Master Vietnamese Thư Pháp vector composition.",
    };
  }

  const designTitle = calligraphyData.inputText 
    ? `“${calligraphyData.inputText}” Calligraphy` 
    : "Custom Calligraphy Artwork";

  let items: { label: string; amount: string }[] = [];
  let totalPrice = 0;

  if (productId === "Digital Download (All 6)") {
    items = [
      { label: "Artwork License", amount: "$4.99" },
      { label: "AI Personalization", amount: "$2.00" },
      { label: "High-Res Digital Export (All Variations)", amount: "$3.00" },
    ];
    totalPrice = 9.99;
  } else {
    const targetRetail = defaultCfg.price || 45.00;
    const productCharge = targetRetail - 4.99 - 2.00;
    
    items = [
      { label: "Artwork License", amount: "$4.99" },
      { label: "AI Personalization", amount: "$2.00" },
      { label: `${productId} Base (${selectedColor})`, amount: `$${productCharge.toFixed(2)}` },
    ];
    totalPrice = targetRetail;
  }

  const permissions = {
    allowName: true,
    allowQuote: true,
    allowTranslation: true,
    allowCalligraphy: true,
    allowAIRestyle: false,
    allowCommercial: false,
    allowModelTraining: false,
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased">
      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-12">
        {/* Header */}
        <header className="border-b border-surface-variant pb-6">
          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">Secure Checkout</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Review your personalized artwork, product specifications, and complete your order.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* LEFT — Order Summary + License Snapshot */}
          <div className="lg:col-span-7 flex flex-col gap-8">

            {/* Product Summary */}
            <section className="border border-surface-variant bg-surface-container-lowest p-6 rounded-xl shadow-sm">
              <h2 className="font-headline-sm text-lg font-bold text-on-background mb-4">Product Selected</h2>
              <div className="flex items-start gap-5">
                <div className="w-32 h-32 bg-[#F6F1E7]/40 border border-surface-variant overflow-hidden flex-shrink-0 rounded-lg relative flex items-center justify-center shadow-inner">
                  {productId !== "Digital Download (All 6)" && selectedMockup && (
                    <img
                      src={selectedMockup}
                      alt={`${productId} in ${selectedColor}`}
                      className="w-full h-full object-cover pointer-events-none select-none"
                    />
                  )}
                  {calligraphyData.imageUrl && (
                    <img
                      src={calligraphyData.imageUrl}
                      alt="Artwork overlay"
                      className="absolute inset-0 m-auto w-3/5 h-3/5 object-contain mix-blend-multiply pointer-events-none select-none"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 justify-center">
                  <p className="font-body-md text-base font-bold text-on-background">{productId}</p>
                  <div className="flex flex-wrap gap-2 text-xs my-0.5">
                    <span className="px-2.5 py-1 bg-[#F4EFE6] border border-[#E5E0D8] text-[#111111] rounded font-mono font-semibold">
                      Size: {selectedSize}
                    </span>
                    <span className="px-2.5 py-1 bg-[#F4EFE6] border border-[#E5E0D8] text-[#111111] rounded font-mono font-semibold">
                      Color: {selectedColor}
                    </span>
                  </div>
                  <p className="font-label-caps text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                    <span>Qty: 1</span>
                    <span>•</span>
                    <span className="text-[#137333] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 inline" /> Print-Ready (300 DPI Vector)
                    </span>
                  </p>
                </div>
              </div>
            </section>

            {/* License Snapshot Card (INV-003 + INV-004) */}
            <section className="border border-surface-variant bg-surface-container-lowest p-8 flex flex-col gap-6 rounded-xl shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-background font-bold">{designTitle}</h2>
                  <p className="font-label-caps text-label-caps text-on-surface-variant mt-1 uppercase">
                    Design v1.0 · Personal Product License
                  </p>
                </div>
                <div className="flex items-center gap-1 text-on-surface-variant">
                  <Lock className="w-4 h-4" />
                  <span className="font-label-caps text-label-caps text-[10px] uppercase">Immutable Snapshot</span>
                </div>
              </div>

              {/* Calligraphy Semantic Breakdown (INV-011) */}
              <div className="border-t border-surface-variant pt-6">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-4 border-b border-surface-variant pb-2 font-bold tracking-wider">
                  Cultural Meaning & Artwork
                </h3>
                <div className="flex gap-6 items-start">
                  <div className="text-center bg-surface-container-low p-4 flex items-center justify-center min-h-[130px] min-w-[130px] max-w-[160px] border border-surface-variant overflow-hidden rounded-lg">
                    {calligraphyData.imageUrl ? (
                      <img
                        src={calligraphyData.imageUrl}
                        alt={calligraphyData.interpretedText}
                        className="max-h-28 w-auto object-contain select-none pointer-events-none"
                      />
                    ) : (
                      <span className="text-3xl text-on-background leading-none font-serif font-bold">
                        {calligraphyData.interpretedText}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Your phrase: <span className="text-on-background font-medium">&ldquo;{calligraphyData.inputText}&rdquo;</span>
                    </p>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Interpretation: <span className="text-on-background font-medium">{calligraphyData.interpretation}</span>
                    </p>
                    {calligraphyData.romanization && (
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        Romanization: <span className="text-on-background font-medium">{calligraphyData.romanization}</span>
                      </p>
                    )}
                    <p className="font-body-md text-body-md text-on-surface-variant italic">&ldquo;{calligraphyData.meaning}&rdquo;</p>
                    <p className="font-label-caps text-label-caps text-on-surface-variant text-[11px] mt-1">{calligraphyData.culturalNote}</p>
                  </div>
                </div>
              </div>

              {/* License Permissions Grid (INV-004 snapshot) */}
              <div className="border-t border-surface-variant pt-6">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-4 font-bold tracking-wider">
                  License Permissions (Frozen)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(permissions).map(([key, allowed]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${allowed ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                      <span className={`font-label-caps text-label-caps uppercase text-[11px] ${allowed ? 'text-on-background' : 'text-outline'}`}>
                        {key.replace(/allow/g, "").replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT — Payment Panel */}
          <div className="lg:col-span-5 flex flex-col gap-6 sticky top-8">
            {/* Price Breakdown */}
            <section className="border border-surface-variant bg-surface-container-lowest p-6 flex flex-col gap-4 rounded-xl shadow-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-background font-bold">Order Summary</h2>
              <div className="flex flex-col gap-3 border-b border-surface-variant pb-4">
                {items.map((item) => (
                  <div key={item.label} className="flex justify-between items-center text-sm">
                    <span className="font-body-md text-on-surface-variant">{item.label}</span>
                    <span className="font-body-md text-on-background font-medium">{item.amount}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="font-headline-sm text-lg font-bold text-on-background">Total</span>
                <span className="font-headline-sm text-xl font-bold text-[#B3261E]">${totalPrice.toFixed(2)}</span>
              </div>
            </section>

            {/* Express Payment */}
            <section className="flex flex-col gap-3">
              <CheckoutButton 
                sessionId={calligraphyData.sessionId} 
                candidateId={calligraphyData.candidateId} 
                productId={productId} 
              />
              <button className="w-full border border-outline-variant py-4 font-label-caps text-label-caps uppercase flex items-center justify-center gap-2 text-on-background hover:bg-surface-container-low transition-colors rounded-lg font-semibold">
                <Package className="w-5 h-5" />
                Apple Pay
              </button>
            </section>

            {/* Trust Signals */}
            <div className="flex items-center justify-center gap-2 text-on-surface-variant">
              <ShieldCheck className="w-4 h-4 text-[#137333]" />
              <span className="font-label-caps text-label-caps text-[11px] uppercase">Secure Checkout · Stripe Encrypted</span>
            </div>

            <p className="font-label-caps text-label-caps text-[11px] text-on-surface-variant text-center leading-relaxed">
              By completing this purchase, you agree to the license terms shown above. The design snapshot and permissions are permanently recorded and cannot be changed after purchase.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
