import Link from "next/link";
import { redirect } from "next/navigation";

import { LostfoundMyActions } from "@/components/lostfound/LostfoundMyActions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { listMyLostfoundItems } from "@/lib/modules/lostfound/lostfound.service";
import { formatZhDateTime } from "@/lib/ui/datetime";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function statusMeta(status: string) {
  switch (status) {
    case "pending":
      return { label: "待审核", className: "bg-amber-500/10 text-amber-700" };
    case "published":
      return { label: "已发布", className: "bg-emerald-500/10 text-emerald-700" };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-500/10 text-rose-700" };
    case "offline":
      return { label: "已下架", className: "bg-muted text-muted-foreground" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

function typeLabel(type: string) {
  return type === "lost" ? "丢失" : type === "found" ? "拾到" : type;
}

function buildMyLostfoundHref(params: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/lostfound/me?${query}` : "/lostfound/me";
}

export default async function LostfoundMePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const status = pickString(sp.status) ?? "";
  const statusValue: "pending" | "published" | "rejected" | "offline" | "" =
    status === "pending" || status === "published" || status === "rejected" || status === "offline" ? status : "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listMyLostfoundItems({
    userId: user.id,
    page,
    pageSize,
    status: statusValue ? statusValue : undefined,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildMyLostfoundHref({ q, status: statusValue || undefined, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">我的发布</h1>
          <p className="text-sm text-muted-foreground">发布/编辑提交后进入待审核；仅已发布条目可标记已解决；已下架需管理端恢复为待审后才可修改。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/lostfound">
            ← 返回浏览
          </Link>
          <Link className={buttonVariants({ size: "sm" })} href="/lostfound/new">
            新建发布
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">共 {data.total} 条</Badge>
        <Badge variant="secondary">
          第 {displayPage} / {totalPages} 页
        </Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-12" action="/lostfound/me" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-6">
              <Input name="q" placeholder="搜索标题/正文/地点…" defaultValue={q} />
            </div>

            <div className="md:col-span-3">
              <Select name="status" defaultValue={statusValue}>
                <option value="">全部状态</option>
                <option value="pending">待审核</option>
                <option value="published">已发布</option>
                <option value="rejected">已驳回</option>
                <option value="offline">已下架</option>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Select name="pageSize" defaultValue={String(pageSize)}>
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    每页 {n}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/lostfound/me">
                清空
              </Link>
              <Button size="sm" type="submit">
                应用
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">原因</th>
              <th className="px-3 py-2">创建</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={6}>
                  暂无发布
                </td>
              </tr>
            ) : null}

            {data.items.map((item) => {
              const meta = statusMeta(item.status);
              const reason = item.status === "rejected" ? item.rejectReason : item.status === "offline" ? item.offlineReason : null;
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <div className="line-clamp-1 font-medium">{item.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.solvedAt ? <Badge variant="secondary">已解决</Badge> : null}
                      {item.publishedAt ? <Badge variant="outline">发布：{formatZhDateTime(item.publishedAt)}</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="max-w-[22rem] truncate text-xs text-muted-foreground">{reason ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatZhDateTime(item.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <LostfoundMyActions id={item.id} status={item.status} solvedAt={item.solvedAt ? item.solvedAt.toISOString() : null} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) => buildMyLostfoundHref({ q, status: statusValue || undefined, page: nextPage, pageSize })}
      />
    </div>
  );
}

