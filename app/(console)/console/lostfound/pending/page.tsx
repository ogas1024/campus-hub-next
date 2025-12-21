import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsoleLostfoundActions } from "@/components/lostfound/ConsoleLostfoundActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { parseIntParam } from "@/lib/http/query";
import { listConsoleLostfound } from "@/lib/modules/lostfound/lostfound.service";
import { formatZhDateTime } from "@/lib/ui/datetime";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function typeLabel(type: string) {
  return type === "lost" ? "丢失" : type === "found" ? "拾到" : type;
}

function buildHref(params: { q?: string; type?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.type) sp.set("type", params.type);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return qs ? `/console/lostfound/pending?${qs}` : "/console/lostfound/pending";
}

export default async function ConsoleLostfoundPendingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:lostfound:list");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const type = pickString(sp.type) ?? "";
  const typeValue: "lost" | "found" | "" = type === "lost" || type === "found" ? type : "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const [canReview, canOffline, canRestore, canDelete] = await Promise.all([
    hasPerm(user.id, "campus:lostfound:review"),
    hasPerm(user.id, "campus:lostfound:offline"),
    hasPerm(user.id, "campus:lostfound:restore"),
    hasPerm(user.id, "campus:lostfound:delete"),
  ]);

  const data = await listConsoleLostfound({
    page,
    pageSize,
    status: "pending",
    type: typeValue || undefined,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildHref({ q, type: typeValue || undefined, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">共 {data.total} 条</Badge>
          <Badge variant="secondary">
            第 {displayPage} / {totalPages} 页
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-12" action="/console/lostfound/pending" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-3">
              <Select name="type" defaultValue={typeValue}>
                <option value="">全部类型</option>
                <option value="lost">丢失</option>
                <option value="found">拾到</option>
              </Select>
            </div>

            <div className="md:col-span-6">
              <Input name="q" placeholder="搜索标题/正文/地点…" defaultValue={q} />
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
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/lostfound/pending">
                清空
              </Link>
              <button className={buttonVariants({ size: "sm" })} type="submit">
                应用
              </button>
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
              <th className="px-3 py-2">作者</th>
              <th className="px-3 py-2">创建</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={5}>
                  暂无待审核条目
                </td>
              </tr>
            ) : null}

            {data.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-3">
                  <div className="line-clamp-1 font-medium">{item.title}</div>
                </td>
                <td className="px-3 py-3">
                  <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm">{item.createdBy.name}</div>
                  <div className="text-xs text-muted-foreground">{item.createdBy.studentId}</div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{formatZhDateTime(item.createdAt)}</td>
                <td className="px-3 py-3 text-right">
                  <ConsoleLostfoundActions
                    itemId={item.id}
                    status={item.status}
                    canReview={canReview}
                    canOffline={canOffline}
                    canRestore={canRestore}
                    canDelete={canDelete}
                    compact
                    afterDeleteHref="/console/lostfound/pending"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={displayPage} totalPages={totalPages} hrefForPage={(p) => buildHref({ q, type: typeValue || undefined, page: p, pageSize })} />
    </div>
  );
}

