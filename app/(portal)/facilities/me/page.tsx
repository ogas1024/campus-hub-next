import Link from "next/link";
import { redirect } from "next/navigation";

import { MyReservationRowActions } from "@/components/facilities/MyReservationRowActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { formatFacilityFloorLabel } from "@/lib/modules/facilities/facilities.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { listMyReservations } from "@/lib/modules/facilities/facilities.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(params: { status?: string; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/facilities/me?${query}` : "/facilities/me";
}

function statusMeta(status: string) {
  switch (status) {
    case "pending":
      return { label: "待审核", className: "bg-amber-500/10 text-amber-700" };
    case "approved":
      return { label: "已批准", className: "bg-emerald-500/10 text-emerald-700" };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-500/10 text-rose-700" };
    case "cancelled":
      return { label: "已取消", className: "bg-muted text-muted-foreground" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export default async function FacilitiesMePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();

  const sp = await searchParams;
  const status = pickString(sp.status) ?? "";
  const statusValue: "pending" | "approved" | "rejected" | "cancelled" | "" =
    status === "pending" || status === "approved" || status === "rejected" || status === "cancelled" ? status : "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listMyReservations({
    userId: user.id,
    page,
    pageSize,
    status: statusValue ? statusValue : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(buildHref({ status: statusValue || undefined, page: totalPages, pageSize }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">我的预约</h1>
          <p className="text-sm text-muted-foreground">开始前可取消；被驳回可修改并重提。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities">
            ← 返回纵览
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
        <CardContent className="p-4">
          <form className="flex flex-wrap gap-2" action="/facilities/me" method="GET">
            <input type="hidden" name="page" value="1" />
            <Select name="status" defaultValue={statusValue}>
              <option value="">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已批准</option>
              <option value="rejected">已驳回</option>
              <option value="cancelled">已取消</option>
            </Select>
            <Select name="pageSize" defaultValue={String(pageSize)}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n} / 页
                </option>
              ))}
            </Select>
            <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
              应用筛选
            </button>
          </form>
        </CardContent>
      </Card>

      {data.total === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无预约记录。</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">房间</th>
                    <th className="px-3 py-3">时间</th>
                    <th className="px-3 py-3">参与人</th>
                    <th className="px-3 py-3">创建时间</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => {
                    const meta = statusMeta(it.status);
                    return (
                      <tr key={it.id} className="border-t border-border">
                        <td className="px-3 py-3">
                          <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
                          {it.status === "rejected" && it.rejectReason ? (
                            <div className="mt-2 text-xs text-rose-700/90">原因：{it.rejectReason}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium">{it.room.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {it.building.name} / {formatFacilityFloorLabel(it.room.floorNo)}
                          </div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">{it.id}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div>开始：{formatZhDateTime(new Date(it.startAt))}</div>
                          <div>结束：{formatZhDateTime(new Date(it.endAt))}</div>
                        </td>
                        <td className="px-3 py-3 text-sm">{it.participantCount} 人</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{formatZhDateTime(new Date(it.createdAt))}</td>
                        <td className="px-3 py-3 text-right">
                          <MyReservationRowActions
                            userId={user.id}
                            reservationId={it.id}
                            status={it.status}
                            startAt={it.startAt.toISOString()}
                            nowIso={nowIso}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Pagination page={displayPage} totalPages={totalPages} hrefForPage={(p) => buildHref({ status: statusValue || undefined, page: p, pageSize })} />
    </div>
  );
}
