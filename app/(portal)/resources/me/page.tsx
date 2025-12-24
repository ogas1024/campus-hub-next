import Link from "next/link";
import { redirect } from "next/navigation";

import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { PortalResourceDialogController } from "@/components/course-resources/PortalResourceDialogController";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { listMyResources } from "@/lib/modules/course-resources/courseResources.service";
import { withDialogHref } from "@/lib/navigation/dialog";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function statusMeta(status: string) {
  switch (status) {
    case "draft":
      return { label: "草稿", className: "bg-muted text-muted-foreground" };
    case "pending":
      return { label: "待审核", className: "bg-amber-500/10 text-amber-700" };
    case "published":
      return { label: "已发布", className: "bg-emerald-500/10 text-emerald-700" };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-500/10 text-rose-700" };
    case "unpublished":
      return { label: "已下架", className: "bg-muted text-muted-foreground" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

function typeLabel(type: string) {
  return type === "file" ? "文件" : type === "link" ? "外链" : type;
}

function buildMyResourcesHref(params: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/resources/me?${query}` : "/resources/me";
}

export default async function MyResourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const status = pickString(sp.status) ?? "";
  const statusValue: "draft" | "pending" | "published" | "rejected" | "unpublished" | "" =
    status === "draft" || status === "pending" || status === "published" || status === "rejected" || status === "unpublished"
      ? status
      : "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listMyResources({
    userId: user.id,
    page,
    pageSize,
    status: statusValue ? statusValue : undefined,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildMyResourcesHref({ q, status: statusValue || undefined, page: totalPages, pageSize }));
  }

  const listHref = buildMyResourcesHref({ q, status: statusValue || undefined, page: displayPage, pageSize });

  return (
    <div className="space-y-4">
      <PageHeader
        title="我的投稿"
        description="草稿/驳回/下架可编辑并重新提交；待审核不可修改；已发布可下架维护。"
        meta={
          <>
            <Badge variant="secondary">共 {data.total} 条</Badge>
            <Badge variant="secondary">
              第 {displayPage} / {totalPages} 页
            </Badge>
          </>
        }
        actions={
          <>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources">
              ← 返回浏览
            </Link>
            <Link className={buttonVariants({ size: "sm" })} href={withDialogHref(listHref, { dialog: "resource-create" })} scroll={false}>
              新建投稿
            </Link>
          </>
        }
      />

      <FiltersPanel>
        <form className="grid gap-3 md:grid-cols-12" action="/resources/me" method="GET">
          <input type="hidden" name="page" value="1" />

          <div className="md:col-span-6">
            <Input uiSize="sm" name="q" placeholder="搜索标题/描述…" defaultValue={q} />
          </div>

          <div className="md:col-span-3">
            <Select uiSize="sm" name="status" defaultValue={statusValue}>
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="pending">待审核</option>
              <option value="published">已发布</option>
              <option value="rejected">已驳回</option>
              <option value="unpublished">已下架</option>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Select uiSize="sm" name="pageSize" defaultValue={String(pageSize)}>
              {[10, 20, 50].map((n) => (
                <option key={n} value={String(n)}>
                  每页 {n}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-12">
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/me">
              清空
            </Link>
            <Button size="sm" type="submit">
              应用
            </Button>
          </div>
        </form>
      </FiltersPanel>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2 text-right">下载</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={5}>
                  暂无投稿
                </td>
              </tr>
            ) : null}

            {data.items.map((item) => {
              const meta = statusMeta(item.status);
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="line-clamp-1 font-medium">{item.title}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{item.description}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{typeLabel(item.resourceType)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>
                      {meta.label}
                    </span>
                    {item.isBest ? <Badge className="ml-2">最佳</Badge> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.downloadCount}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      href={withDialogHref(listHref, { dialog: "resource-edit", id: item.id })}
                      scroll={false}
                    >
                      编辑
                    </Link>
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
        hrefForPage={(nextPage) => buildMyResourcesHref({ q, status: statusValue || undefined, page: nextPage, pageSize })}
      />

      <PortalResourceDialogController />
    </div>
  );
}
