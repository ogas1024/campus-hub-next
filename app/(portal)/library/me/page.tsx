import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { listMyLibraryBooks } from "@/lib/modules/library/library.service";
import { getLibraryBookStatusMeta, getLibraryFileFormatLabel } from "@/lib/modules/library/library.ui";
import type { LibraryBookStatus } from "@/lib/modules/library/library.utils";
import { formatZhDateTime } from "@/lib/ui/datetime";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildMyLibraryHref(params: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/library/me?${query}` : "/library/me";
}

function isBookStatus(value: string): value is LibraryBookStatus {
  return value === "draft" || value === "pending" || value === "published" || value === "rejected" || value === "unpublished";
}

export default async function MyLibraryBooksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const statusRaw = pickString(sp.status) ?? "";
  const statusValue = statusRaw && isBookStatus(statusRaw) ? statusRaw : "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listMyLibraryBooks({
    userId: user.id,
    page,
    pageSize,
    status: statusValue ? statusValue : undefined,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildMyLibraryHref({ q, status: statusValue || undefined, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">我的投稿</h1>
          <p className="text-sm text-muted-foreground">草稿/驳回/下架可编辑并重新提交；待审核不可修改；已发布可下架后再编辑。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library">
            ← 返回浏览
          </Link>
          <Link className={buttonVariants({ size: "sm" })} href="/library/me/new">
            新建投稿
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
          <form className="grid gap-3 md:grid-cols-12" action="/library/me" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-6">
              <Input name="q" placeholder="搜索标题/作者/ISBN/关键词…" defaultValue={q} />
            </div>

            <div className="md:col-span-3">
              <Select name="status" defaultValue={statusValue}>
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="pending">待审核</option>
                <option value="published">已发布</option>
                <option value="rejected">已驳回</option>
                <option value="unpublished">已下架</option>
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
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/me">
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
              <th className="px-3 py-2">书名</th>
              <th className="px-3 py-2">ISBN</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">资产</th>
              <th className="px-3 py-2 text-right">下载</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={6}>
                  暂无投稿
                </td>
              </tr>
            ) : null}

            {data.items.map((item) => {
              const meta = getLibraryBookStatusMeta(item.status);
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <div className="line-clamp-1 font-medium">{item.title}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">
                      {item.author} · {item.publishedAt ? `发布 ${formatZhDateTime(item.publishedAt)}` : "未发布"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs">{item.isbn13}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.assetFormats.map((f) => (
                        <Badge key={f} variant="secondary">
                          {getLibraryFileFormatLabel(f)}
                        </Badge>
                      ))}
                      {item.hasLinkAssets ? <Badge variant="secondary">外链</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{item.downloadCount}</td>
                  <td className="px-3 py-3 text-right">
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/library/me/${item.id}`}>
                      管理
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={displayPage} totalPages={totalPages} hrefForPage={(nextPage) => buildMyLibraryHref({ q, status: statusValue || undefined, page: nextPage, pageSize })} />
    </div>
  );
}
