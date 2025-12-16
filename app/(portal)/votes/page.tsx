import { ComingSoon } from "@/components/layout/ComingSoon";
import { requirePortalUser } from "@/lib/auth/guards";

export default async function VotesPage() {
  await requirePortalUser();

  return (
    <ComingSoon
      moduleId="votes"
      title="投票"
      description="投票/评选：支持候选项、投票规则、统计与公示（后续实现）。"
    />
  );
}
