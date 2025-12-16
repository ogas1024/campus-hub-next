import { ComingSoon } from "@/components/layout/ComingSoon";
import { requirePortalUser } from "@/lib/auth/guards";

export default async function FacilitiesPage() {
  await requirePortalUser();

  return (
    <ComingSoon
      moduleId="facilities"
      title="功能房预约"
      description="功能房预约：支持按日期/时段创建、冲突校验、审批与个人历史等能力。"
      docPath="docs/requirements/facility-reservation.md"
    />
  );
}
