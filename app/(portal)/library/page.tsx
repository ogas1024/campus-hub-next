import Link from "next/link";
import { redirect } from "next/navigation";

import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { requirePortalUser } from "@/lib/auth/guards";
import { parseIntParam } from "@/lib/http/query";
import { listPortalLibraryBooks } from "@/lib/modules/library/library.service";
import { getLibraryFileFormatLabel } from "@/lib/modules/library/library.ui";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(params: {
  q?: string;
  format?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.format) sp.set("format", params.format);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortOrder) sp.set("sortOrder", params.sortOrder);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/library?${query}` : "/library";
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePortalUser();
  const sp = await searchParams;

  const q = pickString(sp.q) ?? "";
  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const format = pickString(sp.format) ?? "";
  const formatValue: "pdf" | "epub" | "mobi" | "zip" | "" =
    format === "pdf" || format === "epub" || format === "mobi" || format === "zip" ? format : "";

  const sortBy = pickString(sp.sortBy) ?? "publishedAt";
  const sortByValue: "publishedAt" | "downloadCount" = sortBy === "downloadCount" ? "downloadCount" : "publishedAt";
  const sortOrderValue: "asc" | "desc" = pickString(sp.sortOrder) === "asc" ? "asc" : "desc";

  const data = await listPortalLibraryBooks({
    userId: user.id,
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
    format: formatValue ? formatValue : undefined,
    sortBy: sortByValue,
    sortOrder: sortOrderValue,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildHref({ q, format: formatValue || undefined, sortBy: sortByValue, sortOrder: sortOrderValue, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="数字图书馆"
        description="电子书/资料的检索、收藏与下载；下载会自动计数。"
        actions={
          <>
            <Link className={buttonVariants({ size: "sm" })} href="/library/me?dialog=library-create" scroll={false}>
              新建投稿
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/me">
              我的投稿
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/favorites">
              我的收藏
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/leaderboard">
              榜单
            </Link>
          </>
        }
      />

      <FiltersPanel title="搜索与筛选">
        <form className="grid gap-3 md:grid-cols-12" action="/library" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-5">
              <Input name="q" uiSize="sm" placeholder="搜索标题/作者/ISBN/关键词…" defaultValue={q} />
            </div>

            <div className="md:col-span-2">
              <Select name="format" defaultValue={formatValue} uiSize="sm">
                <option value="">全部格式</option>
                {(["pdf", "epub", "mobi", "zip"] as const).map((f) => (
                  <option key={f} value={f}>
                    {getLibraryFileFormatLabel(f)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select name="sortBy" defaultValue={sortByValue} uiSize="sm">
                <option value="publishedAt">最新发布</option>
                <option value="downloadCount">下载最多</option>
              </Select>
            </div>

            <div className="md:col-span-1">
              <Select name="sortOrder" defaultValue={sortOrderValue} uiSize="sm">
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select name="pageSize" defaultValue={String(pageSize)} uiSize="sm">
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}/页
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library">
                清空
              </Link>
              <button className={buttonVariants({ size: "sm" })} type="submit">
                应用
              </button>
            </div>
          </form>
      </FiltersPanel>

      {data.items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-10 text-center text-sm text-muted-foreground">
            <div>暂无已发布条目</div>
            <div>
              <Link className={buttonVariants({ size: "sm" })} href="/library/me?dialog=library-create" scroll={false}>
                投稿第一本书
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <Card key={item.id} className="transition-colors duration-[var(--motion-duration-hover)] ease-[var(--motion-ease-standard)] hover:bg-accent">
              <CardContent className="space-y-2 p-4">
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

                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <Link href={`/library/${item.id}`} className="line-clamp-1 font-medium hover:underline">
                      {item.title}
                    </Link>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{item.summary ?? "—"}</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <form action={`/api/library/${item.id}/download`} method="POST" target="_blank">
                      <button className={buttonVariants({ size: "sm" })} type="submit">
                        下载
                      </button>
                    </form>
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/library/${item.id}`}>
                      详情
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) => buildHref({ q, format: formatValue || undefined, sortBy: sortByValue, sortOrder: sortOrderValue, page: nextPage, pageSize })}
      />
    </div>
  );
}
