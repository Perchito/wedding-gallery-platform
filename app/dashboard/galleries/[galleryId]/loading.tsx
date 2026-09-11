export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-5 py-8 sm:px-8">
      <div className="mb-6 h-16 w-64 rounded-lg bg-surface-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-muted" />
        ))}
      </div>
      <div className="mt-10 h-6 w-40 rounded bg-surface-muted" />
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
