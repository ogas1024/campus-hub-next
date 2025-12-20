"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConsoleDataTable } from "@/components/console/crud/ConsoleDataTable";
import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/Pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { batchProcessMaterialSubmissions, buildConsoleMaterialExportUrl } from "@/lib/api/console-materials";
import type { ConsoleMaterialSubmissionsResponse, MaterialSubmissionStatus } from "@/lib/api/console-materials";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type Props = {
  materialId: string;
  materialTitle: string;
  currentUserId: string;
  canOperate: boolean;
  canExport: boolean;
  deptOptions: Array<{ id: string; label: string }>;
  filters: {
    q: string;
    status: string;
    missingRequired: string;
    from: string;
    to: string;
    departmentId: string;
    page: number;
    pageSize: number;
    totalPages: number;
    total: number;
  };
  initialData: ConsoleMaterialSubmissionsResponse;
};

function statusLabel(status: MaterialSubmissionStatus) {
  switch (status) {
    case "pending":
      return "待处理";
    case "complete":
      return "已收齐";
    case "need_more":
      return "需补";
    case "approved":
      return "通过";
    case "rejected":
      return "驳回";
    default:
      return status;
  }
}

function statusBadgeVariant(status: MaterialSubmissionStatus) {
  switch (status) {
    case "approved":
      return "secondary" as const;
    case "rejected":
      return "outline" as const;
    case "need_more":
      return "outline" as const;
    case "complete":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    return d;
  }
  return null;
}

