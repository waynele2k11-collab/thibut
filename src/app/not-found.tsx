import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center bg-background text-on-background px-margin-mobile md:px-margin-desktop py-24">
      <div className="w-full max-w-xl bg-surface-container-lowest border border-surface-variant rounded-lg p-8 md:p-14 text-center">
        <Badge variant="seal" className="mb-6">
          404 · Unwritten Scroll
        </Badge>
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-4">
          Page Not Found
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-md mx-auto">
          The scroll or artwork you are looking for has been moved or has not yet been inscribed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded bg-primary text-on-primary font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Explore Thi Bút
          </Link>
          <Link
            href="/custom"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded border border-outline text-primary font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Custom Keepsakes
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
