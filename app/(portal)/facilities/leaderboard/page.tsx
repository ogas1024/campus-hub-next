import Link from "next/link";
import { redirect } from "next/navigation";

import { FacilityLeaderboardClient } from "@/components/facilities/FacilityLeaderboardClient";
import { PageHeader } from "@/components/common/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function FacilitiesLeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-4">
      <PageHeader
        title="功能房预约榜单"
        description="按窗口统计预约时长（仅计入已批准预约，按区间交集累计）。"
        actions={
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities">
            ← 返回纵览
          </Link>
        }
      />

      <FacilityLeaderboardClient />
    </div>
  );
}
