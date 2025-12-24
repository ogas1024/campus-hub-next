import Link from "next/link";
import { redirect } from "next/navigation";

import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { PortalNoticeDialogController } from "@/components/notices/PortalNoticeDialogController";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { withDialogHref } from "@/lib/navigation/dialog";
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
      <PortalNoticeDialogController />

      <PageHeader
        title="通知公告"
        description="置顶优先；支持搜索、筛选与分页。"
        actions={
          <>
            <Badge variant="secondary">共 {data.total} 条</Badge>
            <Badge variant="secondary">
              第 {displayPage} / {totalPages} 页
            </Badge>
            {read === false ? <Badge>只看未读</Badge> : null}
            {read === true ? <Badge variant="outline">只看已读</Badge> : null}
            {includeExpired ? <Badge variant="outline">包含已过期</Badge> : null}
          </>
        }
      />

      <FiltersPanel title="筛选与排序">
        <form className="grid gap-3 md:grid-cols-12" action="/notices" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-4">
              <Input name="q" uiSize="sm" placeholder="按标题搜索…" defaultValue={q} />
            </div>

            <div className="md:col-span-2">
              <Select
                name="read"
                defaultValue={read === true ? "true" : read === false ? "false" : ""}
                uiSize="sm"
              >
                <option value="">全部已读</option>
                <option value="false">未读</option>
                <option value="true">已读</option>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select
                name="includeExpired"
                defaultValue={includeExpired ? "true" : "false"}
                uiSize="sm"
              >
                <option value="false">排除过期</option>
                <option value="true">包含过期</option>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select
                name="sortBy"
                defaultValue={sortBy}
                uiSize="sm"
              >
                <option value="publishAt">发布时间</option>
                <option value="updatedAt">更新时间</option>
                <option value="expireAt">有效期</option>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select
                name="sortOrder"
                defaultValue={sortOrder}
                uiSize="sm"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select
                name="pageSize"
                defaultValue={String(pageSize)}
                uiSize="sm"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    每页 {n}
                  </option>
                ))}
              </Select>
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
      </FiltersPanel>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无公告</CardContent>
          </Card>
        ) : null}

        {data.items.map((item) => (
          <Link
            key={item.id}
            href={withDialogHref(
              buildPortalNoticesHref({
                q,
                read: read === true ? "true" : read === false ? "false" : undefined,
                includeExpired,
                sortBy,
                sortOrder,
                page: displayPage,
                pageSize,
              }),
              { dialog: "notice-view", id: item.id },
            )}
            scroll={false}
            className="block"
          >
            <Card className={cn("hover:bg-accent", item.read ? null : "border-primary")}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.pinned ? <Badge variant="outline">置顶</Badge> : null}
                  {item.isExpired ? <Badge variant="outline" className="text-muted-foreground">已过期</Badge> : null}
                  {item.read ? <Badge variant="secondary">已读</Badge> : <Badge>未读</Badge>}
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      发布：{formatZhDateTime(item.publishAt)} · 阅读数：{item.readCount}
                      {item.expireAt ? ` · 有效至：${formatZhDateTime(item.expireAt)}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">查看 →</span>
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
