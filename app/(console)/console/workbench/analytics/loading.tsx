import { Skeleton } from "@/components/ui/skeleton";

export default function ConsoleWorkbenchAnalyticsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <Skeleton className="h-56 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

