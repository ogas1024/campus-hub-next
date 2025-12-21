import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseBooleanParam, parseIntParam } from "@/lib/http/query";
import { listPortalLostfound } from "@/lib/modules/lostfound/lostfound.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function safeDate(value: string | undefined) {
  const v = value?.trim();
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function typeLabel(type: string) {
  return type === "lost" ? "丢失" : type === "found" ? "拾到" : type;
}

function buildLostfoundHref(params: {
  type?: string;
  q?: string;
  solved?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.solved) sp.set("solved", "true");
  if (params.from && params.from.trim()) sp.set("from", params.from.trim());
  if (params.to && params.to.trim()) sp.set("to", params.to.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/lostfound?${query}` : "/lostfound";
}

export default async function LostfoundPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const type = pickString(sp.type) ?? "";
  const typeValue: "lost" | "found" | "" = type === "lost" || type === "found" ? type : "";

  const solved = parseBooleanParam(pickString(sp.solved) ?? null, { defaultValue: false });
  const fromRaw = pickString(sp.from) ?? "";
  const toRaw = pickString(sp.to) ?? "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listPortalLostfound({
    page,
    pageSize,
    type: typeValue || undefined,
    q: q.trim() ? q.trim() : undefined,
    includeSolved: solved,
    from: safeDate(fromRaw) ?? undefined,
    to: safeDate(toRaw) ?? undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildLostfoundHref({ type: typeValue || undefined, q, solved, from: fromRaw, to: toRaw, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">失物招领</h1>
          <p className="text-sm text-muted-foreground">登录后可浏览；发布默认审核；不做站内私信撮合，仅展示发布者自填联系方式。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/lostfound/me">
            我的发布
          </Link>
          <Link className={buttonVariants({ size: "sm" })} href="/lostfound/new">
            发布
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-12" action="/lostfound" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-3">
              <Select name="type" defaultValue={typeValue}>
                <option value="">全部类型</option>
                <option value="lost">丢失</option>
                <option value="found">拾到</option>
              </Select>
            </div>

            <div className="md:col-span-5">
              <Input name="q" placeholder="搜索标题/正文/地点…" defaultValue={q} />
            </div>

            <div className="md:col-span-2">
              <Select name="pageSize" defaultValue={String(pageSize)}>
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    每页 {n}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-12 grid gap-3 md:grid-cols-12">
              <div className="md:col-span-3">
                <Input name="from" type="datetime-local" defaultValue={fromRaw} placeholder="from（可选）" />
              </div>
              <div className="md:col-span-3">
                <Input name="to" type="datetime-local" defaultValue={toRaw} placeholder="to（可选）" />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <input id="solved" name="solved" type="checkbox" defaultChecked={solved} value="true" />
                <label htmlFor="solved" className="text-sm text-muted-foreground">
                  显示已解决
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/lostfound">
                清空
              </Link>
              <button className={buttonVariants({ size: "sm" })} type="submit">
                应用
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无已发布条目</CardContent>
          </Card>
        ) : null}

        {data.items.map((item) => {
          const solvedTag = item.solvedAt ? <Badge variant="secondary">已解决</Badge> : null;
          const coverUrl = item.coverImage?.signedUrl ?? null;
          return (
            <Link key={item.id} href={`/lostfound/${item.id}`} className="block">
              <Card className={cn("hover:bg-accent", item.solvedAt ? "opacity-80" : null)}>
                <CardContent className="flex gap-4 p-5">
                  <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">无图</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{typeLabel(item.type)}</Badge>
                      {solvedTag}
                      <div className="min-w-0 truncate text-base font-semibold">{item.title}</div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div>地点：{item.location ?? "—"}</div>
                      <div>时间：{formatZhDateTime(item.occurredAt)}</div>
                    </div>

                    <div className="text-xs text-muted-foreground">发布：{formatZhDateTime(item.publishedAt)}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {data.total > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          hrefForPage={(p) => buildLostfoundHref({ type: typeValue || undefined, q, solved, from: fromRaw, to: toRaw, page: p, pageSize })}
        />
      ) : null}
    </div>
  );
}
