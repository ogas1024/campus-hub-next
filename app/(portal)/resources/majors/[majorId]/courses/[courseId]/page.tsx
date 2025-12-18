import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { listPortalCourses, listPortalMajors, listPortalResources } from "@/lib/modules/course-resources/courseResources.service";
import { getCourseResourceTypeLabel } from "@/lib/modules/course-resources/courseResources.ui";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(params: { majorId: string; courseId: string; q?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const q = sp.toString();
  const base = `/resources/majors/${params.majorId}/courses/${params.courseId}`;
  return q ? `${base}?${q}` : base;
}

export default async function CourseResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ majorId: string; courseId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { majorId, courseId } = await params;
  const sp = await searchParams;

  const majors = await listPortalMajors();
  const major = majors.find((m) => m.id === majorId);
  if (!major) notFound();

  const courses = await listPortalCourses({ userId: user.id, majorId });
  const course = courses.find((c) => c.id === courseId);
  if (!course) notFound();

  const q = pickString(sp.q) ?? "";
  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listPortalResources({
    userId: user.id,
    courseId,
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildHref({ majorId, courseId, q, page: totalPages, pageSize }));
  }

  const shareHref = `/resources/majors/${majorId}/courses/${courseId}/share`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href="/resources">
            专业
          </Link>
          <span aria-hidden>/</span>
          <Link className="hover:text-foreground" href={`/resources/majors/${majorId}`}>
            {major.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{course.name}</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{course.name}</h1>
            <p className="text-sm text-muted-foreground">仅展示已发布资源；下载会自动计数。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ size: "sm" })} href={shareHref}>
              分享资源
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/me">
              我的投稿
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/leaderboard">
              榜单
            </Link>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">搜索与分页</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-12" action={buildHref({ majorId, courseId })} method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-8">
              <Input name="q" placeholder="搜索标题/描述…" defaultValue={q} />
            </div>

            <div className="md:col-span-2">
              <Select name="pageSize" defaultValue={String(pageSize)}>
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}/页
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={buildHref({ majorId, courseId })}>
                清空
              </Link>
              <button className={buttonVariants({ size: "sm" })} type="submit">
                应用
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-10 text-center text-sm text-muted-foreground">
            <div>暂无已发布资源</div>
            <div>
              <Link className={buttonVariants({ size: "sm" })} href={shareHref}>
                分享第一个资源
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.isBest ? <Badge>最佳</Badge> : null}
                  <Badge variant="secondary">{getCourseResourceTypeLabel(item.resourceType)}</Badge>
                  <Badge variant="outline">下载 {item.downloadCount}</Badge>
                </div>

                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <Link href={`/resources/${item.id}`} className="line-clamp-1 font-medium hover:underline">
                      {item.title}
                    </Link>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{item.description}</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <form action={`/api/resources/${item.id}/download`} method="POST" target="_blank">
                      <button className={buttonVariants({ size: "sm" })} type="submit">
                        下载
                      </button>
                    </form>
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/resources/${item.id}`}>
                      详情
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) => buildHref({ majorId, courseId, q, page: nextPage, pageSize })}
      />
    </div>
  );
}

