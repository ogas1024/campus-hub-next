import { ComingSoon } from "@/components/layout/ComingSoon";
import { requirePortalUser } from "@/lib/auth/guards";

export default async function LibraryPage() {
  await requirePortalUser();

  return (
    <ComingSoon
      moduleId="library"
      title="数字图书馆"
      description="数字图书馆：电子书/资料库的检索、借阅与阅读（后续实现）。"
      docPath="docs/requirements/library.md"
    />
  );
}
