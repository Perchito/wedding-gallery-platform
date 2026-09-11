export default function DashboardListLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-5 py-8 sm:px-8">
      <div className="mb-6 h-8 w-48 rounded-lg bg-surface-muted" />
      <div className="mb-6 h-20 rounded-2xl bg-surface-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
