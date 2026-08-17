import { GalleryGrid } from "@/components/gallery/GalleryGrid";
export const metadata = {
  title: "Thi Bút Gallery — Words Become Art",
  description: "Explore names, poetry, and heritage transformed into meaningful Thi Bút calligraphy and wearable art.",
};

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-background">
      
      {/* Gallery Header */}
      <section className="pt-24 pb-12 text-center px-margin-mobile md:px-margin-desktop">
        <h1 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-6">
          Gallery
        </h1>
        <h2 className="font-display-lg text-display-md md:text-display-lg text-on-background max-w-3xl mx-auto leading-tight mb-6">
          Ideas Made Personal.
        </h2>
        <p className="font-body text-body-lg text-on-surface-variant max-w-xl mx-auto">
          Explore names, words, and stories transformed through Thi Bút.
        </p>
      </section>

      {/* Main Grid */}
      <GalleryGrid />
    </main>
  );
}
