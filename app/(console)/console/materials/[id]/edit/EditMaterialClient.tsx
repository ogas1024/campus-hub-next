"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ConsoleDeleteDialog } from "@/components/console/crud/ConsoleDeleteDialog";
import { InlineError } from "@/components/common/InlineError";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { ApiResponseError } from "@/lib/api/http";
import {
  archiveConsoleMaterial,
  closeConsoleMaterial,
  deleteConsoleMaterial,
  fetchConsoleMaterialDetail,
  fetchMaterialScopeOptions,
  publishConsoleMaterial,
  updateConsoleMaterialDraft,
  updateConsoleMaterialDueAt,
  uploadMaterialItemTemplate,
} from "@/lib/api/console-materials";
import type { ConsoleMaterialDetail, MaterialItemInput, MaterialScopeInput } from "@/lib/api/console-materials";
import type { ScopeType } from "@/lib/api/surveys";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  materialId: string;
  currentUserId: string;
  perms: {
    canUpdate: boolean;
    canDelete: boolean;
    canPublish: boolean;
    canClose: boolean;
    canArchive: boolean;
    canProcess: boolean;
    canManageAll: boolean;
  };
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIso(value: string, name: string) {
  if (!value) throw new Error(`${name} 必填`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} 格式无效`);
  return date.toISOString();
}

function newId() {
  return crypto.randomUUID();
}

export default function EditMaterialClient(props: Props) {
  const id = props.materialId;
  const router = useRouter();
  const action = useAsyncAction();

  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [noticeId, setNoticeId] = useState<string | null>(null);
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState<Record<ScopeType, Set<string>>>({
    role: new Set(),
    department: new Set(),
    position: new Set(),
  });
  const [maxFilesPerSubmission, setMaxFilesPerSubmission] = useState(10);
  const [dueAtLocal, setDueAtLocal] = useState("");
  const [items, setItems] = useState<ConsoleMaterialDetail["items"]>([]);
  const [status, setStatus] = useState<"draft" | "published" | "closed">("draft");
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState<string>("");
  const [scopeOptions, setScopeOptions] = useState<Awaited<ReturnType<typeof fetchMaterialScopeOptions>> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const linkedToNotice = !!noticeId;
  const canOperate = props.perms.canManageAll || (!!createdBy && createdBy === props.currentUserId);
  const editableStructure = status === "draft" && props.perms.canUpdate && canOperate && !archivedAt;

  const departmentItems = useMemo(() => {
    if (!scopeOptions) return [];
    return scopeOptions.departments.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId ?? null,
      sort: 0,
    }));
  }, [scopeOptions]);

  const scopes = useMemo(() => {
    const out: MaterialScopeInput[] = [];
    for (const refId of selected.role) out.push({ scopeType: "role", refId });
    for (const refId of selected.department) out.push({ scopeType: "department", refId });
    for (const refId of selected.position) out.push({ scopeType: "position", refId });
    return out;
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setDetailError(null);
      try {
        const [detail, options] = await Promise.all([
          fetchConsoleMaterialDetail(id),
          fetchMaterialScopeOptions().catch(() => null),
        ]);
        if (cancelled) return;

        setTitle(detail.title);
        setDescriptionMd(detail.descriptionMd ?? "");
        setNoticeId(detail.noticeId ?? null);
        setVisibleAll(!!detail.visibleAll);
        setMaxFilesPerSubmission(detail.maxFilesPerSubmission);
        setDueAtLocal(detail.dueAt ? toLocalInputValue(detail.dueAt) : "");
        setItems(detail.items);
        setStatus(detail.status);
        setArchivedAt(detail.archivedAt ?? null);
        setCreatedBy(detail.createdBy);

        const nextSelected: Record<ScopeType, Set<string>> = {
          role: new Set(),
          department: new Set(),
          position: new Set(),
        };
        for (const s of detail.scopes ?? []) nextSelected[s.scopeType].add(s.refId);
        setSelected(nextSelected);

        if (options) setScopeOptions(options);
      } catch (err) {
        if (cancelled) return;
        setDetailError(err instanceof ApiResponseError ? err.message : "加载失败");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function applyDetail(detail: ConsoleMaterialDetail) {
    setTitle(detail.title);
    setDescriptionMd(detail.descriptionMd ?? "");
    setNoticeId(detail.noticeId ?? null);
    setVisibleAll(!!detail.visibleAll);
    setMaxFilesPerSubmission(detail.maxFilesPerSubmission);
    setDueAtLocal(detail.dueAt ? toLocalInputValue(detail.dueAt) : "");
    setItems(detail.items);
    setStatus(detail.status);
    setArchivedAt(detail.archivedAt ?? null);
    setCreatedBy(detail.createdBy);

    const nextSelected: Record<ScopeType, Set<string>> = {
      role: new Set(),
      department: new Set(),
      position: new Set(),
    };
    for (const s of detail.scopes ?? []) nextSelected[s.scopeType].add(s.refId);
    setSelected(nextSelected);
  }

  async function saveDraft() {
    action.reset();
    try {
      const normalizedItems: MaterialItemInput[] = items
        .map((i, idx) => ({
          id: i.id,
          title: i.title.trim(),
          description: i.description?.trim() ? i.description.trim() : null,
          required: i.required,
          sort: idx,
        }))
        .filter((i) => i.title);

      const res = await action.run(
        () =>
          updateConsoleMaterialDraft(id, {
            title,
            descriptionMd,
            noticeId: linkedToNotice ? noticeId : null,
            visibleAll: linkedToNotice ? true : visibleAll,
            scopes: linkedToNotice ? [] : scopes,
            maxFilesPerSubmission,
            dueAt: dueAtLocal ? toIso(dueAtLocal, "截止时间") : null,
            items: normalizedItems,
          }),
        { fallbackErrorMessage: "保存失败" },
      );
      if (!res) return;
      applyDetail(res);
      router.refresh();
    } catch (err) {
      action.setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function saveDueAtOnly() {
    action.reset();
    try {
      const iso = toIso(dueAtLocal, "截止时间");
      const res = await action.run(() => updateConsoleMaterialDueAt(id, iso), { fallbackErrorMessage: "更新截止时间失败" });
      if (!res) return;
      applyDetail(res);
      router.refresh();
    } catch (err) {
      action.setError(err instanceof Error ? err.message : "更新截止时间失败");
    }
  }

  async function doPublish() {
    const res = await action.run(() => publishConsoleMaterial(id), { fallbackErrorMessage: "发布失败" });
    if (!res) return;
    applyDetail(res);
    router.refresh();
  }

  async function doClose() {
    const res = await action.run(() => closeConsoleMaterial(id), { fallbackErrorMessage: "关闭失败" });
    if (!res) return;
    applyDetail(res);
    router.refresh();
  }

  async function doArchive() {
    const res = await action.run(() => archiveConsoleMaterial(id), { fallbackErrorMessage: "归档失败" });
    if (!res) return;
    applyDetail(res);
    router.refresh();
  }

  async function submitDelete(reason?: string) {
    if (!props.perms.canDelete || !canOperate) return;
    const res = await action.run(() => deleteConsoleMaterial(id, { reason }), { fallbackErrorMessage: "删除失败" });
    if (!res) return;

    setDeleteOpen(false);
    router.push("/console/materials");
    router.refresh();
  }

  if (loading) return <div className="text-sm text-muted-foreground">加载中...</div>;
  if (detailError) {
    return (
      <div className="space-y-3">
        <InlineError message={detailError} />
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/materials">
          返回列表
        </Link>
      </div>
    );
  }

  const statusLabel = status === "draft" ? "草稿" : status === "published" ? "已发布" : "已关闭";
  const scopeDisabled = linkedToNotice || !editableStructure;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">材料收集任务</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={status === "draft" ? "secondary" : "outline"}>状态：{statusLabel}</Badge>
            {archivedAt ? <Badge variant="secondary">已归档</Badge> : null}
            {!editableStructure ? <Badge variant="secondary">结构只读</Badge> : null}
            {!canOperate ? <Badge variant="outline">仅可查看</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/materials">
            ← 返回列表
          </Link>
          {props.perms.canProcess ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${id}/submissions`}>
              提交管理
            </Link>
          ) : null}

          {status === "draft" && props.perms.canPublish && canOperate ? (
            <Button size="sm" disabled={action.pending} onClick={() => void doPublish()}>
              发布
            </Button>
          ) : null}

          {status === "published" && props.perms.canClose && canOperate ? (
            <Button size="sm" variant="outline" disabled={action.pending} onClick={() => void doClose()}>
              关闭
            </Button>
          ) : null}

          {status === "closed" && props.perms.canArchive && canOperate ? (
            <Button
              size="sm"
              variant="outline"
              disabled={action.pending}
              onClick={() => {
                if (!confirm("确认归档该任务？归档后将从学生端隐藏，并对提交做归档标记。")) return;
                void doArchive();
              }}
            >
              归档
            </Button>
          ) : null}

          {props.perms.canDelete && canOperate ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={action.pending}
              onClick={() => {
                action.reset();
                setDeleteOpen(true);
              }}
            >
              删除
            </Button>
          ) : null}
        </div>
      </div>

      <ConsoleDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open) action.reset();
          setDeleteOpen(open);
        }}
        title={title.trim() ? `删除任务：${title.trim()}` : "删除材料收集任务"}
        description="删除为软删：将从列表隐藏；提交与文件不会物理删除；此操作不可恢复。"
        pending={action.pending}
        error={action.error}
        confirmText="确认删除"
        onConfirm={({ reason }) => void submitDelete(reason)}
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-1.5">
            <Label>标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={!editableStructure} />
          </div>

          <div className="grid gap-1.5">
            <Label>关联公告（可选）</Label>
            <Input
              value={noticeId ?? ""}
              onChange={(e) => setNoticeId(e.target.value.trim() ? e.target.value : null)}
              placeholder="填写公告 ID（UUID）"
              disabled={!editableStructure}
            />
            {linkedToNotice ? (
              <div className="text-xs text-muted-foreground">
                已关联公告：可见范围继承公告设置。
                <Link className="ml-2 underline underline-offset-2 hover:text-foreground" href={`/console/notices/${noticeId}/edit`}>
                  打开公告
                </Link>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>截止时间</Label>
              <Input type="datetime-local" value={dueAtLocal} onChange={(e) => setDueAtLocal(e.target.value)} disabled={!canOperate || !props.perms.canUpdate || !!archivedAt} />
              {status !== "draft" ? <div className="text-xs text-muted-foreground">发布后仅支持修改截止时间（结构锁定）。</div> : null}
            </div>
            <div className="grid gap-1.5">
              <Label>每次提交最多文件数</Label>
              <Select
                value={String(maxFilesPerSubmission)}
                disabled={!editableStructure}
                onChange={(e) => setMaxFilesPerSubmission(Number(e.target.value))}
              >
                {[5, 10, 20, 30, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} 个
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Checkbox id="visibleAll" checked={visibleAll} disabled={scopeDisabled} onCheckedChange={(v) => setVisibleAll(v === true)} />
            <Label htmlFor="visibleAll" className="text-sm font-normal">
              全员可见
            </Label>
            {!visibleAll && !linkedToNotice ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见）</span> : null}
          </div>

          {!visibleAll && !linkedToNotice ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
              <div className="text-sm font-medium">可见范围</div>
              {!scopeOptions ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">角色</div>
                    <ScrollArea className="h-56 rounded-md border border-border bg-background">
                      <div className="space-y-1 p-2">
                        {scopeOptions.roles.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selected.role.has(r.id)}
                              disabled={scopeDisabled}
                              onCheckedChange={(v) => {
                                setSelected((prev) => {
                                  const next = { ...prev, role: new Set(prev.role) };
                                  if (v === true) next.role.add(r.id);
                                  else next.role.delete(r.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="truncate">{r.name}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">部门</div>
                    {departmentItems.length === 0 ? (
                      <div className="text-sm text-muted-foreground">暂无部门</div>
                    ) : (
                      <DepartmentTreeSelector
                        departments={departmentItems}
                        value={[...selected.department]}
                        disabled={scopeDisabled}
                        onChange={(nextIds) => {
                          setSelected((prev) => ({ ...prev, department: new Set(nextIds) }));
                        }}
                        maxHeight={224}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">岗位</div>
                    {scopeOptions.positions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">暂无岗位</div>
                    ) : (
                      <ScrollArea className="h-56 rounded-md border border-border bg-background">
                        <div className="space-y-1 p-2">
                          {scopeOptions.positions.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={selected.position.has(p.id)}
                                disabled={scopeDisabled}
                                onCheckedChange={(v) => {
                                  setSelected((prev) => {
                                    const next = { ...prev, position: new Set(prev.position) };
                                    if (v === true) next.position.add(p.id);
                                    else next.position.delete(p.id);
                                    return next;
                                  });
                                }}
                              />
                              <span className="truncate">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>说明（可选）</Label>
            <div className="rounded-lg border border-input">
              <NoticeEditor value={descriptionMd} onChange={setDescriptionMd} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium">材料项</div>
              <Button
                size="sm"
                variant="outline"
                disabled={!editableStructure}
                onClick={() => setItems((prev) => [...prev, { id: newId(), title: `材料 ${prev.length + 1}`, description: null, required: false, sort: prev.length, template: null }])}
              >
                添加材料项
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid gap-1.5">
                        <Label>标题</Label>
                        <Input
                          value={it.title}
                          disabled={!editableStructure}
                          onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
                          maxLength={200}
                          required
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <Label>说明（可选）</Label>
                        <Input
                          value={it.description ?? ""}
                          disabled={!editableStructure}
                          onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x)))}
                          maxLength={2000}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`${it.id}-required`}
                          checked={it.required}
                          disabled={!editableStructure}
                          onCheckedChange={(v) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, required: v === true } : x)))}
                        />
                        <Label htmlFor={`${it.id}-required`} className="text-sm font-normal">
                          必交
                        </Label>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground">模板</div>
                        {it.template ? (
                          <div className="text-sm">
                            <span className="font-medium">{it.template.fileName}</span>{" "}
                            <span className="text-xs text-muted-foreground">（{Math.ceil(it.template.size / 1024)} KB）</span>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">未上传</div>
                        )}

                        <Input
                          type="file"
                          disabled={!props.perms.canUpdate || !canOperate || !!archivedAt || status === "closed"}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const res = await action.run(() => uploadMaterialItemTemplate(id, it.id, file), { fallbackErrorMessage: "上传模板失败" });
                            if (!res) return;
                            applyDetail(res);
                            e.target.value = "";
                          }}
                        />
                        {status === "closed" ? <div className="text-xs text-muted-foreground">已关闭任务不允许上传模板。</div> : null}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!editableStructure || items.length <= 1}
                      onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id).map((x, i) => ({ ...x, sort: i })))}
                    >
                      移除
                    </Button>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">排序：{idx + 1}</div>
                </div>
              ))}
            </div>
          </div>

          <InlineError message={action.error} />

          <div className="flex flex-wrap items-center justify-end gap-3">
            {status === "draft" ? (
              <Button size="sm" disabled={action.pending || !editableStructure} onClick={() => void saveDraft()}>
                {action.pending ? "处理中..." : "保存草稿"}
              </Button>
            ) : (
              <Button size="sm" disabled={action.pending || !canOperate || !props.perms.canUpdate || !!archivedAt} onClick={() => void saveDueAtOnly()}>
                {action.pending ? "处理中..." : "更新截止时间"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
