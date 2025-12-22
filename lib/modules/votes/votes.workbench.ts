import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";
import { votesConsoleEntryPermCodes } from "@/lib/navigation/modules";
import { formatZhDateTime } from "@/lib/ui/datetime";

import { countConsolePublishedVotesEndingSoon, listConsolePublishedVotesEndingSoon, listConsoleVotes } from "./votes.service";

const END_SOON_DIALOG_LIMIT = 30;

export const votesWorkbenchProvider: WorkbenchProvider = {
  id: "votes",
  order: 55,
  async getCards(ctx) {
    const canList = await ctx.canPerm("campus:vote:list");
    if (!canList) return [];

    const withinDays = Math.max(1, Math.floor(ctx.settings.reminderWindowDays));

    const [draftTotal, endingSoonTotal, endingSoonItems, canCreate] = await Promise.all([
      listConsoleVotes({
        actorUserId: ctx.actorUserId,
        page: 1,
        pageSize: 1,
        status: "draft",
        mine: true,
        archived: false,
      }).then((r) => r.total),
      countConsolePublishedVotesEndingSoon({ actorUserId: ctx.actorUserId, withinDays }),
      listConsolePublishedVotesEndingSoon({ actorUserId: ctx.actorUserId, withinDays, limit: END_SOON_DIALOG_LIMIT }),
      ctx.canPerm("campus:vote:create"),
    ]);

    const dialogItems = endingSoonItems.map((v) => ({
      id: v.id,
      title: v.title,
      meta: `截止：${formatZhDateTime(v.endAt)}`,
      href: `/console/votes/${v.id}/edit`,
    }));

    const dialogDescription =
      endingSoonTotal > dialogItems.length
        ? `未来 ${withinDays} 天内截止：${endingSoonTotal} 条（仅展示前 ${dialogItems.length} 条）`
        : `未来 ${withinDays} 天内截止：${endingSoonTotal} 条`;

    return [
      {
        id: "votes.todo",
        order: 30,
        title: "投票：待处理",
        description: "草稿仅对创建者与具备数据范围权限的账号可见；截止提醒仅统计已发布且未归档/未结束的投票。",
        metrics: [
          { id: "draft", label: "我的草稿", value: draftTotal },
          { id: "endingSoon", label: `${withinDays} 天内截止（已发布）`, value: endingSoonTotal },
        ],
        actions: [
          { kind: "link", id: "drafts", label: "查看草稿", href: "/console/votes?status=draft&mine=true", variant: "outline" },
          {
            kind: "dialog",
            id: "endingSoon",
            label: "查看截止清单",
            variant: "outline",
            dialog: {
              title: `${withinDays} 天内截止（已发布）`,
              description: dialogDescription,
              items: dialogItems,
              emptyText: `未来 ${withinDays} 天内暂无截止投票`,
            },
          },
          ...(canCreate ? [{ kind: "link" as const, id: "new", label: "新建投票", href: "/console/votes/new" }] : []),
        ],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canEnter = await ctx.canAnyPerm(votesConsoleEntryPermCodes);
    if (!canEnter) return [];
    const links: WorkbenchQuickLink[] = [{ id: "console.votes", order: 75, label: "投票", href: "/console/votes", variant: "default" }];
    return links;
  },
};

