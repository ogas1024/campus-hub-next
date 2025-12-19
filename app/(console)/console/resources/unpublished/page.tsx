import { requirePerm, hasPerm } from "@/lib/auth/permissions";
import { ConsoleResourcesList } from "@/components/course-resources/ConsoleResourcesList";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConsoleResourcesUnpublishedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
      title="已下架"
      description="仅显示 unpublished；major_lead 可下架维护；硬删除仅 admin/super_admin。"
      fixedStatus="unpublished"
      basePath="/console/resources/unpublished"
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

