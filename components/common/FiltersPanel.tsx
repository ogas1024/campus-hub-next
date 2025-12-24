import type * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * 紧凑筛选面板：统一列表页的筛选区外观（Portal + Console 复用）。
 */
export function FiltersPanel({ title = "筛选", description, className, children }: Props) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)} aria-label={title}>
      {title || description ? (
        <div className="border-b border-border/50 px-3 py-2">
          {title ? <div className="text-sm font-medium text-foreground">{title}</div> : null}
          {description ? <div className="mt-0.5 text-xs text-muted-foreground">{description}</div> : null}
        </div>
      ) : null}
      <div className="p-3">{children}</div>
    </section>
  );
}

