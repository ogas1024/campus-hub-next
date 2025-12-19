import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { listPortalBuildings } from "@/lib/modules/facilities/facilities.service";
import { FacilitiesOverviewClient } from "@/components/facilities/FacilitiesOverviewClient";

export default async function FacilitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const buildings = await listPortalBuildings();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">功能房预约</h1>
          <p className="text-sm text-muted-foreground">按楼房/楼层纵览占用（甘特图），支持冲突校验、审核开关与我的预约管理。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities/me">
            我的预约
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities/leaderboard">
            榜单
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">楼房 {buildings.length} 栋</Badge>
      </div>

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无可用楼房（请联系管理员在管理端创建并启用）。</CardContent>
        </Card>
      ) : (
        <FacilitiesOverviewClient userId={user.id} buildings={buildings} />
      )}
    </div>
  );
}

