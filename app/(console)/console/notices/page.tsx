import Link from "next/link";
import { redirect } from "next/navigation";

import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { ConsoleModuleTabs } from "@/components/console/ConsoleModuleTabs";
import { ConsoleNoticeActions } from "@/components/notices/ConsoleNoticeActions";
import { Pagination } from "@/components/ui/Pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { parseIntParam } from "@/lib/http/query";
import { listConsoleNotices } from "@/lib/modules/notices/notices.service";
import { formatZhDateTime } from "@/lib/ui/datetime";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function statusMeta(status: string) {
  switch (status) {
    case "draft":
      return { label: "草稿", className: "bg-muted text-muted-foreground" };
    case "published":
      return { label: "已发布", className: "bg-emerald-500/10 text-emerald-700" };
    case "retracted":
      return { label: "已撤回", className: "bg-muted text-muted-foreground" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

function buildConsoleNoticesHref(params: {
  status?: string;
  q?: string;
  includeExpired?: boolean;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.includeExpired === false) sp.set("includeExpired", "false");
  if (params.mine) sp.set("mine", "true");
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/console/notices?${query}` : "/console/notices";
}

export default async function ConsoleNoticesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:notice:list");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const includeExpired = pickString(sp.includeExpired) !== "false";
  const mine = pickString(sp.mine) === "true";

  const status = pickString(sp.status);
  const statusValue = status === "draft" || status === "published" || status === "retracted" ? status : undefined;

  const [canCreate, canUpdate, canDelete, canPin, canPublish, canManageAll, canAuditList] = await Promise.all([
    hasPerm(user.id, "campus:notice:create"),
    hasPerm(user.id, "campus:notice:update"),
    hasPerm(user.id, "campus:notice:delete"),
    hasPerm(user.id, "campus:notice:pin"),
    hasPerm(user.id, "campus:notice:publish"),
    hasPerm(user.id, "campus:notice:manage"),
    hasPerm(user.id, "campus:audit:list"),
  ]);

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listConsoleNotices({
    userId: user.id,
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
    includeExpired,
    status: statusValue,
    mine,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(
      buildConsoleNoticesHref({
        status: statusValue,
        q,
        includeExpired,
        mine,
        page: totalPages,
        pageSize,
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">通知公告</h1>
          <p className="text-sm text-muted-foreground">草稿/撤回 → 发布；已发布可撤回；置顶仅对“已发布且未过期”生效。</p>
          <div className="text-sm text-muted-foreground">
            共 {data.total} 条 · 第 {displayPage} / {totalPages} 页
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAuditList ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/audit?targetType=notice">
              审计检索
            </Link>
          ) : null}
          {canCreate ? (
            <Link href="/console/notices/new" className={buttonVariants({ size: "sm" })}>
              新建公告
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto">
          <ConsoleModuleTabs
            ariaLabel="通知公告 状态切换"
            activeId={statusValue ?? "all"}
            tabs={[
              { id: "all", label: "全部", href: buildConsoleNoticesHref({ status: undefined, q, includeExpired, mine, page: 1, pageSize }) },
              { id: "published", label: "已发布", href: buildConsoleNoticesHref({ status: "published", q, includeExpired, mine, page: 1, pageSize }) },
              { id: "draft", label: "草稿", href: buildConsoleNoticesHref({ status: "draft", q, includeExpired, mine, page: 1, pageSize }) },
              { id: "retracted", label: "已撤回", href: buildConsoleNoticesHref({ status: "retracted", q, includeExpired, mine, page: 1, pageSize }) },
            ]}
          />
        </div>

        <div className="ml-auto" />

        <form className="flex flex-wrap items-center gap-2" action="/console/notices" method="GET">
          {statusValue ? <input type="hidden" name="status" value={statusValue} /> : null}
          <input type="hidden" name="page" value="1" />
          <Input
            name="q"
            uiSize="sm"
            className="w-56"
            placeholder="搜索标题…"
            defaultValue={q}
          />

          <Select
            name="includeExpired"
            defaultValue={includeExpired ? "true" : "false"}
            uiSize="sm"
            className="w-36"
          >
            <option value="true">包含已过期</option>
            <option value="false">排除已过期</option>
          </Select>

          <Select
            name="pageSize"
            defaultValue={String(pageSize)}
            uiSize="sm"
            className="w-28"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={String(n)}>
                {n}/页
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm">
            <input name="mine" type="checkbox" value="true" defaultChecked={mine} />
            只看我创建
          </label>

          <Button size="sm" type="submit">
            筛选
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">发布</th>
              <th className="px-3 py-2">有效期</th>
              <th className="px-3 py-2">更新</th>
              <th className="px-3 py-2 text-right">阅读</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={7}>
                  暂无公告
                </td>
              </tr>
            ) : null}

            {data.items.map((n) => (
              <tr key={n.id} className="border-t border-border/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {n.pinned ? (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">置顶</span>
                    ) : null}
                    <span className="truncate font-medium text-foreground">{n.title}</span>
                    {n.isExpired ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">已过期</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {n.createdBy === user.id ? "我" : "其他"} · 编辑 {n.editCount} 次
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusMeta(n.status).className}`}>
                    {statusMeta(n.status).label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatZhDateTime(n.publishAt)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatZhDateTime(n.expireAt)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatZhDateTime(n.updatedAt)}</td>
                <td className="px-3 py-2 text-right text-sm text-muted-foreground">{n.readCount}</td>
                <td className="px-3 py-2">
                  <ConsoleNoticeActions
                    noticeId={n.id}
                    status={n.status}
                    pinned={n.pinned}
                    isExpired={n.isExpired}
                    isMine={n.createdBy === user.id}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    canPin={canPin}
                    canPublish={canPublish}
                    canManageAll={canManageAll}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) =>
          buildConsoleNoticesHref({
            status: statusValue,
            q,
            includeExpired,
            mine,
            page: nextPage,
            pageSize,
          })
        }
      />
    </div>
  );
}
