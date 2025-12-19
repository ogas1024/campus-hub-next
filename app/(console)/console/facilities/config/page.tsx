/**
 * 用法：
 * - Console：功能房模块配置（审核开关、最大时长）。
 */

import { requirePerm } from "@/lib/auth/permissions";
import { FacilityConfigCard } from "@/components/facilities/console/FacilityConfigCard";
import { getFacilityConfig } from "@/lib/modules/facilities/facilities.service";

export default async function ConsoleFacilityConfigPage() {
  const user = await requirePerm("campus:facility:config");
  const data = await getFacilityConfig({ actorUserId: user.id });
  return (
    <FacilityConfigCard
      key={`${data.auditRequired ? "1" : "0"}:${data.maxDurationHours}`}
      auditRequired={data.auditRequired}
      maxDurationHours={data.maxDurationHours}
    />
  );
}
