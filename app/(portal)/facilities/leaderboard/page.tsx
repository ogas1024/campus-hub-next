import Link from "next/link";
import { redirect } from "next/navigation";

import { FacilityLeaderboardClient } from "@/components/facilities/FacilityLeaderboardClient";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function FacilitiesLeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">功能房预约榜单</h1>
          <p className="text-sm text-muted-foreground">按窗口统计预约时长（仅计入已批准预约，按区间交集累计）。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities">
            ← 返回纵览
          </Link>
        </div>
      </div>

      <FacilityLeaderboardClient />
    </div>
  );
}

