import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalFacilityConfig, listPortalBuildings, listPortalFloors } from "@/lib/modules/facilities/facilities.service";
import { FacilitiesOverviewClient } from "@/components/facilities/FacilitiesOverviewClient";

export default async function FacilitiesPage() {
  const [user, buildings, portalConfig] = await Promise.all([
    getCurrentUser(),
    listPortalBuildings(),
    getPortalFacilityConfig(),
  ]);
  if (!user) redirect("/login");

  const firstBuildingId = buildings[0]?.id;
  const initialFloors = firstBuildingId ? await listPortalFloors(firstBuildingId) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="功能房预约"
        description="按楼房/楼层纵览占用（甘特图），支持冲突校验、审核开关与我的预约管理。"
        meta={<Badge variant="secondary">楼房 {buildings.length} 栋</Badge>}
        actions={
          <>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities/me">
              我的预约
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities/leaderboard">
              榜单
            </Link>
          </>
        }
      />

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无可用楼房（请联系管理员在管理端创建并启用）。</CardContent>
        </Card>
      ) : (
        <FacilitiesOverviewClient
          userId={user.id}
          buildings={buildings}
          initialConfig={portalConfig}
          initialFloors={initialFloors?.floors ?? []}
          initialFloorNo={initialFloors?.floors[0] ?? null}
        />
      )}
    </div>
  );
}
