"use client";

import { useState } from "react";
import Link from "next/link";

import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { Button } from "@/components/ui/button";
import type { WorkbenchActionVariant, WorkbenchDialog } from "@/lib/workbench/types";

export function WorkbenchDialogAction(props: { label: string; variant?: WorkbenchActionVariant; dialog: WorkbenchDialog }) {
  const variant = props.variant ?? "default";
  const [open, setOpen] = useState(false);

  const hintClickable = props.dialog.items.length > 0 && props.dialog.items.every((i) => i.href);
  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {hintClickable ? <div className="text-xs text-muted-foreground">点击条目可进入详情。</div> : null}
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
        关闭
      </Button>
    </div>
  );

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        {props.label}
      </Button>

      <StickyFormDialog
        open={open}
        onOpenChange={setOpen}
        title={props.dialog.title}
        description={props.dialog.description ?? undefined}
        footer={footer}
        contentClassName="max-w-xl"
      >
        <div className="rounded-lg border border-border">
          {props.dialog.items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">{props.dialog.emptyText ?? "暂无数据"}</div>
          ) : (
            <ul className="divide-y divide-border/50">
              {props.dialog.items.map((item) => (
                <li key={item.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    {item.href ? (
                      <Link href={item.href} className="min-w-0 flex-1 truncate font-medium hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1 truncate font-medium">{item.title}</div>
                    )}
                    {item.meta ? <div className="shrink-0 text-xs text-muted-foreground">{item.meta}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </StickyFormDialog>
    </>
  );
}
