import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { listMyVotes } from "@/lib/modules/votes/votes.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildMyVotesHref(params: { q?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/votes/my?${query}` : "/votes/my";
}

export default async function MyVotesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listMyVotes({
    userId: user.id,
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildMyVotesHref({ q, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">我的投票</h1>
          <p className="text-sm text-muted-foreground">仅展示我已参与的投票（包含归档）。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/votes">
            ← 返回投票列表
          </Link>
          <Badge variant="secondary">共 {data.total} 条</Badge>
          <Badge variant="secondary">
            第 {displayPage} / {totalPages} 页
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">搜索与分页</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-12" action="/votes/my" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-6">
              <Input name="q" placeholder="按标题搜索…" defaultValue={q} />
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

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/votes/my">
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
            <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无参与记录</CardContent>
          </Card>
        ) : null}

        {data.items.map((item) => (
          <Link key={item.id} href={`/votes/${item.id}`} className="block">
            <Card className={cn("hover:bg-accent", item.archivedAt ? "border-muted" : item.phase === "active" ? "border-primary" : null)}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold">{item.title}</div>
                  {item.archivedAt ? <Badge variant="secondary">已归档</Badge> : item.pinned ? <Badge>置顶</Badge> : null}
                  {item.phase === "active" ? <Badge>进行中</Badge> : null}
                  {item.phase === "upcoming" ? <Badge variant="outline">未开始</Badge> : null}
                  {item.phase === "closed" ? <Badge variant="secondary">已结束</Badge> : null}
                  {item.anonymousResponses ? <Badge variant="outline">匿名投票</Badge> : null}
                  {item.submittedAt ? <Badge variant="outline">已投</Badge> : null}
                </div>

                <div className="text-sm text-muted-foreground">
                  {formatZhDateTime(item.startAt)} ~ {formatZhDateTime(item.endAt)}
                </div>

                {item.submittedAt ? (
                  <div className="text-xs text-muted-foreground">我的提交：{formatZhDateTime(item.submittedAt)}</div>
                ) : null}
                {item.archivedAt ? <div className="text-xs text-muted-foreground">归档时间：{formatZhDateTime(item.archivedAt)}</div> : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {data.total > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          hrefForPage={(p) => buildMyVotesHref({ q, page: p, pageSize })}
        />
      ) : null}
    </div>
  );
}

