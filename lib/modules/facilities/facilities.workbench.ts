import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";
import { facilitiesConsoleEntryPermCodes } from "@/lib/navigation/modules";

import { listConsoleReservations } from "./facilities.service";

export const facilitiesWorkbenchProvider: WorkbenchProvider = {
  id: "facilities",
  order: 30,
  async getCards(ctx) {
    const canReview = await ctx.canPerm("campus:facility:review");
    if (!canReview) return [];

    const pendingTotal = await listConsoleReservations({
      actorUserId: ctx.actorUserId,
      page: 1,
      pageSize: 1,
      status: "pending",
    }).then((r) => r.total);

    return [
      {
        id: "facilities.reservations.pending",
        order: 10,
        title: "功能房预约：待审核",
        description: "仅统计待审核预约；在“预约审核”页面进行通过/驳回。",
        metrics: [{ id: "pending", label: "待审核", value: pendingTotal }],
        actions: [
          { kind: "link", id: "review", label: "去处理", href: "/console/facilities/reservations?status=pending" },
          { kind: "link", id: "all", label: "全部预约", href: "/console/facilities/reservations", variant: "outline" },
        ],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canEnter = await ctx.canAnyPerm(facilitiesConsoleEntryPermCodes);
    if (!canEnter) return [];

    const links: WorkbenchQuickLink[] = [
      { id: "console.facilities", order: 40, label: "功能房预约", href: "/console/facilities", variant: "default" },
    ];
    return links;
  },
};

