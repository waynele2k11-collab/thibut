export default function GalleryDetailLoading() {
  return (
    <main className="flex-1 bg-background py-12 md:py-20" aria-busy="true">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="h-4 w-40 rounded bg-surface-container-high mb-10 animate-pulse motion-reduce:animate-none" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-[4/5] rounded-lg bg-surface-container border border-surface-variant animate-pulse motion-reduce:animate-none" />
          <div className="space-y-6 py-4">
            <div className="h-4 w-28 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
            <div className="h-10 w-3/4 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
            <div className="h-7 w-24 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
            <div className="space-y-2 pt-4 border-t border-surface-variant">
              <div className="h-4 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-5/6 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
            </div>
            <div className="h-12 w-full rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      </div>
    </main>
  );
}
