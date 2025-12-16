import { ComingSoon } from "@/components/layout/ComingSoon";
import { requirePortalUser } from "@/lib/auth/guards";

export default async function ResourcesPage() {
  await requirePortalUser();

  return (
    <ComingSoon
      moduleId="resources"
      title="课程资源"
      description="课程资料分享与检索：支持上传、审核、搜索、标签与收藏等能力。"
      docPath="docs/requirements/course-resources.md"
    />
  );
}
