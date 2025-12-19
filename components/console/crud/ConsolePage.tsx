/**
 * 用法：
 * - 作为 Console 页面通用外壳：
 *   <ConsolePage title="标题" description="描述" actions={<.../>} meta={<.../>}>
 *     {children}
 *   </ConsolePage>
 */

"use client";

import type * as React from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function ConsolePage(props: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          {props.eyebrow ? <div className="text-xs font-semibold text-muted-foreground">{props.eyebrow}</div> : null}
          <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
          {props.description ? <p className="text-sm text-muted-foreground">{props.description}</p> : null}
          {props.meta ? <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">{props.meta}</div> : null}
        </div>
        {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
      </div>

      {props.children}
    </div>
  );
}
