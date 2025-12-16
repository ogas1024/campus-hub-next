import Link from "next/link";

import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { ConsoleNoticeActions } from "@/components/notices/ConsoleNoticeActions";
import { listConsoleNotices } from "@/lib/modules/notices/notices.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function statusMeta(status: string) {
  switch (status) {
    case "draft":
      return { label: "草稿", className: "bg-zinc-100 text-zinc-700" };
    case "published":
      return { label: "已发布", className: "bg-emerald-50 text-emerald-700" };
    case "retracted":
      return { label: "已撤回", className: "bg-zinc-100 text-zinc-700" };
    default:
      return { label: status, className: "bg-zinc-100 text-zinc-700" };
  }
}

function buildConsoleNoticesHref(params: {
  status?: string;
  q?: string;
  includeExpired?: boolean;
  mine?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.includeExpired === false) sp.set("includeExpired", "false");
  if (params.mine) sp.set("mine", "true");
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

  const [canUpdate, canDelete, canPin, canPublish, canManageAll] = await Promise.all([
    hasPerm(user.id, "campus:notice:update"),
    hasPerm(user.id, "campus:notice:delete"),
    hasPerm(user.id, "campus:notice:pin"),
    hasPerm(user.id, "campus:notice:publish"),
    hasPerm(user.id, "campus:notice:manage"),
  ]);

  const data = await listConsoleNotices({
    userId: user.id,
    page: 1,
    pageSize: 20,
    q: q.trim() ? q.trim() : undefined,
    includeExpired,
    status: statusValue,
    mine,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">公告管理</h1>
          <p className="text-sm text-zinc-600">草稿/撤回 → 发布；已发布可撤回；置顶仅对“已发布且未过期”生效。</p>
        </div>
        <Link href="/console/notices/new" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          新建公告
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "全部", value: undefined },
          { label: "已发布", value: "published" },
          { label: "草稿", value: "draft" },
          { label: "已撤回", value: "retracted" },
        ].map((t) => {
          const active = (statusValue ?? undefined) === t.value;
          return (
            <Link
              key={t.label}
              href={buildConsoleNoticesHref({ status: t.value, q, includeExpired, mine })}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium",
                active ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50",
                "border border-zinc-200",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}

        <div className="ml-auto" />

        <form className="flex flex-wrap items-center gap-2" action="/console/notices" method="GET">
          {statusValue ? <input type="hidden" name="status" value={statusValue} /> : null}
          <input
            name="q"
            className="h-9 w-56 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="搜索标题…"
            defaultValue={q}
          />

          <select
            name="includeExpired"
            defaultValue={includeExpired ? "true" : "false"}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
          >
            <option value="true">包含已过期</option>
            <option value="false">排除已过期</option>
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
            <input name="mine" type="checkbox" value="true" defaultChecked={mine} />
            只看我创建
          </label>

          <button className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
            筛选
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full table-auto">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-600">
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
                <td className="px-4 py-10 text-center text-sm text-zinc-600" colSpan={7}>
                  暂无公告
                </td>
              </tr>
            ) : null}

            {data.items.map((n) => (
              <tr key={n.id} className="border-t border-zinc-100">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {n.pinned ? (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">置顶</span>
                    ) : null}
                    <span className="truncate font-medium text-zinc-900">{n.title}</span>
                    {n.isExpired ? (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">已过期</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {n.createdBy === user.id ? "我" : "其他"} · 编辑 {n.editCount} 次
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusMeta(n.status).className}`}>
                    {statusMeta(n.status).label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">{n.publishAt ? new Date(n.publishAt).toLocaleString() : "—"}</td>
                <td className="px-3 py-2 text-xs text-zinc-600">{n.expireAt ? new Date(n.expireAt).toLocaleString() : "—"}</td>
                <td className="px-3 py-2 text-xs text-zinc-600">{new Date(n.updatedAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-sm text-zinc-700">{n.readCount}</td>
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
    </div>
  );
}
