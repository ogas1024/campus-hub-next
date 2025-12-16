import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { listPortalNotices } from "@/lib/modules/notices/notices.service";

export default async function NoticesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await listPortalNotices({
    userId: user.id,
    page: 1,
    pageSize: 20,
    includeExpired: false,
    sortBy: "publishAt",
    sortOrder: "desc",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">通知公告</h1>
          <p className="text-sm text-zinc-600">置顶优先；默认不展示已过期公告。</p>
        </div>
        <div className="text-sm text-zinc-600">共 {data.total} 条</div>
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
    </div>
  );
}
