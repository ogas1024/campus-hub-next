import { ComingSoon } from "@/components/layout/ComingSoon";
import { requirePortalUser } from "@/lib/auth/guards";

export default async function LostFoundPage() {
  await requirePortalUser();

  return (
    <ComingSoon
      moduleId="lost-found"
      title="失物招领"
      description="失物/拾物发布、认领、证据提交与状态流转（后续实现）。"
      docPath="docs/requirements/lost-found.md"
    />
  );
}
