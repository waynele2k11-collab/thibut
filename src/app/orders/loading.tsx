export default function BuyerOrdersLoading() {
  return (
    <main className="flex-1 bg-background min-h-[80vh]" aria-busy="true">
      <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-14 space-y-6">
        <div className="h-8 w-64 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
        <div className="h-44 w-full rounded-lg bg-surface-container-lowest border border-surface-variant animate-pulse motion-reduce:animate-none" />
        <div className="h-44 w-full rounded-lg bg-surface-container-lowest border border-surface-variant animate-pulse motion-reduce:animate-none" />
      </div>
    </main>
  );
}
