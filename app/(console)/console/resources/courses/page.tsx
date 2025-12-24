import Link from "next/link";

import { CoursesManager } from "@/components/course-resources/CoursesManager";
import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { listConsoleCourses, listConsoleScopedMajors } from "@/lib/modules/course-resources/courseResources.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(params: { majorId?: string }) {
  const sp = new URLSearchParams();
  if (params.majorId) sp.set("majorId", params.majorId);
  const q = sp.toString();
  return q ? `/console/resources/courses?${q}` : "/console/resources/courses";
}

export default async function ConsoleResourceCoursesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:resource:course_list");

  const sp = await searchParams;

  const [canCreate, canUpdate, canDelete, majors] = await Promise.all([
    hasPerm(user.id, "campus:resource:course_create"),
    hasPerm(user.id, "campus:resource:course_update"),
    hasPerm(user.id, "campus:resource:course_delete"),
    listConsoleScopedMajors({ actorUserId: user.id }),
  ]);

  const majorIdParam = pickString(sp.majorId);
  const majorId = majors.some((m) => m.id === majorIdParam) ? majorIdParam : undefined;
  const courses = await listConsoleCourses({ actorUserId: user.id, majorId });

  return (
    <div className="space-y-4">
      <PageHeader title="课程管理" description="维护课程字典；major_lead 仅能操作本专业范围。" />

      {majors.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">当前账号没有可管理的专业范围（major_lead 未配置或专业已删除）。</CardContent>
        </Card>
      ) : null}

      <FiltersPanel>
        <form action="/console/resources/courses" method="GET" className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">专业</label>
            <Select uiSize="sm" name="majorId" defaultValue={majorId ?? ""} className="w-64">
              <option value="">全部专业</option>
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Link href="/console/resources/courses" className={buttonVariants({ variant: "outline", size: "sm" })}>
              清空
            </Link>
            <button className={buttonVariants({ size: "sm" })} type="submit">
              应用
            </button>
          </div>
        </form>
      </FiltersPanel>

      <Card>
        <CardContent className="p-4">
          <CoursesManager
            courses={courses.map((c) => ({ ...c, majorName: c.majorName ?? "—" }))}
            majors={majors}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </CardContent>
      </Card>

      {majorId ? (
        <div className="text-xs text-muted-foreground">
          当前筛选：{majors.find((m) => m.id === majorId)?.name ?? majorId} · <Link className="underline" href={buildHref({})}>查看全部</Link>
        </div>
      ) : null}
    </div>
  );
}
