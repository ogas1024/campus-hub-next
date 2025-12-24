import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 骨架屏占位组件（全站统一风格）。
 *
 * 约定：
 * - 默认使用 `animate-pulse` 提供轻量反馈；
 * - 在 `prefers-reduced-motion: reduce` 下会自动降级为静态占位（见 `app/globals.css`）。
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

