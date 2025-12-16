import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { listPortalNotices } from "@/lib/modules/notices/notices.service";

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
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">通知公告</h1>
          <p className="text-sm text-zinc-600">置顶优先；支持搜索、筛选与分页。</p>
        </div>
        <div className="text-sm text-zinc-600">
          共 {data.total} 条 · 第 {displayPage} / {totalPages} 页
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <form className="flex flex-wrap items-end gap-3" action="/notices" method="GET">
          <input type="hidden" name="page" value="1" />

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-600">搜索</div>
            <input
              name="q"
              className="h-9 w-60 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="按标题搜索…"
              defaultValue={q}
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-600">已读</div>
            <select
              name="read"
              defaultValue={read === true ? "true" : read === false ? "false" : ""}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">全部</option>
              <option value="false">未读</option>
              <option value="true">已读</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-600">过期</div>
            <select
              name="includeExpired"
              defaultValue={includeExpired ? "true" : "false"}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="false">排除已过期</option>
              <option value="true">包含已过期</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-600">排序</div>
            <div className="flex items-center gap-2">
              <select
                name="sortBy"
                defaultValue={sortBy}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
              >
                <option value="publishAt">发布时间</option>
                <option value="updatedAt">更新时间</option>
                <option value="expireAt">有效期</option>
              </select>
              <select
                name="sortOrder"
                defaultValue={sortOrder}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-600">每页</div>
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm leading-9 hover:bg-zinc-50" href="/notices">
              清空
            </Link>
            <button className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
              应用
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            暂无公告
          </div>
        ) : null}

        {data.items.map((item) => (
          <Link
            key={item.id}
            href={`/notices/${item.id}`}
            className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.pinned ? (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      置顶
                    </span>
                  ) : null}
                  {item.isExpired ? (
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      已过期
                    </span>
                  ) : null}
                  {item.read ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      已读
                    </span>
                  ) : (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      未读
                    </span>
                  )}
                </div>

                <div className="text-base font-semibold text-zinc-900">{item.title}</div>
                <div className="text-xs text-zinc-600">
                  发布：{item.publishAt ? new Date(item.publishAt).toLocaleString() : "—"} · 阅读数：{item.readCount}
                </div>
              </div>
              <span className="mt-1 text-xs text-zinc-400">查看</span>
            </div>
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
