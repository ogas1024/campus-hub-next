import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";
import { libraryConsoleEntryPermCodes } from "@/lib/navigation/modules";

import { listConsoleLibraryBooks } from "./library.service";

export const libraryWorkbenchProvider: WorkbenchProvider = {
  id: "library",
  order: 35,
  async getCards(ctx) {
    const canReview = await ctx.canPerm("campus:library:review");
    if (!canReview) return [];

    const pendingTotal = await listConsoleLibraryBooks({
      page: 1,
      pageSize: 1,
      status: "pending",
    }).then((r) => r.total);

    return [
      {
        id: "library.pending",
        order: 10,
        title: "数字图书馆：待审核",
        description: "仅统计 pending；在“待审核”列表中进行通过/驳回。",
        metrics: [{ id: "pending", label: "待审核", value: pendingTotal }],
        actions: [{ kind: "link", id: "review", label: "去处理", href: "/console/library/pending" }],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canEnter = await ctx.canAnyPerm(libraryConsoleEntryPermCodes);
    if (!canEnter) return [];
    const links: WorkbenchQuickLink[] = [
      { id: "console.library", order: 60, label: "数字图书馆", href: "/console/library", variant: "default" },
    ];
    return links;
  },
};

