"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WorkbenchActionVariant, WorkbenchDialog } from "@/lib/workbench/types";

export function WorkbenchDialogAction(props: { label: string; variant?: WorkbenchActionVariant; dialog: WorkbenchDialog }) {
  const variant = props.variant ?? "default";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          {props.label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.dialog.title}</DialogTitle>
          {props.dialog.description ? <DialogDescription>{props.dialog.description}</DialogDescription> : null}
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-auto rounded-lg border border-border">
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

        <DialogFooter>
          {props.dialog.items.length > 0 && props.dialog.items.every((i) => i.href) ? (
            <div className="mr-auto text-xs text-muted-foreground">点击条目可进入详情。</div>
          ) : null}
          <DialogClose asChild>
            <button className={buttonVariants({ size: "sm", variant: "outline" })}>关闭</button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

