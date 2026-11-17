export default function GalleryLoading() {
  return (
    <main className="flex-1 bg-background py-12 md:py-20" aria-busy="true">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="mb-12 space-y-4">
          <div className="h-4 w-32 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
          <div className="h-10 w-72 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="h-9 w-24 rounded bg-surface-container border border-surface-variant animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden"
            >
              <div className="aspect-[4/5] bg-surface-container animate-pulse motion-reduce:animate-none" />
              <div className="p-6 space-y-3">
                <div className="h-5 w-2/3 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
                <div className="h-4 w-1/2 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
