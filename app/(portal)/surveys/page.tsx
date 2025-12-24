import Link from "next/link";
import { redirect } from "next/navigation";

import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { PortalSurveyDialogController } from "@/components/surveys/PortalSurveyDialogController";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { withDialogHref } from "@/lib/navigation/dialog";
import { listPortalSurveys } from "@/lib/modules/surveys/surveys.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildPortalSurveysHref(params: { q?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/surveys?${query}` : "/surveys";
}

export default async function SurveysPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listPortalSurveys({
    userId: user.id,
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildPortalSurveysHref({ q, page: totalPages, pageSize }));
  }

  const baseHref = buildPortalSurveysHref({ q, page: displayPage, pageSize });

  return (
    <div className="space-y-4">
      <PageHeader
        title="问卷"
        description="整页/分节式填写；截止前可修改并覆盖提交。"
        meta={
          <>
            <Badge variant="secondary">共 {data.total} 份</Badge>
            <Badge variant="secondary">
              第 {displayPage} / {totalPages} 页
            </Badge>
          </>
        }
      />

      <FiltersPanel title="搜索与分页">
        <form className="grid gap-3 md:grid-cols-12" action="/surveys" method="GET">
          <input type="hidden" name="page" value="1" />

          <div className="md:col-span-6">
            <Input uiSize="sm" name="q" placeholder="按标题搜索…" defaultValue={q} />
          </div>

          <div className="md:col-span-2">
            <Select uiSize="sm" name="pageSize" defaultValue={String(pageSize)}>
              {[10, 20, 50].map((n) => (
                <option key={n} value={String(n)}>
                  每页 {n}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-12">
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/surveys">
              清空
            </Link>
            <button className={buttonVariants({ size: "sm" })} type="submit">
              应用
            </button>
          </div>
        </form>
      </FiltersPanel>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无可填写问卷</CardContent>
          </Card>
        ) : null}

        {data.items.map((item) => (
          <Link
            key={item.id}
            scroll={false}
            href={withDialogHref(baseHref, { dialog: "survey-fill", id: item.id })}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Card className={cn("transition-colors hover:bg-muted/40", item.phase === "active" ? "border-primary" : null)}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold">{item.title}</div>
                  {item.phase === "active" ? <Badge>进行中</Badge> : null}
                  {item.phase === "upcoming" ? <Badge variant="outline">未开始</Badge> : null}
                  {item.phase === "closed" ? <Badge variant="secondary">已结束</Badge> : null}
                  {item.anonymousResponses ? <Badge variant="outline">匿名答卷</Badge> : null}
                  {item.submittedAt ? <Badge variant="outline">已填写</Badge> : null}
                </div>

                <div className="text-sm text-muted-foreground">
                  {formatZhDateTime(item.startAt)} ~ {formatZhDateTime(item.endAt)}
                </div>

                {item.submittedAt ? (
                  <div className="text-xs text-muted-foreground">我的提交：{formatZhDateTime(item.submittedAt)}</div>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {data.total > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          hrefForPage={(p) => buildPortalSurveysHref({ q, page: p, pageSize })}
        />
      ) : null}

      <PortalSurveyDialogController />
    </div>
  );
}
