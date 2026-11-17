import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { GalleryDetailActions } from "@/components/gallery/GalleryDetailActions";
import { assertAdminApi } from "@/utils/admin/auth";

interface Props {
  params: Promise<{ slug: string }>;
}

interface LayerTransform {
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotation?: number;
}

interface DesignSpecParams {
  inkColor?: string;
  strokePreset?: string;
  fontName?: string;
  layout?: string;
  hasSeal?: boolean;
}

interface ParsedMockupTransform {
  customImageUrl?: string;
  translateX?: number;
  translateY?: number;
  scale?: number;
  background?: LayerTransform;
  artwork?: LayerTransform;
  printArea?: {
    topPct?: number;
    leftPct?: number;
    widthPct?: number;
    heightPct?: number;
  };
  designParams?: DesignSpecParams;
}

function asRecord(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
}

function asNumber(val: unknown): number | undefined {
  return typeof val === "number" && Number.isFinite(val) ? val : undefined;
}

function parseLayerTransform(val: unknown): LayerTransform | undefined {
  const rec = asRecord(val);
  if (!rec) return undefined;
  return {
    translateX: asNumber(rec.translateX),
    translateY: asNumber(rec.translateY),
    scale: asNumber(rec.scale),
    rotation: asNumber(rec.rotation),
  };
}

function parseMockupTransform(raw: unknown): ParsedMockupTransform | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const printAreaRec = asRecord(rec.printArea);
  const designRec = asRecord(rec.designParams);

  return {
    customImageUrl:
      typeof rec.customImageUrl === "string" && rec.customImageUrl.length > 0
        ? rec.customImageUrl
        : undefined,
    translateX: asNumber(rec.translateX),
    translateY: asNumber(rec.translateY),
    scale: asNumber(rec.scale),
    background: parseLayerTransform(rec.background),
    artwork: parseLayerTransform(rec.artwork),
    printArea: printAreaRec
      ? {
          topPct: asNumber(printAreaRec.topPct),
          leftPct: asNumber(printAreaRec.leftPct),
          widthPct: asNumber(printAreaRec.widthPct),
          heightPct: asNumber(printAreaRec.heightPct),
        }
      : undefined,
    designParams: designRec
      ? {
          inkColor:
            typeof designRec.inkColor === "string"
              ? designRec.inkColor
              : undefined,
          strokePreset:
            typeof designRec.strokePreset === "string"
              ? designRec.strokePreset
              : undefined,
          fontName:
            typeof designRec.fontName === "string"
              ? designRec.fontName
              : undefined,
          layout:
            typeof designRec.layout === "string" ? designRec.layout : undefined,
          hasSeal:
            typeof designRec.hasSeal === "boolean"
              ? designRec.hasSeal
              : undefined,
        }
      : undefined,
  };
}

