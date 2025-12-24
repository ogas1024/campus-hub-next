import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";
import { materialsConsoleEntryPermCodes } from "@/lib/navigation/modules";
import { formatZhDateTime } from "@/lib/ui/datetime";

import { countConsolePublishedMaterialsDueSoon, listConsoleMaterials, listConsolePublishedMaterialsDueSoon } from "./materials.service";

const DUE_SOON_DIALOG_LIMIT = 30;

export const materialsWorkbenchProvider: WorkbenchProvider = {
  id: "materials",
  order: 15,
  async getCards(ctx) {
    const canList = await ctx.canPerm("campus:material:list");
    if (!canList) return [];

    const withinDays = Math.max(1, Math.floor(ctx.settings.reminderWindowDays));

    const [draftTotal, dueSoonTotal, dueSoonItems, canCreate] = await Promise.all([
      listConsoleMaterials({
        actorUserId: ctx.actorUserId,
        page: 1,
        pageSize: 1,
        status: "draft",
        mine: true,
        archived: false,
      }).then((r) => r.total),
      countConsolePublishedMaterialsDueSoon({ actorUserId: ctx.actorUserId, withinDays }),
      listConsolePublishedMaterialsDueSoon({ actorUserId: ctx.actorUserId, withinDays, limit: DUE_SOON_DIALOG_LIMIT }),
      ctx.canPerm("campus:material:create"),
    ]);

    const dueSoonDialogItems = dueSoonItems.map((t) => ({
      id: t.id,
      title: t.title,
      meta: t.dueAt ? `截止：${formatZhDateTime(t.dueAt)}` : undefined,
      href: `/console/materials?dialog=material-edit&id=${encodeURIComponent(t.id)}`,
    }));

    const dueSoonDialogDescription =
      dueSoonTotal > dueSoonDialogItems.length
        ? `未来 ${withinDays} 天内截止：${dueSoonTotal} 条（仅展示前 ${dueSoonDialogItems.length} 条）`
        : `未来 ${withinDays} 天内截止：${dueSoonTotal} 条`;

    return [
      {
        id: "materials.todo",
        order: 20,
        title: "材料收集：待处理",
        description: "草稿仅对创建者与具备管理权限的账号可见；截止提醒仅统计已发布且未归档的任务。",
        metrics: [
          { id: "draft", label: "我的草稿", value: draftTotal },
          { id: "dueSoon", label: `${withinDays} 天内截止（已发布）`, value: dueSoonTotal },
        ],
        actions: [
          { kind: "link", id: "drafts", label: "查看草稿", href: "/console/materials?status=draft&mine=true", variant: "outline" },
          {
            kind: "dialog",
            id: "dueSoon",
            label: "查看截止清单",
            variant: "outline",
            dialog: {
              title: `${withinDays} 天内截止（已发布）`,
              description: dueSoonDialogDescription,
              items: dueSoonDialogItems,
              emptyText: `未来 ${withinDays} 天内暂无截止任务`,
            },
          },
          ...(canCreate
            ? [{ kind: "link" as const, id: "new", label: "新建任务", href: "/console/materials?dialog=material-create" }]
            : []),
        ],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canEnter = await ctx.canAnyPerm(materialsConsoleEntryPermCodes);
    if (!canEnter) return [];

    const links: WorkbenchQuickLink[] = [{ id: "console.materials", order: 20, label: "材料收集", href: "/console/materials", variant: "default" }];
    return links;
  },
};
