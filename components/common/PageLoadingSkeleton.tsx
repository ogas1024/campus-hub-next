import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "edit" | "results";
  className?: string;
};

/**
 * 页面级加载骨架屏：用于非弹窗页面的首屏 loading，替换“加载中...”文本（统一体感与风格）。
 */
export function PageLoadingSkeleton({ variant = "edit", className }: Props) {
  const showDescription = variant === "results";

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-36" />
          {showDescription ? <Skeleton className="h-4 w-64" /> : null}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {variant === "results" ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