async function isCallerAdmin(): Promise<boolean> {
  try {
    await assertAdminApi();
    return true;
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await prisma.galleryItem.findUnique({ where: { slug } });
  if (!item || (!item.published && !(await isCallerAdmin()))) {
    return { title: "Not Found", robots: { index: false } };
  }

  return {
    title: `${item.title} — Thi Bút Gallery`,
    description: `Explore "${item.title}" — mapped to ${item.productName} via Thi Bút.`,
  };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await prisma.galleryItem.findUnique({ where: { slug } });

  if (!item) {
    notFound();
  }

  if (!item.published && !(await isCallerAdmin())) {
    notFound();
  }

  const primaryImage = item.productImageUrl;
  const artworkImage = item.artworkPreviewUrl;
  const mt = parseMockupTransform(item.mockupTransform);
  const formattedPrice = formatMinor(item.listedPriceMinor, item.currency);
  const isVietnamese = Boolean(
    item.sourceLanguage?.toLowerCase().includes("vi") ||
      item.tradition?.includes("VIETNAMESE")
  );

  const isApparel = Boolean(
    item.productName
      .toLowerCase()
      .match(/shirt|tee|hoodie|tank|shorts|leggings|jersey/)
  );

  const fallbackPrintArea = {
    top: isApparel ? "22%" : "15%",
    left: isApparel ? "30%" : "15%",
    width: isApparel ? "40%" : "70%",
    height: isApparel ? "55%" : "70%",
  };

  const bgTransformStyle = mt
    ? {
        transform: `translate(${mt.background?.translateX ?? mt.translateX ?? 0}px, ${
          mt.background?.translateY ?? mt.translateY ?? 0
        }px) scale(${mt.background?.scale ?? mt.scale ?? 1})`,
      }
    : undefined;

  const printAreaStyle = mt?.printArea
    ? {
        top: `${mt.printArea.topPct ?? 20}%`,
        left: `${mt.printArea.leftPct ?? 25}%`,
        width: `${mt.printArea.widthPct ?? 50}%`,
        height: `${mt.printArea.heightPct ?? 55}%`,
      }
    : fallbackPrintArea;

  const artTransformStyle = mt?.artwork
    ? {
        transform: `translate(${mt.artwork.translateX ?? 0}px, ${
          mt.artwork.translateY ?? 0
        }px) scale(${mt.artwork.scale ?? 1}) rotate(${mt.artwork.rotation ?? 0}deg)`,
      }
    : undefined;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 md:py-24">
        <Link
          href="/gallery"
          className="inline-flex items-center text-on-surface-variant hover:text-on-surface transition-colors motion-reduce:transition-none mb-12 font-label-caps text-label-caps uppercase"
        >
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Back to Gallery
        </Link>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
          <div className="flex-1">
            <div className="relative w-full aspect-[4/5] bg-surface border border-surface-variant rounded-lg overflow-hidden sticky top-24">
              {primaryImage &&
                (mt?.customImageUrl ? (
                  <Image
                    src={mt.customImageUrl}
                    alt={item.title}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <>
                    <Image
                      src={primaryImage}
                      alt={item.title}
                      fill
                      unoptimized
                      className="object-cover mix-blend-multiply absolute inset-0"
                      style={bgTransformStyle}
                      priority
                    />
                    {artworkImage &&
                    artworkImage.startsWith("data:image/svg+xml;base64,") ? (
                      <div
                        className="absolute z-10 flex items-center justify-center"
                        style={printAreaStyle}
                      >
                        <Image
                          src={artworkImage}
                          alt=""
                          width={400}
                          height={400}
                          unoptimized
                          className="max-w-full max-h-full w-auto h-auto object-contain pointer-events-none select-none"
                          style={artTransformStyle}
                        />
                      </div>
                    ) : artworkImage ? (
                      <Image
                        src={artworkImage}
                        alt=""
                        fill
                        unoptimized
                        className="object-contain scale-75 pointer-events-none select-none"
                      />
                    ) : null}
                  </>
                ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="max-w-md">
              <div className="mb-16">
                <h1
                  lang={isVietnamese ? "vi" : undefined}
                  className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background mb-2"
                >
                  {item.title}
                </h1>

                {item.subtitle && (
                  <p className="font-headline-sm text-headline-sm text-on-surface-variant mb-6">
                    {item.subtitle}
                  </p>
                )}

                <p className="font-headline-md text-headline-md text-on-background mb-10">
                  {formattedPrice}
                </p>

                <div className="space-y-6 mb-10">
                  <div>
                    <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      Product
                    </h2>
                    <p className="font-body-lg text-body-lg text-on-background">
                      {item.productName}
                    </p>
                  </div>
                  <div>
                    <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      Color
                    </h2>
                    <p className="font-body-lg text-body-lg text-on-background">
                      Available at checkout
                    </p>
                  </div>
                  {item.requiresSize && (
                    <div>
                      <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                        Size
                      </h2>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        Available at checkout
                      </p>
                    </div>
                  )}
                </div>

                <GalleryDetailActions product={{ id: item.id }} />
              </div>

              <div className="pt-12 border-t border-surface-variant">
                <h2 className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em] mb-10">
                  The Words
                </h2>

                <div className="space-y-8">
                  <div>
                    <p
                      lang={isVietnamese ? "vi" : undefined}
                      className="font-headline-md text-headline-md text-on-background mb-2"
                    >
                      {item.title}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      Meaning
                    </h3>
                    <p className="font-body-lg text-body-lg text-on-background">
                      {item.description}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      Tradition
                    </h3>
                    <p className="font-body-lg text-body-lg text-on-background">
                      {item.tradition?.replace(/_/g, " ")}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      Language
                    </h3>
                    <p className="font-body-lg text-body-lg text-on-background">
                      {item.sourceLanguage}
                    </p>
                  </div>
                </div>
              </div>

              {(() => {
                const design = mt?.designParams;
                if (!design) return null;
                const artScale = mt?.artwork?.scale ?? 1;
                const artTx = mt?.artwork?.translateX ?? 0;
                const artTy = mt?.artwork?.translateY ?? 0;

                // Allowlisted ink color data mapping for saved gallery artwork specs
                const inkMap: Record<string, string> = {
                  "#111111": "Charcoal Black",
                  "#F6F1E7": "Ivory White",
                  "#263238": "Navy Ink",
                  "#B3261E": "Cinnabar Red",
                };
                const displayInk = design.inkColor
                  ? inkMap[design.inkColor] ?? design.inkColor
                  : "Sumi Ink";

                const strokeMap: Record<string, string> = {
                  CLASSICAL: "Classical Elegance",
                  BOLD_BRUSH: "Bold Brush",
                  FLOWING_INK: "Flowing Ink",
                  DRY_BRUSH: "Dry Brush",
                  FREE_SPIRIT: "Free Spirit",
                };
                const displayStroke = design.strokePreset
                  ? strokeMap[design.strokePreset] ?? design.strokePreset
                  : "Controlled Brush";

                return (
                  <div className="pt-12 mt-12 border-t border-surface-variant">
                    <h2 className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em] mb-10">
                      Design Specifications
                    </h2>

                    <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                      <div>
                        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Pigment
                        </h3>
                        <p className="font-body-md text-body-md text-on-background">
                          {displayInk}
                        </p>
                      </div>

                      <div>
                        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Brush Style
                        </h3>
                        <p className="font-body-md text-body-md text-on-background">
                          {displayStroke}
                        </p>
                      </div>

                      {design.fontName && (
                        <div>
                          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                            Typography
                          </h3>
                          <p className="font-body-md text-body-md text-on-background">
                            {design.fontName}
                          </p>
                        </div>
                      )}

                      <div>
                        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Alignment
                        </h3>
                        <p className="font-body-md text-body-md text-on-background">
                          {design.layout ?? "VERTICAL"}
                          {design.hasSeal ? " + Seal" : ""}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Print Calibration (Zoom / Crop)
                        </h3>
                        <p className="font-body-md text-body-md text-on-background">
                          Scale: {Math.round(artScale * 100)}% &nbsp;|&nbsp;
                          Offset X: {Math.round(artTx)}px &nbsp;|&nbsp; Offset
                          Y: {Math.round(artTy)}px
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
