import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";
import { formatZhDateTime } from "@/lib/ui/datetime";

import { countConsolePublishedNoticesExpiringSoon, listConsoleNotices, listConsolePublishedNoticesExpiringSoon } from "./notices.service";

const EXPIRE_SOON_DIALOG_LIMIT = 30;

export const noticesWorkbenchProvider: WorkbenchProvider = {
  id: "notices",
  order: 10,
  async getCards(ctx) {
    const canList = await ctx.canPerm("campus:notice:list");
    if (!canList) return [];

    const withinDays = Math.max(1, Math.floor(ctx.settings.reminderWindowDays));

    const [draftTotal, expiringSoonTotal, expiringSoonItems, canCreate] = await Promise.all([
      listConsoleNotices({
        userId: ctx.actorUserId,
        page: 1,
        pageSize: 1,
        includeExpired: true,
        status: "draft",
        mine: true,
      }).then((r) => r.total),
      countConsolePublishedNoticesExpiringSoon({
        userId: ctx.actorUserId,
        withinDays,
      }),
      listConsolePublishedNoticesExpiringSoon({
        userId: ctx.actorUserId,
        withinDays,
        limit: EXPIRE_SOON_DIALOG_LIMIT,
      }),
      ctx.canPerm("campus:notice:create"),
    ]);

    const expiringSoonDialogItems = expiringSoonItems.map((n) => ({
      id: n.id,
      title: n.title,
      meta: `到期：${formatZhDateTime(n.expireAt)}`,
      href: `/console/notices?dialog=notice-edit&id=${n.id}`,
    }));

    const expiringSoonDialogDescription =
      expiringSoonTotal > expiringSoonDialogItems.length
        ? `未来 ${withinDays} 天内到期：${expiringSoonTotal} 条（仅展示前 ${expiringSoonDialogItems.length} 条）`
        : `未来 ${withinDays} 天内到期：${expiringSoonTotal} 条`;

    return [
      {
        id: "notices.todo",
        order: 20,
        title: "通知公告：待处理",
        description: "草稿仅对创建者与具备管理权限的账号可见；到期提醒仅统计已发布且未过期的公告。",
        metrics: [
          { id: "draft", label: "我的草稿", value: draftTotal },
          { id: "expireSoon", label: `${withinDays} 天内到期（已发布）`, value: expiringSoonTotal },
        ],
        actions: [
          { kind: "link", id: "drafts", label: "查看草稿", href: "/console/notices?status=draft&mine=true", variant: "outline" },
          {
            kind: "dialog",
            id: "expireSoon",
            label: "查看到期清单",
            variant: "outline",
            dialog: {
              title: `${withinDays} 天内到期（已发布）`,
              description: expiringSoonDialogDescription,
              items: expiringSoonDialogItems,
              emptyText: `未来 ${withinDays} 天内暂无到期公告`,
            },
          },
          ...(canCreate ? [{ kind: "link" as const, id: "new", label: "新建", href: "/console/notices?dialog=notice-create" }] : []),
        ],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canList = await ctx.canPerm("campus:notice:list");
    if (!canList) return [];

    const canCreate = await ctx.canPerm("campus:notice:create");
    const links: WorkbenchQuickLink[] = [
      { id: "console.notices", order: 20, label: "通知公告", href: "/console/notices", variant: "default" },
    ];
    if (canCreate) links.push({ id: "console.notices.new", order: 21, label: "新建公告", href: "/console/notices?dialog=notice-create", variant: "outline" });

    return links;
  },
};
