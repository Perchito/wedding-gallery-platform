export default function GalleryLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-[52vh] min-h-[360px] w-full bg-surface-muted sm:h-[60vh]" />
      <div className="mt-4 flex gap-2 px-5 py-3 sm:px-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 shrink-0 rounded-full bg-surface-muted" />
        ))}
      </div>
      <div className="columns-2 gap-3 px-4 py-4 sm:columns-3 sm:px-8 lg:columns-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="mb-3 w-full rounded-xl bg-surface-muted"
            style={{ height: 140 + (i % 4) * 40 }}
          />
        ))}
      </div>
    </div>
  );
}
