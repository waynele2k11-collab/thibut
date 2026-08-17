import { galleryProducts } from "@/data/gallery";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import { GalleryDetailActions } from "@/components/gallery/GalleryDetailActions";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = galleryProducts.find((i) => i.slug === slug);
  if (!item) return { title: "Not Found" };
  
  return {
    title: `${item.title} — Thi Bút Gallery`,
    description: `Explore "${item.title}" — a ${item.category} transformed into ${item.productType.replace("_", " ").toLowerCase()} via Thi Bút.`,
  };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = galleryProducts.find((i) => i.slug === slug);

  if (!item) {
    notFound();
  }

  const primaryImage = item.mockups.find(m => m.view === "FRONT")?.asset || item.mockups[0]?.asset;

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currency,
    minimumFractionDigits: 0,
  }).format(item.retailPriceMinor / 100);

  return (
    <main className="min-h-screen bg-background">
      
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 md:py-24">
        <Link 
          href="/gallery" 
          className="inline-flex items-center text-on-surface-variant hover:text-on-surface transition-colors mb-12 font-label-caps text-label-caps uppercase"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Gallery
        </Link>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
          {/* LEFT: Product Mockup Carousel */}
          <div className="flex-1">
            <div className="relative w-full aspect-[3/4] bg-surface rounded-2xl overflow-hidden shadow-sm sticky top-24">
              {primaryImage && (
                <Image
                  src={primaryImage}
                  alt={item.title}
                  fill
                  className="object-cover"
                  priority
                />
              )}
            </div>
          </div>

          {/* RIGHT: Ecommerce Data + Design Meaning */}
          <div className="flex-1 flex flex-col">
            <div className="max-w-md">
              
              {/* TOP: ECOMMERCE DATA */}
              <div className="mb-16">
                <h1 className="font-display-lg text-display-md md:text-display-lg text-on-background mb-2">
                  {item.design.sourceText}
                </h1>
                
                <p className="font-display-md text-title-lg text-on-surface-variant mb-6">
                  {item.design.renderedText} · {item.design.styleName} Edition
                </p>

                <p className="font-display-sm text-headline-sm text-on-background mb-10">
                  {formattedPrice}
                </p>

                <div className="space-y-6 mb-10">
                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Product</h3>
                    <p className="font-body text-body-lg text-on-background">{item.productName}</p>
                  </div>
                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Color</h3>
                    <p className="font-body text-body-lg text-on-background">{item.color}</p>
                  </div>
                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Size</h3>
                    <p className="font-body text-body-md text-on-surface-variant">Available at checkout</p>
                  </div>
                </div>

                {/* Client component for Actions/Modal */}
                <GalleryDetailActions product={item} />
              </div>

              {/* BOTTOM: THE WORDS */}
              <div className="pt-12 border-t border-surface-variant">
                <h2 className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em] mb-10">
                  The Words
                </h2>

                <div className="space-y-8">
                  <div>
                    <p className="font-display-md text-display-md mb-2">{item.design.renderedText}</p>
                    <p className="font-body text-body-lg text-on-surface-variant">{item.design.romanization}</p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      {item.design.interpretationType.replace("_", " ")} Meaning
                    </h3>
                    <p className="font-body text-body-lg text-on-background">{item.design.meaning}</p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Style</h3>
                    <p className="font-body text-body-lg text-on-background">{item.design.styleName}</p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Language</h3>
                    <p className="font-body text-body-lg text-on-background">{item.design.language}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
