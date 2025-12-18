import { requirePerm, hasPerm } from "@/lib/auth/permissions";
import { ConsoleResourcesList } from "@/components/course-resources/ConsoleResourcesList";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConsoleResourcesPendingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:resource:review");
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
      title="待审核"
      description="仅显示 pending；可通过/驳回（驳回需填写意见）。"
      fixedStatus="pending"
      basePath="/console/resources/pending"
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

