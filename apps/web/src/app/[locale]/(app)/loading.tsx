export default function Loading() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-[var(--card)]" />
      <div className="h-40 rounded-[var(--radius-lg)] bg-[var(--card)]" />
      <div className="h-64 rounded-[var(--radius-lg)] bg-[var(--card)]" />
    </div>
  );
}
