import "server-only";

import type { WorkbenchProvider, WorkbenchQuickLink } from "@/lib/workbench/types";

export const infraWorkbenchProvider: WorkbenchProvider = {
  id: "infra",
  order: 100,
  async getQuickLinks(ctx) {
    const [canAuditList, canUserList, canRoleManage] = await Promise.all([
      ctx.canPerm("campus:audit:list"),
      ctx.canPerm("campus:user:list"),
      ctx.canPerm("campus:role:*"),
    ]);

    const links: WorkbenchQuickLink[] = [];
    if (canAuditList) links.push({ id: "console.audit", order: 30, label: "审计日志", href: "/console/audit", variant: "outline" });
    if (canUserList) links.push({ id: "console.users", order: 31, label: "用户", href: "/console/users", variant: "outline" });
    if (canRoleManage) links.push({ id: "console.roles", order: 32, label: "角色", href: "/console/roles", variant: "outline" });

    return links;
  },
};
