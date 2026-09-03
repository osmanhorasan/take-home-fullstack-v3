export function DailyViewsChart({ data }: { data: { date: string; views: number }[] }) {
  const max = Math.max(1, ...data.map((point) => point.views));
  return (
    <div role="img" aria-label="Daily views over the campaign period">
      <ul className="flex h-40 items-end gap-px overflow-x-auto">
        {data.map((point) => (
          <li key={point.date} className="flex min-w-[8px] flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t bg-primary/80"
              style={{ height: `${(point.views / max) * 100}%` }}
              title={`${point.date}: ${point.views} views`}
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Each bar is a UTC day in the campaign window. Missing metric days are drawn as zero.
      </p>
    </div>
  );
}
