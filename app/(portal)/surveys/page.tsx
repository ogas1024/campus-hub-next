import { ComingSoon } from "@/components/layout/ComingSoon";
import { requirePortalUser } from "@/lib/auth/guards";

export default async function SurveysPage() {
  await requirePortalUser();

  return (
    <ComingSoon
      moduleId="surveys"
      title="问卷"
      description="问卷：面向全校的表单收集、统计与导出（后续实现）。"
    />
  );
}
