/**
 * 用法：
 * - 表单弹窗加载态：
 *   {loading ? <DialogLoadingSkeleton rows={6} /> : <Form />}
 * - 内容弹窗加载态（公告/详情类）：
 *   {loading ? <DialogLoadingSkeleton variant="content" /> : <Content />}
 */
import type * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "form" | "content";
  rows?: number;
};

/**
 * 弹窗通用加载骨架屏（用于替换“加载中...”文本，提升体感）。
 *
 * - form：偏“表单字段”布局（label + input）
 * - content：偏“内容阅读”布局（标题 + 段落块）
 */
export function DialogLoadingSkeleton({ variant = "form", rows = 5, className, ...divProps }: Props) {
  if (variant === "content") {
    return (
      <div {...divProps} className={cn("space-y-4", className)}>
        <Skeleton className="h-6 w-2/3" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-9/12" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div {...divProps} className={cn("space-y-4", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={`row-${i}`} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
