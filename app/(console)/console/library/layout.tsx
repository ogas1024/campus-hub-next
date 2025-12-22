/**
 * 用法：
 * - `/console/library/*` 模块布局：按当前用户权限渲染子导航 Tabs。
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsoleModuleTabs } from "@/components/console/ConsoleModuleTabs";
import { buttonVariants } from "@/components/ui/button";
import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleLibraryLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [canReview, canList] = await Promise.all([hasPerm(user.id, "campus:library:review"), hasPerm(user.id, "campus:library:list")]);

  const tabs = [
    canReview ? { id: "pending", label: "待审核", href: "/console/library/pending" } : null,
    canList ? { id: "published", label: "已发布", href: "/console/library/published" } : null,
    canList ? { id: "rejected", label: "已驳回", href: "/console/library/rejected" } : null,
    canList ? { id: "unpublished", label: "已下架", href: "/console/library/unpublished" } : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  if (tabs.length === 0) redirect("/console");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">数字图书馆</div>
            <div className="text-sm text-muted-foreground">按权限展示子功能；通过/驳回/下架/硬删除等写操作均写入审计。</div>
          </div>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/workbench">
            返回工作台
          </Link>
        </div>

        <ConsoleModuleTabs ariaLabel="数字图书馆 子导航" tabs={tabs} />
      </div>

      {children}
    </div>
  );
}

