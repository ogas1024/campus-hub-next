import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";
import { surveysConsoleEntryPermCodes } from "@/lib/navigation/modules";
import { formatZhDateTime } from "@/lib/ui/datetime";

import { countConsolePublishedSurveysEndingSoon, listConsolePublishedSurveysEndingSoon, listConsoleSurveys } from "./surveys.service";

const END_SOON_DIALOG_LIMIT = 30;

export const surveysWorkbenchProvider: WorkbenchProvider = {
  id: "surveys",
  order: 50,
  async getCards(ctx) {
    const canList = await ctx.canPerm("campus:survey:list");
    if (!canList) return [];

    const withinDays = Math.max(1, Math.floor(ctx.settings.reminderWindowDays));

    const [draftTotal, endingSoonTotal, endingSoonItems, canCreate] = await Promise.all([
      listConsoleSurveys({
        actorUserId: ctx.actorUserId,
        page: 1,
        pageSize: 1,
        status: "draft",
        mine: true,
      }).then((r) => r.total),
      countConsolePublishedSurveysEndingSoon({ actorUserId: ctx.actorUserId, withinDays }),
      listConsolePublishedSurveysEndingSoon({ actorUserId: ctx.actorUserId, withinDays, limit: END_SOON_DIALOG_LIMIT }),
      ctx.canPerm("campus:survey:create"),
    ]);

    const dialogItems = endingSoonItems.map((s) => ({
      id: s.id,
      title: s.title,
      meta: `截止：${formatZhDateTime(s.endAt)}`,
      href: `/console/surveys/${s.id}/edit`,
    }));

    const dialogDescription =
      endingSoonTotal > dialogItems.length
        ? `未来 ${withinDays} 天内截止：${endingSoonTotal} 条（仅展示前 ${dialogItems.length} 条）`
        : `未来 ${withinDays} 天内截止：${endingSoonTotal} 条`;

    return [
      {
        id: "surveys.todo",
        order: 30,
        title: "问卷：待处理",
        description: "草稿仅对创建者与具备数据范围权限的账号可见；截止提醒仅统计已发布且未结束的问卷。",
        metrics: [
          { id: "draft", label: "我的草稿", value: draftTotal },
          { id: "endingSoon", label: `${withinDays} 天内截止（已发布）`, value: endingSoonTotal },
        ],
        actions: [
          { kind: "link", id: "drafts", label: "查看草稿", href: "/console/surveys?status=draft&mine=true", variant: "outline" },
          {
            kind: "dialog",
            id: "endingSoon",
            label: "查看截止清单",
            variant: "outline",
            dialog: {
              title: `${withinDays} 天内截止（已发布）`,
              description: dialogDescription,
              items: dialogItems,
              emptyText: `未来 ${withinDays} 天内暂无截止问卷`,
            },
          },
          ...(canCreate ? [{ kind: "link" as const, id: "new", label: "新建问卷", href: "/console/surveys/new" }] : []),
        ],
      },
    ];
  },
  async getQuickLinks(ctx) {
    const canEnter = await ctx.canAnyPerm(surveysConsoleEntryPermCodes);
    if (!canEnter) return [];
    const links: WorkbenchQuickLink[] = [{ id: "console.surveys", order: 70, label: "问卷", href: "/console/surveys", variant: "default" }];
    return links;
  },
};

