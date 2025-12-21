import { requirePerm, hasPerm } from "@/lib/auth/permissions";
import { ConsoleLibraryBooksList } from "@/components/library/ConsoleLibraryBooksList";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConsoleLibraryPendingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:library:review");
  const sp = await searchParams;

  const [canReview, canOffline, canDelete, canAuditList] = await Promise.all([
    hasPerm(user.id, "campus:library:review"),
    hasPerm(user.id, "campus:library:offline"),
    hasPerm(user.id, "campus:library:delete"),
    hasPerm(user.id, "campus:audit:list"),
  ]);

  return (
    <ConsoleLibraryBooksList
      title="待审核"
      description="仅显示 pending；可通过/驳回（驳回需填写意见）。"
      fixedStatus="pending"
      basePath="/console/library/pending"
      searchParams={sp}
      canReview={canReview}
      canOffline={canOffline}
      canDelete={canDelete}
      canAuditList={canAuditList}
    />
  );
}
