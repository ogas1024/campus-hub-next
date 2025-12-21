import Link from "next/link";
import { redirect } from "next/navigation";

import { LibraryFavoriteButton } from "@/components/library/LibraryFavoriteButton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { listMyFavoriteLibraryBooks } from "@/lib/modules/library/library.service";
import { getLibraryFileFormatLabel } from "@/lib/modules/library/library.ui";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(params: { page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/library/favorites?${query}` : "/library/favorites";
}

export default async function MyFavoriteLibraryBooksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listMyFavoriteLibraryBooks({ userId: user.id, page, pageSize });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildHref({ page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">我的收藏</h1>
          <p className="text-sm text-muted-foreground">仅展示已发布条目；取消收藏会立即生效。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library">
            ← 返回浏览
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/me">
            我的投稿
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">共 {data.total} 条</Badge>
        <Badge variant="secondary">
          第 {displayPage} / {totalPages} 页
        </Badge>
      </div>

      {data.items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无收藏</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.author}</Badge>
                  <Badge variant="outline">下载 {item.downloadCount}</Badge>
                  {item.assetFormats.map((f) => (
                    <Badge key={f} variant="secondary">
                      {getLibraryFileFormatLabel(f)}
                    </Badge>
                  ))}
                  {item.hasLinkAssets ? <Badge variant="secondary">外链</Badge> : null}
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <Link href={`/library/${item.id}`} className="line-clamp-1 font-medium hover:underline">
                      {item.title}
                    </Link>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{item.summary ?? "—"}</div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <LibraryFavoriteButton bookId={item.id} initialFavorite />
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/library/${item.id}`}>
                      查看
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={displayPage} totalPages={totalPages} hrefForPage={(nextPage) => buildHref({ page: nextPage, pageSize })} />
    </div>
  );
}

