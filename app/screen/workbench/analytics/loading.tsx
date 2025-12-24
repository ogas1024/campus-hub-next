import { Skeleton } from "@/components/ui/skeleton";

export default function ScreenWorkbenchAnalyticsLoading() {
  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="col-span-12 rounded-xl border border-border bg-card p-5 lg:col-span-6">
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

