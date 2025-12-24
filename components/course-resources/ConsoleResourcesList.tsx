import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/PageHeader";
import { ConsoleFiltersCard } from "@/components/console/crud/ConsoleFiltersCard";
import { ConsoleResourceActions } from "@/components/course-resources/ConsoleResourceActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { parseIntParam } from "@/lib/http/query";
import { listConsoleCourses, listConsoleResources, listConsoleScopedMajors } from "@/lib/modules/course-resources/courseResources.service";
import { getCourseResourceStatusMeta, getCourseResourceTypeLabel } from "@/lib/modules/course-resources/courseResources.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(basePath: string, params: { majorId?: string; courseId?: string; q?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.majorId) sp.set("majorId", params.majorId);
  if (params.courseId) sp.set("courseId", params.courseId);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export type ConsoleResourcesListProps = {
  actorUserId: string;
  title: string;
  description: string;
  fixedStatus: "pending" | "published" | "rejected" | "unpublished";
  basePath: string;
  searchParams: SearchParams;
  canReview: boolean;
  canOffline: boolean;
  canBest: boolean;
  canDelete: boolean;
  canCourseList: boolean;
  canAuditList: boolean;
};

export async function ConsoleResourcesList(props: ConsoleResourcesListProps) {
  const sp = props.searchParams;
  const q = pickString(sp.q) ?? "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const majorOptions = await listConsoleScopedMajors({ actorUserId: props.actorUserId });
  const majorIdParam = pickString(sp.majorId);
  const majorId = majorOptions.some((m) => m.id === majorIdParam) ? majorIdParam : undefined;

  const courseOptions = props.canCourseList ? await listConsoleCourses({ actorUserId: props.actorUserId, majorId }) : [];
  const courseIdParam = pickString(sp.courseId);
  const courseId = courseOptions.some((c) => c.id === courseIdParam) ? courseIdParam : undefined;

  const data = await listConsoleResources({
    actorUserId: props.actorUserId,
    page,
    pageSize,
    status: props.fixedStatus,
    majorId,
    courseId,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildHref(props.basePath, { majorId, courseId, q, page: totalPages, pageSize }));
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
        actions={
          props.canAuditList ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/audit?targetType=course_resource">
              审计检索
            </Link>
          ) : null
        }
      />

      <ConsoleFiltersCard>
        <form className="grid gap-3 md:grid-cols-12" action={props.basePath} method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-3">
              <Select name="majorId" defaultValue={majorId ?? ""} uiSize="sm">
                <option value="">全部专业</option>
                {majorOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-3">
              <Select name="courseId" defaultValue={courseId ?? ""} uiSize="sm" disabled={!props.canCourseList}>
                <option value="">{props.canCourseList ? "全部课程" : "无权限"}</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select name="pageSize" defaultValue={String(pageSize)} uiSize="sm">
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}/页
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-4">
              <Input name="q" uiSize="sm" placeholder="搜索标题…" defaultValue={q} />
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
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">专业/课程</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2 text-right">下载</th>
              <th className="px-3 py-2">提交/审核/发布</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-sm text-muted-foreground" colSpan={7}>
                  暂无数据
                </td>
              </tr>
            ) : null}

            {data.items.map((item) => {
              const meta = getCourseResourceStatusMeta(item.status);
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isBest ? <Badge>最佳</Badge> : null}
                      <Link className="line-clamp-1 font-medium hover:underline" href={`/console/resources/${item.id}`}>
                        {item.title}
                      </Link>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{item.majorName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.courseName}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{getCourseResourceTypeLabel(item.resourceType)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.downloadCount}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <div>提交：{formatZhDateTime(item.submittedAt)}</div>
                    <div>审核：{formatZhDateTime(item.reviewedAt)}</div>
                    <div>发布：{formatZhDateTime(item.publishedAt)}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ConsoleResourceActions
                      resourceId={item.id}
                      status={item.status}
                      isBest={item.isBest}
                      canReview={props.canReview}
                      canOffline={props.canOffline}
                      canBest={props.canBest}
                      canDelete={props.canDelete}
                      compact
                      afterDeleteHref={props.basePath}
                    />
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
        hrefForPage={(nextPage) => buildHref(props.basePath, { majorId, courseId, q, page: nextPage, pageSize })}
      />
    </div>
  );
}
