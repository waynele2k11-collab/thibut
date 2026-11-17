export default function CheckoutLoading() {
  return (
    <main className="flex-1 bg-background py-12 md:py-20" aria-busy="true">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="h-9 w-64 rounded bg-surface-container-high mb-10 animate-pulse motion-reduce:animate-none" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-8 space-y-4">
              <div className="h-5 w-40 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
              <div className="h-24 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
              <div className="h-24 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-8 space-y-4">
              <div className="h-6 w-48 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-3/4 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
              <div className="h-12 w-full rounded bg-surface-container-high mt-6 animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
