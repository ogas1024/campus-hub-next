import type * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * 统一页面 Header（紧凑层级：title/description/meta/actions）。
 *
 * 约定：
 * - 用于 Portal / Console（不含 Auth）。
 * - meta 用于统计/徽标等“状态信息”；actions 用于按钮/跳转等“可操作项”。
 */
export function PageHeader(props: Props) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", props.className)}>
      <div className="min-w-0 space-y-1">
        {props.eyebrow ? <div className="text-xs font-semibold text-muted-foreground">{props.eyebrow}</div> : null}
        <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
        {props.description ? <div className="text-sm text-muted-foreground">{props.description}</div> : null}
        {props.meta ? <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">{props.meta}</div> : null}
      </div>

      {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
    </div>
  );
}

