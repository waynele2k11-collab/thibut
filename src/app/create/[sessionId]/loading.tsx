export default function CreateSessionLoading() {
  return (
    <main className="flex-1 bg-background min-h-[80vh]" aria-busy="true">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-variant">
          <div className="h-5 w-48 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
          <div className="h-9 w-32 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-8 aspect-[4/5] sm:aspect-[16/11] rounded-lg bg-surface-container border border-surface-variant animate-pulse motion-reduce:animate-none" />
          <div className="lg:col-span-4 space-y-4 bg-surface-container-lowest border border-surface-variant rounded-lg p-6">
            <div className="h-6 w-2/3 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
            <div className="h-24 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
            <div className="h-24 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
            <div className="h-12 w-full rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      </div>
    </main>
  );
}
