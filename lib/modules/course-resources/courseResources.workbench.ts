import "server-only";

import { courseResourcesConsoleEntryPermCodes } from "@/lib/navigation/modules";
import type { WorkbenchProvider } from "@/lib/workbench/types";

import { listConsoleResources } from "./courseResources.service";

export const courseResourcesWorkbenchProvider: WorkbenchProvider = {
  id: "course-resources",
  order: 20,
  async getCards(ctx) {
    const canReview = await ctx.canPerm("campus:resource:review");
    if (!canReview) return [];

    const pendingTotal = await listConsoleResources({
      actorUserId: ctx.actorUserId,
      page: 1,
      pageSize: 1,
      status: "pending",
    }).then((r) => r.total);

    return [
      {
        id: "course-resources.pending",
        order: 10,
        title: "课程资源：待审核",
        description: "仅统计当前账号可管理范围（major_lead 为本专业；admin/super_admin 为全量）。",
        metrics: [{ id: "pending", label: "待审核", value: pendingTotal }],
        actions: [{ kind: "link", id: "review", label: "去处理", href: "/console/resources/pending" }],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canEnterModule = await ctx.canAnyPerm(courseResourcesConsoleEntryPermCodes);
    if (!canEnterModule) return [];
    return [
      {
        id: "console.resources",
        order: 10,
        label: "课程资源分享",
        href: "/console/resources",
        variant: "default",
      },
    ];
  },
};
