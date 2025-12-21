import { requirePerm, hasPerm } from "@/lib/auth/permissions";
import { ConsoleLibraryBooksList } from "@/components/library/ConsoleLibraryBooksList";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConsoleLibraryPublishedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
      title="已发布"
      description="仅显示 published；可下架；硬删除仅 admin/super_admin。"
      fixedStatus="published"
      basePath="/console/library/published"
      searchParams={sp}
      canReview={canReview}
      canOffline={canOffline}
      canDelete={canDelete}
      canAuditList={canAuditList}
    />
  );
}
