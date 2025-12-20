import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsoleModuleTabs } from "@/components/console/ConsoleModuleTabs";
import { ConsoleSurveyActions } from "@/components/surveys/ConsoleSurveyActions";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/Pagination";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { parseIntParam, parseBooleanParam } from "@/lib/http/query";
import { listConsoleSurveys } from "@/lib/modules/surveys/surveys.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function statusMeta(status: string) {
  switch (status) {
    case "draft":
      return { label: "草稿", className: "bg-muted text-muted-foreground" };
    case "published":
      return { label: "已发布", className: "bg-emerald-500/10 text-emerald-700" };
    case "closed":
      return { label: "已结束", className: "bg-muted text-muted-foreground" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

function buildConsoleSurveysHref(params: {
  status?: string;
  q?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.mine) sp.set("mine", "true");
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/console/surveys?${query}` : "/console/surveys";
}

export default async function ConsoleSurveysPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:survey:list");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const mine = parseBooleanParam(pickString(sp.mine) ?? null, { defaultValue: false });

  const status = pickString(sp.status);
  const statusValue = status === "draft" || status === "published" || status === "closed" ? status : undefined;

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const [canCreate, canUpdate, canPublish, canClose, canDelete, canManageAll] = await Promise.all([
    hasPerm(user.id, "campus:survey:create"),
    hasPerm(user.id, "campus:survey:update"),
    hasPerm(user.id, "campus:survey:publish"),
    hasPerm(user.id, "campus:survey:close"),
    hasPerm(user.id, "campus:survey:delete"),
    hasPerm(user.id, "campus:survey:*"),
  ]);

  const data = await listConsoleSurveys({
    actorUserId: user.id,
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
    status: statusValue,
    mine,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildConsoleSurveysHref({ status: statusValue, q, mine, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">问卷</h1>
          <p className="text-sm text-muted-foreground">草稿可编辑结构；发布后锁定结构；到期后视为已结束（closed）。</p>
          <div className="text-sm text-muted-foreground">
            共 {data.total} 条 · 第 {displayPage} / {totalPages} 页
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? (
            <Link href="/console/surveys/new" className={buttonVariants({ size: "sm" })}>
              新建问卷
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto">
          <ConsoleModuleTabs
            ariaLabel="问卷 状态切换"
            activeId={statusValue ?? "all"}
            tabs={[
              { id: "all", label: "全部", href: buildConsoleSurveysHref({ status: undefined, q, mine, page: 1, pageSize }) },
              { id: "published", label: "已发布", href: buildConsoleSurveysHref({ status: "published", q, mine, page: 1, pageSize }) },
              { id: "draft", label: "草稿", href: buildConsoleSurveysHref({ status: "draft", q, mine, page: 1, pageSize }) },
              { id: "closed", label: "已结束", href: buildConsoleSurveysHref({ status: "closed", q, mine, page: 1, pageSize }) },
            ]}
          />
        </div>

        <div className="ml-auto" />

        <form className="flex flex-wrap items-center gap-2" action="/console/surveys" method="GET">
          {statusValue ? <input type="hidden" name="status" value={statusValue} /> : null}
          <input type="hidden" name="page" value="1" />

          <Input
            name="q"
            uiSize="sm"
            className="w-56"
            placeholder="搜索标题…"
            defaultValue={q}
          />

          <Select
            name="mine"
            defaultValue={mine ? "true" : "false"}
            uiSize="sm"
            className="w-28"
          >
            <option value="false">全部</option>
            <option value="true">仅我创建</option>
          </Select>

          <Select
            name="pageSize"
            defaultValue={String(pageSize)}
            uiSize="sm"
            className="w-28"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={String(n)}>
                每页 {n}
              </option>
            ))}
          </Select>

          <button className={buttonVariants({ size: "sm", variant: "outline" })} type="submit">
            应用
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">暂无问卷</div>
        ) : null}

        {data.items.map((item) => {
          const meta = statusMeta(item.effectiveStatus);
          const isMine = item.createdBy === user.id;

          return (
            <div key={item.id} className={cn("rounded-xl border border-border bg-card p-5", item.effectiveStatus === "published" ? "border-primary/40" : null)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold">{item.title}</div>
                    <span className={cn("rounded px-2 py-0.5 text-xs font-medium", meta.className)}>{meta.label}</span>
                    {item.anonymousResponses ? <Badge variant="outline">匿名答卷</Badge> : null}
                    {item.visibleAll ? <Badge variant="secondary">全员可见</Badge> : <Badge variant="outline">定向可见</Badge>}
                    {isMine ? <Badge variant="outline">我创建</Badge> : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatZhDateTime(item.startAt)} ~ {formatZhDateTime(item.endAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">更新时间：{formatZhDateTime(item.updatedAt)}</div>
                </div>

                <ConsoleSurveyActions
                  surveyId={item.id}
                  status={item.status}
                  effectiveStatus={item.effectiveStatus}
                  isMine={isMine}
                  canUpdate={canUpdate}
                  canPublish={canPublish}
                  canClose={canClose}
                  canDelete={canDelete}
                  canManageAll={canManageAll}
                />
              </div>
            </div>
          );
        })}
      </div>

      {data.total > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          hrefForPage={(p) => buildConsoleSurveysHref({ status: statusValue, q, mine, page: p, pageSize })}
        />
      ) : null}
    </div>
  );
}
