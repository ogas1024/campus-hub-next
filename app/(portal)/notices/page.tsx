import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { listPortalNotices } from "@/lib/modules/notices/notices.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildPortalNoticesHref(params: {
  q?: string;
  read?: "true" | "false";
  includeExpired?: boolean;
  sortBy?: "publishAt" | "updatedAt" | "expireAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.read) sp.set("read", params.read);
  if (params.includeExpired) sp.set("includeExpired", "true");
  if (params.sortBy && params.sortBy !== "publishAt") sp.set("sortBy", params.sortBy);
  if (params.sortOrder && params.sortOrder !== "desc") sp.set("sortOrder", params.sortOrder);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/notices?${query}` : "/notices";
}

const selectClassName =
  "flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40";

export default async function NoticesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const includeExpired = pickString(sp.includeExpired) === "true";
  const readParam = pickString(sp.read) ?? null;
  const read = parseTriStateBooleanParam(readParam);

  const sortByParam = pickString(sp.sortBy);
  const sortBy =
    sortByParam === "updatedAt" || sortByParam === "expireAt" ? sortByParam : ("publishAt" as const);

  const sortOrderParam = pickString(sp.sortOrder);
  const sortOrder = sortOrderParam === "asc" ? "asc" : "desc";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listPortalNotices({
    userId: user.id,
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
    includeExpired,
    read,
    sortBy,
    sortOrder,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(
      buildPortalNoticesHref({
        q,
        read: read === true ? "true" : read === false ? "false" : undefined,
        includeExpired,
        sortBy,
        sortOrder,
        page: totalPages,
        pageSize,
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">通知公告</h1>
          <p className="text-sm text-zinc-600">置顶优先；支持搜索、筛选与分页。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">共 {data.total} 条</Badge>
          <Badge variant="secondary">
            第 {displayPage} / {totalPages} 页
          </Badge>
          {read === false ? <Badge>只看未读</Badge> : null}
          {read === true ? <Badge variant="outline">只看已读</Badge> : null}
          {includeExpired ? <Badge variant="outline">包含已过期</Badge> : null}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选与排序</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-12" action="/notices" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-4">
              <Input name="q" placeholder="按标题搜索…" defaultValue={q} />
            </div>

            <div className="md:col-span-2">
              <select
                name="read"
                defaultValue={read === true ? "true" : read === false ? "false" : ""}
                className={selectClassName}
              >
                <option value="">全部已读</option>
                <option value="false">未读</option>
                <option value="true">已读</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                name="includeExpired"
                defaultValue={includeExpired ? "true" : "false"}
                className={selectClassName}
              >
                <option value="false">排除过期</option>
                <option value="true">包含过期</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                name="sortBy"
                defaultValue={sortBy}
                className={selectClassName}
              >
                <option value="publishAt">发布时间</option>
                <option value="updatedAt">更新时间</option>
                <option value="expireAt">有效期</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                name="sortOrder"
                defaultValue={sortOrder}
                className={selectClassName}
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                name="pageSize"
                defaultValue={String(pageSize)}
                className={selectClassName}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    每页 {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/notices">
                清空
              </Link>
              <button className={buttonVariants({ size: "sm" })} type="submit">
                应用
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-zinc-600">暂无公告</CardContent>
          </Card>
        ) : null}

        {data.items.map((item) => (
          <Link key={item.id} href={`/notices/${item.id}`} className="block">
            <Card className={cn("hover:bg-zinc-50", item.read ? null : "border-zinc-900")}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.pinned ? <Badge variant="outline">置顶</Badge> : null}
                  {item.isExpired ? <Badge variant="outline" className="text-zinc-500">已过期</Badge> : null}
                  {item.read ? <Badge variant="secondary">已读</Badge> : <Badge>未读</Badge>}
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-zinc-900">{item.title}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      发布：{formatZhDateTime(item.publishAt)} · 阅读数：{item.readCount}
                      {item.expireAt ? ` · 有效至：${formatZhDateTime(item.expireAt)}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm text-zinc-400">查看 →</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) =>
          buildPortalNoticesHref({
            q,
            read: read === true ? "true" : read === false ? "false" : undefined,
            includeExpired,
            sortBy,
            sortOrder,
            page: nextPage,
            pageSize,
          })
        }
      />
    </div>
  );
}
