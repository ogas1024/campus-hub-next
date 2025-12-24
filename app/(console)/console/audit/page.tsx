import Link from "next/link";
import { redirect } from "next/navigation";

import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requirePerm } from "@/lib/auth/permissions";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { listAuditLogs } from "@/lib/modules/audit/audit.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseDateParam(value: string | undefined) {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
}

function buildAuditHref(params: {
  q?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  success?: boolean | null;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.action && params.action.trim()) sp.set("action", params.action.trim());
  if (params.targetType && params.targetType.trim()) sp.set("targetType", params.targetType.trim());
  if (params.targetId && params.targetId.trim()) sp.set("targetId", params.targetId.trim());
  if (params.actorUserId && params.actorUserId.trim()) sp.set("actorUserId", params.actorUserId.trim());
  if (typeof params.success === "boolean") sp.set("success", params.success ? "true" : "false");
  if (params.from && params.from.trim()) sp.set("from", params.from.trim());
  if (params.to && params.to.trim()) sp.set("to", params.to.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/console/audit?${query}` : "/console/audit";
}

export default async function ConsoleAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePerm("campus:audit:list");
  const sp = await searchParams;

  const q = pickString(sp.q) ?? "";
  const action = pickString(sp.action) ?? "";
  const targetType = pickString(sp.targetType) ?? "";
  const targetId = pickString(sp.targetId) ?? "";
  const actorUserId = pickString(sp.actorUserId) ?? "";
  const success = parseTriStateBooleanParam(pickString(sp.success) ?? null) ?? null;

  const from = pickString(sp.from);
  const to = pickString(sp.to);
  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to);

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const data = await listAuditLogs({
    page,
    pageSize,
    q: q.trim() ? q.trim() : undefined,
    action: action.trim() ? action.trim() : undefined,
    targetType: targetType.trim() ? targetType.trim() : undefined,
    targetId: targetId.trim() ? targetId.trim() : undefined,
    actorUserId: actorUserId.trim() ? actorUserId.trim() : undefined,
    success: typeof success === "boolean" ? success : undefined,
    from: fromDate,
    to: toDate,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(
      buildAuditHref({
        q,
        action,
        targetType,
        targetId,
        actorUserId,
        success,
        from,
        to,
        page: totalPages,
        pageSize,
      }),
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="审计日志"
        description="所有管理端写操作均应记录审计；此处用于检索与追溯。"
        meta={
          <span>
            共 {data.total} 条 · 第 {displayPage} / {totalPages} 页
          </span>
        }
      />

      <FiltersPanel>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="page" value="1" />

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">关键词</label>
            <Input
              name="q"
              uiSize="sm"
              className="w-56"
              placeholder="action/targetId/actorEmail"
              defaultValue={q}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">action</label>
            <Input
              name="action"
              uiSize="sm"
              className="w-44"
              defaultValue={action}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">targetType</label>
            <Input
              name="targetType"
              uiSize="sm"
              className="w-32"
              defaultValue={targetType}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">targetId</label>
            <Input
              name="targetId"
              uiSize="sm"
              className="w-44"
              defaultValue={targetId}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">actorUserId</label>
            <Input
              name="actorUserId"
              uiSize="sm"
              className="w-44"
              defaultValue={actorUserId}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">success</label>
            <Select
              name="success"
              defaultValue={typeof success === "boolean" ? (success ? "true" : "false") : ""}
              uiSize="sm"
              className="w-28"
            >
              <option value="">全部</option>
              <option value="true">成功</option>
              <option value="false">失败</option>
            </Select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">起始（ISO）</label>
            <Input
              name="from"
              uiSize="sm"
              className="w-44"
              placeholder="2025-12-17T00:00:00Z"
              defaultValue={from}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">结束（ISO）</label>
            <Input
              name="to"
              uiSize="sm"
              className="w-44"
              placeholder="2025-12-18T00:00:00Z"
              defaultValue={to}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">分页</label>
            <Select
              name="pageSize"
              defaultValue={String(pageSize)}
              uiSize="sm"
              className="w-28"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}/页
                </option>
              ))}
            </Select>
          </div>

          <Button size="sm" type="submit">
            筛选
          </Button>
        </form>
      </FiltersPanel>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">时间</th>
              <th className="px-3 py-2">操作者</th>
              <th className="px-3 py-2">action</th>
              <th className="px-3 py-2">target</th>
              <th className="px-3 py-2">结果</th>
              <th className="px-3 py-2 text-right">详情</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={6}>
                  暂无记录
                </td>
              </tr>
            ) : null}

            {data.items.map((it) => (
              <tr key={it.id} className="border-t border-border/50">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(it.occurredAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="text-sm text-foreground">{it.actorEmail ?? "—"}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{it.actorUserId}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-foreground">{it.action}</td>
                <td className="px-3 py-2">
                  <div className="text-sm text-foreground">{it.targetType}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{it.targetId}</div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      it.success
                        ? "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap"
                        : "rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive whitespace-nowrap"
                    }
                  >
                    {it.success ? "成功" : "失败"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/console/audit/${it.id}`}
                  >
                    查看
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) =>
          buildAuditHref({
            q,
            action,
            targetType,
            targetId,
            actorUserId,
            success,
            from,
            to,
            page: nextPage,
            pageSize,
          })
        }
      />
    </div>
  );
}
