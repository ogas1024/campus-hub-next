import { requirePerm, hasPerm } from "@/lib/auth/permissions";
import { ConsoleResourcesList } from "@/components/course-resources/ConsoleResourcesList";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConsoleResourcesRejectedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:resource:list");
  const sp = await searchParams;

  const [canReview, canOffline, canBest, canDelete, canCourseList, canAuditList] = await Promise.all([
    hasPerm(user.id, "campus:resource:review"),
    hasPerm(user.id, "campus:resource:offline"),
    hasPerm(user.id, "campus:resource:best"),
    hasPerm(user.id, "campus:resource:delete"),
    hasPerm(user.id, "campus:resource:course_list"),
    hasPerm(user.id, "campus:audit:list"),
  ]);

  return (
    <ConsoleResourcesList
      actorUserId={user.id}
      title="已驳回"
      description="仅显示 rejected；作者可修改后重新提交；管理端可查看详情与审计。"
      fixedStatus="rejected"
      basePath="/console/resources/rejected"
      searchParams={sp}
      canReview={canReview}
      canOffline={canOffline}
      canBest={canBest}
      canDelete={canDelete}
      canCourseList={canCourseList}
      canAuditList={canAuditList}
    />
  );
}

