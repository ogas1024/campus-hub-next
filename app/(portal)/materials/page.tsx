import Link from "next/link";
import { redirect } from "next/navigation";

import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { PortalMaterialDialogController } from "@/components/materials/PortalMaterialDialogController";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { withDialogHref } from "@/lib/navigation/dialog";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { listPortalMaterials } from "@/lib/modules/materials/materials.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildPortalMaterialsHref(params: { q?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/materials?${query}` : "/materials";
}

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listPortalMaterials({ userId: user.id, page, pageSize, q: q.trim() ? q.trim() : undefined });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildPortalMaterialsHref({ q, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <PortalMaterialDialogController />

      <PageHeader
        title="材料收集"
        description="下载模板、上传文件并提交；支持撤回（将物理删除已上传文件）。"
        meta={
          <>
            <Badge variant="secondary">共 {data.total} 项</Badge>
            <Badge variant="secondary">
              第 {displayPage} / {totalPages} 页
            </Badge>
          </>
        }
      />

      <FiltersPanel title="搜索与分页">
        <form className="grid gap-3 md:grid-cols-12" action="/materials" method="GET">
            <input type="hidden" name="page" value="1" />

            <div className="md:col-span-6">
              <Input name="q" uiSize="sm" placeholder="按标题搜索…" defaultValue={q} />
            </div>

            <div className="md:col-span-2">
              <Select name="pageSize" defaultValue={String(pageSize)} uiSize="sm">
                {[10, 20, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    每页 {n}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/materials">
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
            <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无可提交任务</CardContent>
          </Card>
        ) : null}

        {data.items.map((item) => {
          const active = item.canSubmit;
          return (
            <Link
              key={item.id}
              href={withDialogHref(buildPortalMaterialsHref({ q, page: displayPage, pageSize }), { dialog: "material-submit", id: item.id })}
              scroll={false}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Card className={cn("hover:bg-accent", active ? "border-primary" : null)}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold">{item.title}</div>
                    {item.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">不可提交</Badge>}
                    {item.noticeId ? <Badge variant="outline">关联公告</Badge> : null}
                  </div>

                  {item.dueAt ? <div className="text-sm text-muted-foreground">截止：{formatZhDateTime(item.dueAt)}</div> : null}
                  <div className="text-xs text-muted-foreground">更新时间：{formatZhDateTime(item.updatedAt)}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {data.total > 0 ? <Pagination page={displayPage} totalPages={totalPages} hrefForPage={(p) => buildPortalMaterialsHref({ q, page: p, pageSize })} /> : null}
    </div>
  );
}
