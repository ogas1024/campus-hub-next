import { requirePerm, hasPerm } from "@/lib/auth/permissions";
import { ConsoleLibraryBooksList } from "@/components/library/ConsoleLibraryBooksList";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConsoleLibraryUnpublishedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:library:list");
  const sp = await searchParams;

  const [canReview, canOffline, canDelete, canAuditList] = await Promise.all([
    hasPerm(user.id, "campus:library:review"),
    hasPerm(user.id, "campus:library:offline"),
    hasPerm(user.id, "campus:library:delete"),
    hasPerm(user.id, "campus:audit:list"),
  ]);

  return (
    <ConsoleLibraryBooksList
      title="已下架"
      description="仅显示 unpublished；可硬删除（仅 admin/super_admin）。"
      fixedStatus="unpublished"
      basePath="/console/library/unpublished"
      searchParams={sp}
      canReview={canReview}
      canOffline={canOffline}
      canDelete={canDelete}
      canAuditList={canAuditList}
    />
  );
}
