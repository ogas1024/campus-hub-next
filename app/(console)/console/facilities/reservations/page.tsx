/**
 * 用法：
 * - Console：预约列表与审核（approve/reject）。
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsolePage } from "@/components/console/crud/ConsolePage";
import { ConsoleFiltersCard } from "@/components/console/crud/ConsoleFiltersCard";
import { ConsoleDataTable } from "@/components/console/crud/ConsoleDataTable";
import { ConsoleReservationActions } from "@/components/facilities/console/ConsoleReservationActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/select";
import { requirePerm } from "@/lib/auth/permissions";
import { parseIntParam } from "@/lib/http/query";
import { listConsoleBuildings, listConsoleReservations, listConsoleRooms } from "@/lib/modules/facilities/facilities.service";
import { formatFacilityFloorLabel } from "@/lib/modules/facilities/facilities.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

type SearchParams = Record<string, string | string[] | undefined>;
type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled";

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseIsoParam(value: string | undefined) {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
}

function buildHref(
  basePath: string,
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    buildingId?: string;
    floorNo?: string;
    roomId?: string;
    q?: string;
    from?: string;
    to?: string;
  },
) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.buildingId) sp.set("buildingId", params.buildingId);
  if (params.floorNo) sp.set("floorNo", params.floorNo);
  if (params.roomId) sp.set("roomId", params.roomId);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function statusLabel(status: string) {
  if (status === "pending") return "待审核";
  if (status === "approved") return "已批准";
  if (status === "rejected") return "已驳回";
  if (status === "cancelled") return "已取消";
  return status;
}

export default async function ConsoleFacilityReservationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:facility:review");
  const sp = await searchParams;

  const basePath = "/console/facilities/reservations";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const status = pickString(sp.status);
  const statusValue: ReservationStatus | undefined =
    status === "pending" || status === "approved" || status === "rejected" || status === "cancelled" ? status : undefined;

  const buildingIdParam = pickString(sp.buildingId);
  const floorNoParam = pickString(sp.floorNo);
  const roomIdParam = pickString(sp.roomId);
  const q = pickString(sp.q) ?? "";
  const fromRaw = pickString(sp.from);
  const toRaw = pickString(sp.to);

  const floorNo = floorNoParam && /^-?\d+$/.test(floorNoParam) ? Number(floorNoParam) : undefined;
  const from = parseIsoParam(fromRaw);
  const to = parseIsoParam(toRaw);

  const buildings = await listConsoleBuildings();
  const buildingId = buildings.some((b) => b.id === buildingIdParam) ? buildingIdParam : undefined;
  const rooms = buildingId ? await listConsoleRooms({ buildingId, floorNo: typeof floorNo === "number" ? floorNo : undefined }) : [];
  const roomId = rooms.some((r) => r.id === roomIdParam) ? roomIdParam : undefined;

  const data = await listConsoleReservations({
    actorUserId: user.id,
    page,
    pageSize,
    status: statusValue,
    buildingId,
    floorNo: typeof floorNo === "number" ? floorNo : undefined,
    roomId,
    q: q.trim() ? q.trim() : undefined,
    from,
    to,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(
      buildHref(basePath, {
        status: statusValue,
        buildingId,
        floorNo: floorNoParam,
        roomId,
        q,
        from: fromRaw,
        to: toRaw,
        page: totalPages,
        pageSize,
      }),
    );
  }

  return (
    <ConsolePage
      title="预约审核"
      description="仅显示系统内真实用户的预约记录；待审核预约可通过/驳回（驳回必填理由）。"
      meta={
        <>
          <Badge variant="secondary">共 {data.total} 条</Badge>
          <Badge variant="secondary">
            第 {displayPage} / {totalPages} 页
          </Badge>
        </>
      }
      actions={
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities">
          前台纵览
        </Link>
      }
    >
      <ConsoleFiltersCard>
        <form className="grid gap-3 md:grid-cols-12" action={basePath} method="GET">
          <input type="hidden" name="page" value="1" />

          <div className="md:col-span-3">
            <Select name="buildingId" defaultValue={buildingId ?? ""}>
              <option value="">全部楼房</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.enabled ? "" : "（停用）"}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-2">
            <Input name="floorNo" inputMode="numeric" placeholder="楼层（可空）" defaultValue={floorNoParam ?? ""} />
          </div>

          <div className="md:col-span-2">
            <Select name="status" defaultValue={statusValue ?? ""}>
              <option value="">全部状态</option>
              {["pending", "approved", "rejected", "cancelled"].map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
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

          <div className="md:col-span-3">
            <Input name="q" placeholder="申请人姓名/学号…" defaultValue={q} />
          </div>

          <div className="md:col-span-4">
            <Select name="roomId" defaultValue={roomId ?? ""} disabled={!buildingId}>
              <option value="">{buildingId ? "全部房间" : "先选择楼房"}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatFacilityFloorLabel(r.floorNo)} / {r.name}
                  {r.enabled ? "" : "（停用）"}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-4">
            <Input name="from" placeholder="from（可选，ISO 或 yyyy-mm-ddThh:mm）" defaultValue={fromRaw ?? ""} />
          </div>
          <div className="md:col-span-4">
            <Input name="to" placeholder="to（可选，ISO 或 yyyy-mm-ddThh:mm）" defaultValue={toRaw ?? ""} />
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-12">
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={basePath}>
              清空
            </Link>
            <button className={buttonVariants({ size: "sm" })} type="submit">
              应用
            </button>
          </div>
        </form>
      </ConsoleFiltersCard>

      <ConsoleDataTable
        headers={
          <tr>
            <th className="px-3 py-2">房间</th>
            <th className="px-3 py-2">申请人</th>
            <th className="px-3 py-2">时间段</th>
            <th className="px-3 py-2">用途</th>
            <th className="px-3 py-2 text-right">参与人数</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2 text-right">操作</th>
          </tr>
        }
        rowCount={data.items.length}
        emptyColSpan={7}
        emptyText="暂无预约"
      >
        {data.items.map((item) => (
          <tr key={item.id} className="border-t border-border">
            <td className="px-3 py-3">
              <div className="text-sm font-medium">
                {item.building.name} / {formatFacilityFloorLabel(item.room.floorNo)} / {item.room.name}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{item.room.id}</div>
            </td>
            <td className="px-3 py-3">
              <div className="text-sm font-medium">{item.applicant.name}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{item.applicant.studentId}</div>
            </td>
            <td className="px-3 py-3 text-xs text-muted-foreground">
              <div>
                {formatZhDateTime(item.startAt)} - {formatZhDateTime(item.endAt)}
              </div>
              <div className="mt-1">提交：{formatZhDateTime(item.createdAt)}</div>
            </td>
            <td className="px-3 py-3">
              <div className="line-clamp-2 text-sm">{item.purpose}</div>
              {item.review.rejectReason ? <div className="mt-1 text-xs text-rose-700">驳回：{item.review.rejectReason}</div> : null}
              {item.cancel.reason ? <div className="mt-1 text-xs text-muted-foreground">取消：{item.cancel.reason}</div> : null}
            </td>
            <td className="px-3 py-3 text-right tabular-nums">{item.participantCount}</td>
            <td className="px-3 py-3">
              <Badge variant="secondary">{statusLabel(item.status)}</Badge>
            </td>
            <td className="px-3 py-3 text-right">
              <ConsoleReservationActions reservationId={item.id} status={item.status} />
            </td>
          </tr>
        ))}
      </ConsoleDataTable>

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) =>
          buildHref(basePath, {
            status: statusValue,
            buildingId,
            floorNo: floorNoParam,
            roomId,
            q,
            from: fromRaw,
            to: toRaw,
            page: nextPage,
            pageSize,
          })
        }
      />
    </ConsolePage>
  );
}
