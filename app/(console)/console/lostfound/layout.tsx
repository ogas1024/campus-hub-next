import Link from "next/link";

import { ConsoleModuleTabs } from "@/components/console/ConsoleModuleTabs";
import { buttonVariants } from "@/components/ui/button";
import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleLostfoundLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [canReview, canList] = await Promise.all([hasPerm(user.id, "campus:lostfound:review"), hasPerm(user.id, "campus:lostfound:list")]);

  const tabs = [
    canReview ? { id: "pending", label: "待审核", href: "/console/lostfound/pending" } : null,
    canList ? { id: "published", label: "已发布", href: "/console/lostfound/published" } : null,
    canList ? { id: "rejected", label: "已驳回", href: "/console/lostfound/rejected" } : null,
    canList ? { id: "offline", label: "已下架", href: "/console/lostfound/offline" } : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">失物招领</div>
            <div className="text-sm text-muted-foreground">默认审核；敏感物品按规范处理；不提供站内私信撮合。</div>
          </div>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/workbench">
            返回工作台
          </Link>
        </div>

        <ConsoleModuleTabs ariaLabel="失物招领 子导航" tabs={tabs} />
      </div>

      {children}
    </div>
  );
}

