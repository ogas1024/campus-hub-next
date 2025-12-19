/**
 * 用法：
 * - `/console/facilities/*` 模块布局：按当前用户权限渲染子导航 Tabs。
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsoleModuleTabs } from "@/components/console/ConsoleModuleTabs";
import { buttonVariants } from "@/components/ui/button";
import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleFacilitiesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [canManage, canReview, canBan, canConfig] = await Promise.all([
    hasPerm(user.id, "campus:facility:*"),
    hasPerm(user.id, "campus:facility:review"),
    hasPerm(user.id, "campus:facility:ban"),
    hasPerm(user.id, "campus:facility:config"),
  ]);

  const tabs = [
    canManage ? { id: "buildings", label: "楼房", href: "/console/facilities/buildings" } : null,
    canManage ? { id: "rooms", label: "房间", href: "/console/facilities/rooms" } : null,
    canReview ? { id: "reservations", label: "预约", href: "/console/facilities/reservations" } : null,
    canManage || canBan ? { id: "bans", label: "封禁", href: "/console/facilities/bans" } : null,
    canManage || canConfig ? { id: "config", label: "配置", href: "/console/facilities/config" } : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  if (tabs.length === 0) redirect("/console");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">功能房预约</div>
            <div className="text-sm text-muted-foreground">楼房/楼层/房间三级管理、预约审核（可开关）、模块级封禁、榜单统计。</div>
          </div>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/workbench">
            返回工作台
          </Link>
        </div>

        <ConsoleModuleTabs ariaLabel="功能房预约 子导航" tabs={tabs} />
      </div>

      {children}
    </div>
  );
}

