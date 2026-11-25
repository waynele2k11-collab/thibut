export default function AdminLoading() {
  return (
    <div className="p-6 md:p-10 space-y-8 bg-background" aria-busy="true">
      <div className="space-y-3">
        <div className="h-4 w-28 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
        <div className="h-8 w-60 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-surface-container-lowest border border-surface-variant rounded-lg p-6 space-y-3"
          >
            <div className="h-3 w-24 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
            <div className="h-8 w-32 rounded bg-surface-container-high animate-pulse motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="h-12 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