function buildConsoleMaterialSubmissionsHref(materialId: string, params: {
  q?: string;
  status?: string;
  missingRequired?: string;
  from?: string;
  to?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.missingRequired) sp.set("missingRequired", params.missingRequired);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/console/materials/${materialId}/submissions?${query}` : `/console/materials/${materialId}/submissions`;
}

export function ConsoleMaterialSubmissionsClient(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [includeUnsubmitted, setIncludeUnsubmitted] = useState(false);

  const [nextStatus, setNextStatus] = useState<MaterialSubmissionStatus>("pending");
  const [studentMessage, setStudentMessage] = useState("");
  const [staffNote, setStaffNote] = useState("");

  const allIdsOnPage = useMemo(() => props.initialData.items.map((i) => i.id), [props.initialData.items]);
  const selectedCount = selectedIds.size;

  const exportUrl = useMemo(() => {
    return buildConsoleMaterialExportUrl(props.materialId, {
      q: props.filters.q.trim() ? props.filters.q.trim() : undefined,
      status: (props.filters.status as MaterialSubmissionStatus) || undefined,
      missingRequired: props.filters.missingRequired === "true" ? true : props.filters.missingRequired === "false" ? false : undefined,
      from: props.filters.from || undefined,
      to: props.filters.to || undefined,
      departmentId: props.filters.departmentId || undefined,
      includeUnsubmitted,
    });
  }, [props.materialId, props.filters, includeUnsubmitted]);

  const canBatch = props.canOperate && selectedCount > 0;

  async function runBatch(body: Parameters<typeof batchProcessMaterialSubmissions>[1]) {
    const res = await action.run(() => batchProcessMaterialSubmissions(props.materialId, body), { fallbackErrorMessage: "操作失败" });
    if (!res) return;
    setSelectedIds(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">提交管理</h1>
          <div className="text-sm text-muted-foreground">
            任务：<span className="font-medium text-foreground">{props.materialTitle}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            共 {props.filters.total} 条 · 第 {props.filters.page} / {props.filters.totalPages} 页
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${props.materialId}/edit`}>
            ← 返回任务
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/materials">
            返回列表
          </Link>
        </div>
      </div>

      {!props.canOperate ? (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
          只读模式：仅任务创建者或拥有“全量管理”权限的用户可批量处理与导出。
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium">导出 ZIP</div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Checkbox checked={includeUnsubmitted} disabled={!props.canExport} onCheckedChange={(v) => setIncludeUnsubmitted(v === true)} />
          包含未提交（默认仅已提交）
        </label>
        {props.canExport ? (
          <a className={buttonVariants({ size: "sm" })} href={exportUrl}>
            下载 ZIP
          </a>
        ) : (
          <span className={cn(buttonVariants({ size: "sm" }), "pointer-events-none opacity-50")}>下载 ZIP</span>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4" action={`/console/materials/${props.materialId}/submissions`} method="GET">
        <input type="hidden" name="page" value="1" />

        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">学号/姓名</label>
          <Input name="q" uiSize="sm" className="w-56" placeholder="学号或姓名…" defaultValue={props.filters.q} />
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">状态</label>
          <Select name="status" defaultValue={props.filters.status} uiSize="sm" className="w-32">
            <option value="">全部</option>
            <option value="pending">待处理</option>
            <option value="complete">已收齐</option>
            <option value="need_more">需补</option>
            <option value="approved">通过</option>
            <option value="rejected">驳回</option>
          </Select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">缺材料</label>
          <Select name="missingRequired" defaultValue={props.filters.missingRequired} uiSize="sm" className="w-24">
            <option value="">全部</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </Select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">提交时间（从）</label>
          <Input name="from" uiSize="sm" type="datetime-local" defaultValue={props.filters.from} />
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">提交时间（到）</label>
          <Input name="to" uiSize="sm" type="datetime-local" defaultValue={props.filters.to} />
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">部门（含子部门）</label>
          <Select name="departmentId" defaultValue={props.filters.departmentId} uiSize="sm" className="w-56">
            <option value="">全部</option>
            {props.deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">每页</label>
          <Select name="pageSize" defaultValue={String(props.filters.pageSize)} uiSize="sm" className="w-24">
            {[10, 20, 50].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${props.materialId}/submissions`}>
            清空
          </Link>
          <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
            应用
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">批量处理</div>
          <div className="text-sm text-muted-foreground">已选 {selectedCount} 条</div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!props.canOperate || action.pending || selectedCount === 0}
            onClick={() => void runBatch({ submissionIds: [...selectedIds], action: "assignToMe" })}
          >
            分配给我
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!props.canOperate || action.pending || selectedCount === 0}
            onClick={() => void runBatch({ submissionIds: [...selectedIds], action: "unassign" })}
          >
            取消分配
          </Button>

          <div className="ml-auto" />

          <Select value={nextStatus} disabled={!props.canOperate || action.pending} onChange={(e) => setNextStatus(e.target.value as MaterialSubmissionStatus)} uiSize="sm" className="w-28">
            <option value="pending">待处理</option>
            <option value="complete">已收齐</option>
            <option value="need_more">需补</option>
            <option value="approved">通过</option>
            <option value="rejected">驳回</option>
          </Select>
          <Input
            uiSize="sm"
            className="w-64"
            placeholder="给学生的原因/说明（需补/驳回必填）"
            value={studentMessage}
            disabled={!props.canOperate || action.pending}
            onChange={(e) => setStudentMessage(e.target.value)}
          />
          <Input
            uiSize="sm"
            className="w-56"
            placeholder="内部备注（可选）"
            value={staffNote}
            disabled={!props.canOperate || action.pending}
            onChange={(e) => setStaffNote(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!canBatch || action.pending}
            onClick={() =>
              void runBatch({
                submissionIds: [...selectedIds],
                action: "setStatus",
                status: nextStatus,
                studentMessage: studentMessage.trim() ? studentMessage.trim() : null,
                staffNote: staffNote.trim() ? staffNote.trim() : null,
              })
            }
          >
            设置状态
          </Button>
        </div>

        <InlineError message={action.error} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={allIdsOnPage.length === 0}
            onClick={() => setSelectedIds(new Set(allIdsOnPage))}
          >
            全选本页
          </Button>
          <Button size="sm" variant="outline" disabled={selectedCount === 0} onClick={() => setSelectedIds(new Set())}>
            清空选择
          </Button>
        </div>
      </div>

      <ConsoleDataTable
        headers={
          <tr>
            <th className="w-10 px-3 py-2">
              <Checkbox
                checked={allIdsOnPage.length > 0 && selectedCount === allIdsOnPage.length}
                onCheckedChange={(v) => {
                  if (v === true) setSelectedIds(new Set(allIdsOnPage));
                  else setSelectedIds(new Set());
                }}
              />
            </th>
            <th className="px-3 py-2">学号</th>
            <th className="px-3 py-2">姓名</th>
            <th className="px-3 py-2">部门</th>
            <th className="px-3 py-2">提交时间</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2">缺材料</th>
            <th className="px-3 py-2">经办</th>
            <th className="px-3 py-2">操作</th>
          </tr>
        }
        rowCount={props.initialData.items.length}
        emptyText="暂无提交"
        emptyColSpan={9}
      >
        {props.initialData.items.map((s) => {
          const submittedAt = toDate(s.submittedAt);
          const assignee =
            s.assigneeUserId === props.currentUserId ? "我" : s.assigneeUserId ? "已分配" : "—";
          return (
            <tr key={s.id} className="border-t border-border">
              <td className="px-3 py-2">
                <Checkbox
                  checked={selectedIds.has(s.id)}
                  onCheckedChange={(v) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (v === true) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    });
                  }}
                />
              </td>
              <td className="px-3 py-2 font-mono text-xs">{s.studentId}</td>
              <td className="px-3 py-2">{s.name}</td>
              <td className="px-3 py-2">
                <span className="text-xs text-muted-foreground">{s.departments.join(" / ") || "—"}</span>
              </td>
              <td className="px-3 py-2">
                <span className="text-xs text-muted-foreground">{submittedAt ? formatZhDateTime(submittedAt) : "未提交"}</span>
              </td>
              <td className="px-3 py-2">
                <Badge variant={statusBadgeVariant(s.status)}>{statusLabel(s.status)}</Badge>
              </td>
              <td className="px-3 py-2">{s.missingRequired ? <Badge variant="outline">是</Badge> : <span className="text-xs text-muted-foreground">否</span>}</td>
              <td className="px-3 py-2">
                <span className="text-xs text-muted-foreground">{assignee}</span>
              </td>
              <td className="px-3 py-2">
                {props.canOperate ? (
                  <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/console/materials/${props.materialId}/submissions/${s.id}`}>
                    详情
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </ConsoleDataTable>

      {props.filters.total > 0 ? (
        <Pagination
          page={props.filters.page}
          totalPages={props.filters.totalPages}
          hrefForPage={(page) =>
            buildConsoleMaterialSubmissionsHref(props.materialId, {
              q: props.filters.q,
              status: props.filters.status,
              missingRequired: props.filters.missingRequired,
              from: props.filters.from,
              to: props.filters.to,
              departmentId: props.filters.departmentId,
              page,
              pageSize: props.filters.pageSize,
            })
          }
        />
      ) : null}
    </div>
  );
}
