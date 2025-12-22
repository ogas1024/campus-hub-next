import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";
import { lostfoundConsoleEntryPermCodes } from "@/lib/navigation/modules";

import { listConsoleLostfound } from "./lostfound.service";

export const lostfoundWorkbenchProvider: WorkbenchProvider = {
  id: "lostfound",
  order: 60,
  async getCards(ctx) {
    const canReview = await ctx.canPerm("campus:lostfound:review");
    if (!canReview) return [];

    const pendingTotal = await listConsoleLostfound({
      page: 1,
      pageSize: 1,
      status: "pending",
    }).then((r) => r.total);

    return [
      {
        id: "lostfound.pending",
        order: 10,
        title: "失物招领：待审核",
        description: "仅统计 pending；在“待审核”列表中进行通过/驳回/下架等操作。",
        metrics: [{ id: "pending", label: "待审核", value: pendingTotal }],
        actions: [{ kind: "link", id: "review", label: "去处理", href: "/console/lostfound/pending" }],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canEnter = await ctx.canAnyPerm(lostfoundConsoleEntryPermCodes);
    if (!canEnter) return [];
    const links: WorkbenchQuickLink[] = [
      { id: "console.lostfound", order: 80, label: "失物招领", href: "/console/lostfound", variant: "default" },
    ];
    return links;
  },
};

