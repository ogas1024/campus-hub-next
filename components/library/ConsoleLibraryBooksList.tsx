import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/PageHeader";
import { ConsoleFiltersCard } from "@/components/console/crud/ConsoleFiltersCard";
import { ConsoleLibraryBookActions } from "@/components/library/ConsoleLibraryBookActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { parseIntParam } from "@/lib/http/query";
import { listConsoleLibraryBooks } from "@/lib/modules/library/library.service";
import { getLibraryBookStatusMeta, getLibraryFileFormatLabel } from "@/lib/modules/library/library.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(basePath: string, params: { q?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export type ConsoleLibraryBooksListProps = {
  title: string;
  description: string;
  fixedStatus: "pending" | "published" | "rejected" | "unpublished";
  basePath: string;
  searchParams: SearchParams;
  canReview: boolean;
  canOffline: boolean;
  canDelete: boolean;
  canAuditList: boolean;
};

export async function ConsoleLibraryBooksList(props: ConsoleLibraryBooksListProps) {
  const sp = props.searchParams;
  const q = pickString(sp.q) ?? "";
  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listConsoleLibraryBooks({
    page,
    pageSize,
    status: props.fixedStatus,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildHref(props.basePath, { q, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={props.title}
        description={props.description}
        meta={
          <>
            <Badge variant="secondary">共 {data.total} 条</Badge>
            <Badge variant="secondary">
              第 {displayPage} / {totalPages} 页
            </Badge>
          </>
        }
      />

      <ConsoleFiltersCard title="搜索">
        <form className="grid gap-3 md:grid-cols-12" action={props.basePath} method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-8">
              <Input name="q" uiSize="sm" placeholder="搜索标题/作者/ISBN/关键词…" defaultValue={q} />
            </div>

            <div className="md:col-span-4">
              <Select name="pageSize" defaultValue={String(pageSize)} uiSize="sm">
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    每页 {n}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={props.basePath}>
                清空
              </Link>
              <button className={buttonVariants({ size: "sm" })} type="submit">
                应用
              </button>
            </div>
          </form>
      </ConsoleFiltersCard>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">书名</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">资产</th>
              <th className="px-3 py-2 text-right">下载</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={5}>
                  暂无数据
                </td>
              </tr>
            ) : null}

            {data.items.map((item) => {
              const statusMeta = getLibraryBookStatusMeta(item.status);
              const canDownload = item.assetFormats.length > 0 || item.hasLinkAssets;
              return (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <Link href={`/console/library/${item.id}`} className="line-clamp-1 font-medium hover:underline">
                        {item.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.author}</span>
                        <span className="font-mono">{item.isbn13}</span>
                        <span>更新 {formatZhDateTime(item.updatedAt)}</span>
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{item.summary ?? "—"}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={["rounded-full px-2 py-0.5 text-xs font-medium", statusMeta.className].join(" ")}>{statusMeta.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.assetFormats.map((f) => (
                        <Badge key={f} variant="secondary">
                          {getLibraryFileFormatLabel(f)}
                        </Badge>
                      ))}
                      {item.hasLinkAssets ? <Badge variant="secondary">外链</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.downloadCount}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-2">
                      <ConsoleLibraryBookActions
                        bookId={item.id}
                        status={item.status}
                        canReview={props.canReview}
                        canOffline={props.canOffline}
                        canDelete={props.canDelete}
                        afterDeleteHref={props.basePath}
                      />

                      <div className="flex flex-wrap justify-end gap-2">
                        {canDownload ? (
                          <form action={`/api/console/library/books/${item.id}/download`} method="POST" target="_blank">
                            <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                              默认下载
                            </button>
                          </form>
                        ) : null}
                        {props.canAuditList ? (
                          <Link
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                            href={`/console/audit?targetType=library_book&targetId=${item.id}`}
                          >
                            审计
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={displayPage} totalPages={totalPages} hrefForPage={(nextPage) => buildHref(props.basePath, { q, page: nextPage, pageSize })} />
    </div>
  );
}
