"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { VisibilityScopeSelector } from "@/components/console/VisibilityScopeSelector";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";
import {
  createEmptySelectedScopes,
  selectedScopesFromInputs,
  selectedScopesToInputs,
} from "@/lib/ui/visibilityScope";
import {
  createConsoleNotice,
  deleteConsoleNotice,
  fetchConsoleNoticeDetail,
  fetchConsoleNoticeMaterial,
  fetchNoticeScopeOptions,
  publishConsoleNotice,
  retractConsoleNotice,
  setConsoleNoticePinned,
  updateConsoleNotice,
  uploadConsoleNoticeAttachment,
} from "@/lib/api/notices";
import type { ConsoleNoticeDetail, NoticeAttachmentInput, NoticeScopeInput, NoticeStatus } from "@/lib/api/notices";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  noticeId?: string;
  currentUserId: string;
  perms: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canPin: boolean;
    canPublish: boolean;
    canManageAll: boolean;
    canAuditList: boolean;
  };
  onRequestClose: () => void;
  onCreated: (noticeId: string) => void;
};

type MaterialInfo = {
  perms: { canCreate: boolean; canRead: boolean; canProcess: boolean };
  linked: null | { id: string; title: string; status: "draft" | "published" | "closed"; dueAt: string | null; archivedAt: string | null };
};

type DraftSnapshot = {
  title: string;
  contentMd: string;
  expireAtLocal: string;
  visibleAll: boolean;
  scopes: NoticeScopeInput[];
  attachments: NoticeAttachmentInput[];
};

function toIsoOrUndefined(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function statusLabel(status: NoticeStatus) {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "retracted":
      return "已撤回";
    default:
      return status;
  }
}

function materialStatusLabel(status: NonNullable<MaterialInfo["linked"]>["status"]) {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "closed":
      return "已关闭";
    default:
      return status;
  }
}

function normalizeSnapshot(snapshot: DraftSnapshot) {
  const scopes = snapshot.scopes
    .slice()
    .sort((a, b) => `${a.scopeType}:${a.refId}`.localeCompare(`${b.scopeType}:${b.refId}`));

  const attachments = snapshot.attachments
    .slice()
    .sort((a, b) => `${a.sort}:${a.fileKey}`.localeCompare(`${b.sort}:${b.fileKey}`));

  return {
    title: snapshot.title,
    contentMd: snapshot.contentMd,
    expireAtLocal: snapshot.expireAtLocal,
    visibleAll: snapshot.visibleAll,
    scopes,
    attachments,
  };
}

function snapshotKey(snapshot: DraftSnapshot) {
  return JSON.stringify(normalizeSnapshot(snapshot));
}

export function ConsoleNoticeEditorDialog(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [loadedNoticeId, setLoadedNoticeId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [expireAtLocal, setExpireAtLocal] = useState("");
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState(createEmptySelectedScopes);
  const [attachments, setAttachments] = useState<NoticeAttachmentInput[]>([]);

  const [status, setStatus] = useState<NoticeStatus>("draft");
  const [pinned, setPinned] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [createdBy, setCreatedBy] = useState("");

  const [material, setMaterial] = useState<MaterialInfo | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);

  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<DraftSnapshot | null>(null);

  const canOperate = props.perms.canManageAll || (!!createdBy && createdBy === props.currentUserId);
  const effectiveNoticeId = props.mode === "edit" ? props.noticeId ?? null : null;
  const canEdit =
    props.mode === "create"
      ? props.perms.canCreate
      : props.perms.canUpdate && canOperate;

  const formDisabled =
    action.pending ||
    !canEdit ||
    (props.mode === "edit" && !!effectiveNoticeId && loadedNoticeId !== effectiveNoticeId);

  const scopeOptionsQuery = useVisibilityScopeOptions(fetchNoticeScopeOptions, { enabled: props.open && !visibleAll });

  const scopes = useMemo(() => selectedScopesToInputs(selected), [selected]);

  const currentSnapshot = useMemo<DraftSnapshot>(
    () => ({
      title,
      contentMd,
      expireAtLocal,
      visibleAll,
      scopes,
      attachments,
    }),
    [attachments, contentMd, expireAtLocal, scopes, title, visibleAll],
  );

  const dirty = useMemo(() => {
    if (!props.open) return false;
    if (!initialSnapshot) return false;
    return snapshotKey(currentSnapshot) !== snapshotKey(initialSnapshot);
  }, [currentSnapshot, initialSnapshot, props.open]);

  function resetCreate() {
    setLoadedNoticeId(null);
    setTitle("");
    setContentMd("");
    setExpireAtLocal("");
    setVisibleAll(true);
    setSelected(createEmptySelectedScopes());
    setAttachments([]);
    setStatus("draft");
    setPinned(false);
    setIsExpired(false);
    setCreatedBy("");
    setMaterial(null);
    setMaterialError(null);
    action.reset();
    setInitialSnapshot({
      title: "",
      contentMd: "",
      expireAtLocal: "",
      visibleAll: true,
      scopes: [],
      attachments: [],
    });
  }

  function applyDetail(detail: ConsoleNoticeDetail) {
    setTitle(detail.title);
    setContentMd(detail.contentMd);
    setExpireAtLocal(detail.expireAt ? new Date(detail.expireAt).toISOString().slice(0, 16) : "");
    setVisibleAll(!!detail.visibleAll);
    setSelected(selectedScopesFromInputs(detail.scopes));
    setAttachments(
      (detail.attachments ?? []).map((a) => ({
        fileKey: a.fileKey,
        fileName: a.fileName,
        contentType: a.contentType,
        size: a.size,
        sort: a.sort ?? 0,
      })),
    );
    setStatus(detail.status);
    setPinned(!!detail.pinned);
    setIsExpired(!!detail.isExpired);
    setCreatedBy(detail.createdBy);
    setInitialSnapshot({
      title: detail.title,
      contentMd: detail.contentMd,
      expireAtLocal: detail.expireAt ? new Date(detail.expireAt).toISOString().slice(0, 16) : "",
      visibleAll: !!detail.visibleAll,
      scopes: detail.scopes,
      attachments: (detail.attachments ?? []).map((a) => ({
        fileKey: a.fileKey,
        fileName: a.fileName,
        contentType: a.contentType,
        size: a.size,
        sort: a.sort ?? 0,
      })),
    });
  }

  async function loadDetail(id: string) {
    const detail = await action.run(() => fetchConsoleNoticeDetail(id), { fallbackErrorMessage: "加载失败" });
    if (!detail) return;
    applyDetail(detail);
    setLoadedNoticeId(detail.id);
  }

  async function loadMaterial(id: string) {
    setMaterialError(null);
    try {
      const res = await fetchConsoleNoticeMaterial(id);
      setMaterial(res);
    } catch {
      setMaterialError("加载材料关联失败");
    }
  }

  useEffect(() => {
    if (!props.open) return;
    if (props.mode === "create") {
      resetCreate();
      return;
    }
    if (!effectiveNoticeId) return;
    if (loadedNoticeId === effectiveNoticeId) return;
    void loadDetail(effectiveNoticeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.mode, effectiveNoticeId]);

  useEffect(() => {
    if (!props.open) return;
    if (!effectiveNoticeId) return;
    void loadMaterial(effectiveNoticeId);
  }, [props.open, effectiveNoticeId, status]);

  function requestClose() {
    if (action.pending) return;
    if (dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  function validateDraft() {
    const t = title.trim();
    if (!t) return "标题不能为空";
    if (!contentMd.trim()) return "正文不能为空";
    if (!visibleAll && scopes.length === 0) return "visibleAll=false 时必须至少配置 1 条可见范围";
    return null;
  }

  async function createDraft(): Promise<ConsoleNoticeDetail | null> {
    if (!props.perms.canCreate) {
      action.setError("你没有创建公告的权限");
      return null;
    }

    const validationError = validateDraft();
    if (validationError) {
      action.setError(validationError);
      return null;
    }

    const res = await action.run(
      () =>
        createConsoleNotice({
          title: title.trim(),
          contentMd,
          expireAt: toIsoOrUndefined(expireAtLocal),
          visibleAll,
          scopes,
          attachments,
        }),
      { fallbackErrorMessage: "创建失败" },
    );
    if (!res) return null;

    applyDetail(res);
    setLoadedNoticeId(res.id);
    props.onCreated(res.id);
    router.refresh();
    return res;
  }

  async function saveDraft() {
    const id = effectiveNoticeId ?? loadedNoticeId;
    if (!id) {
      await createDraft();
      return;
    }
    if (!canEdit) {
      action.setError("你没有编辑该公告的权限");
      return;
    }

    const validationError = validateDraft();
    if (validationError) {
      action.setError(validationError);
      return;
    }

    const updated = await action.run(
      () =>
        updateConsoleNotice(id, {
          title: title.trim(),
          contentMd,
          expireAt: toIsoOrUndefined(expireAtLocal),
          visibleAll,
          scopes,
          attachments,
        }),
      { fallbackErrorMessage: "保存失败" },
    );
    if (!updated) return;

    applyDetail(updated);
    setLoadedNoticeId(updated.id);
    router.refresh();
  }

  async function publish() {
    const id = effectiveNoticeId ?? loadedNoticeId;
    if (!props.perms.canPublish) {
      action.setError("你没有发布公告的权限");
      return;
    }

    if (!id) {
      const created = await createDraft();
      if (!created) return;
      const published = await action.run(() => publishConsoleNotice(created.id), { fallbackErrorMessage: "发布失败" });
      if (!published) return;
      setStatus(published.status);
      setPinned(!!published.pinned);
      setIsExpired(!!published.isExpired);
      router.refresh();
      return;
    }

    if (dirty) {
      await saveDraft();
    }

    const published = await action.run(() => publishConsoleNotice(id), { fallbackErrorMessage: "发布失败" });
    if (!published) return;
    setStatus(published.status);
    setPinned(!!published.pinned);
    setIsExpired(!!published.isExpired);
    router.refresh();
  }

  async function retract() {
    const id = effectiveNoticeId ?? loadedNoticeId;
    if (!id) return;
    const updated = await action.run(() => retractConsoleNotice(id), { fallbackErrorMessage: "撤回失败" });
    if (!updated) return;
    setStatus(updated.status);
    setPinned(!!updated.pinned);
    setIsExpired(!!updated.isExpired);
    router.refresh();
  }

  async function togglePinned() {
    const id = effectiveNoticeId ?? loadedNoticeId;
    if (!id) return;
    const updated = await action.run(() => setConsoleNoticePinned(id, !pinned), { fallbackErrorMessage: "置顶操作失败" });
    if (!updated) return;
    setStatus(updated.status);
    setPinned(!!updated.pinned);
    setIsExpired(!!updated.isExpired);
    router.refresh();
  }

  async function remove() {
    const id = effectiveNoticeId ?? loadedNoticeId;
    if (!id) return;
    const ok = await action.run(() => deleteConsoleNotice(id), { fallbackErrorMessage: "删除失败" });
    if (!ok) return;
    props.onRequestClose();
    router.refresh();
  }

  const titleText = props.mode === "create" ? "新建公告" : "公告详情";
  const descriptionText =
    props.mode === "create"
      ? "编辑为所见即所得；落库为 Markdown（保存时会校验不含内联 HTML）。"
      : `状态：${statusLabel(status)} · 置顶：${pinned ? "是" : "否"}`;

  const showEditExtras = !!(effectiveNoticeId ?? loadedNoticeId);
  const showPinButton = status === "published" && props.perms.canPin && canOperate;
  const showRetractButton = status === "published" && props.perms.canPublish && canOperate;
  const showPublishButton = status !== "published" && props.perms.canPublish && canOperate;

  const canUploadAttachment = showEditExtras && !formDisabled;

  const materialPerms = material?.perms ?? { canCreate: false, canRead: false, canProcess: false };
  const linkedMaterial = material?.linked ?? null;

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title={titleText}
        description={descriptionText}
        error={action.error}
        contentClassName="max-w-4xl"
        footer={
          <>
            <Button variant="outline" disabled={action.pending} onClick={() => requestClose()}>
              取消
            </Button>

            {showPinButton ? (
              <Button
                variant="outline"
                disabled={action.pending || isExpired}
                onClick={() => void togglePinned()}
                title={isExpired ? "已过期公告不允许置顶" : undefined}
              >
                {pinned ? "取消置顶" : "置顶"}
              </Button>
            ) : null}

            {showRetractButton ? (
              <Button variant="outline" disabled={action.pending} onClick={() => void retract()}>
                撤回
              </Button>
            ) : null}

            {showPublishButton ? (
            <Button variant="outline" disabled={action.pending} onClick={() => void publish()}>
                发布
            </Button>
            ) : null}

            <Button
              disabled={formDisabled}
              onClick={() => void saveDraft()}
            >
              {props.mode === "create" ? "保存为草稿" : "保存"}
            </Button>

            {props.mode === "edit" && props.perms.canDelete && canOperate ? (
              <Button variant="destructive" disabled={action.pending} onClick={() => setDeleteAlertOpen(true)}>
                删除
              </Button>
            ) : null}
          </>
        }
      >
        <div className="grid gap-1.5">
          <Label>标题</Label>
          <Input
            uiSize="sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            disabled={formDisabled}
          />
        </div>

        <div className="grid gap-1.5">
          <Label>有效期（可选）</Label>
          <Input
            uiSize="sm"
            type="datetime-local"
            value={expireAtLocal}
            onChange={(e) => setExpireAtLocal(e.target.value)}
            disabled={formDisabled}
          />
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="visibleAll"
            checked={visibleAll}
            disabled={formDisabled}
            onCheckedChange={(v) => setVisibleAll(v === true)}
          />
          <Label htmlFor="visibleAll" className="text-sm font-normal">
            全员可见
          </Label>
          {!visibleAll ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见）</span> : null}
        </div>

        {!visibleAll ? (
          <div className="space-y-2">
            <VisibilityScopeSelector
              options={scopeOptionsQuery.options}
              selected={selected}
              setSelected={setSelected}
              disabled={formDisabled}
            />
            {scopeOptionsQuery.error ? <div className="text-sm text-destructive">{scopeOptionsQuery.error}</div> : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>正文</Label>
          {canEdit ? (
            <div className={cn("rounded-lg border border-input", formDisabled ? "pointer-events-none opacity-60" : null)}>
              <NoticeEditor value={contentMd} onChange={setContentMd} />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-background p-4">
              <NoticeMarkdown contentMd={contentMd} />
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">附件</div>
            {!showEditExtras ? <div className="text-xs text-muted-foreground">创建后可上传</div> : null}
          </div>

          {showEditExtras ? (
            <>
              <Input
                type="file"
                disabled={!canUploadAttachment}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const id = effectiveNoticeId ?? loadedNoticeId;
                  if (!id) return;

                  const uploaded = await action.run(() => uploadConsoleNoticeAttachment(id, file), { fallbackErrorMessage: "上传失败" });
                  if (!uploaded) return;

                  setAttachments((prev) => [
                    ...prev,
                    {
                      fileKey: uploaded.fileKey,
                      fileName: uploaded.fileName,
                      contentType: uploaded.contentType,
                      size: uploaded.size,
                      sort: prev.length,
                    },
                  ]);
                  e.target.value = "";
                }}
              />

              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((a, idx) => (
                    <div
                      key={`${a.fileKey}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm">{a.fileName}</div>
                        <div className="text-xs text-muted-foreground">{Math.ceil(a.size / 1024)} KB</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canUploadAttachment}
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="h-8 px-2 text-xs"
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">暂无附件（上传后记得点击“保存”以写入数据库记录）</div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">当前为新建态，保存草稿后可上传附件。</div>
          )}
        </div>

        {showEditExtras ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">材料收集</div>
                <div className="text-xs text-muted-foreground">公告最多关联 1 个材料收集任务（学生端可从公告跳转提交）。</div>
              </div>
              {materialError ? <div className="text-xs text-destructive">{materialError}</div> : null}
              {linkedMaterial ? (
                <div className="text-xs text-muted-foreground">
                  状态：<span className="font-medium text-foreground">{materialStatusLabel(linkedMaterial.status)}</span>
                </div>
              ) : null}
            </div>

            {!materialPerms.canCreate && !materialPerms.canRead ? (
              <div className="text-sm text-muted-foreground">你没有材料收集模块权限。</div>
            ) : linkedMaterial ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">{linkedMaterial.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">ID：{linkedMaterial.id}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  截止：{formatZhDateTime(linkedMaterial.dueAt ? new Date(linkedMaterial.dueAt) : null)}
                  {linkedMaterial.archivedAt ? ` · 已归档：${formatZhDateTime(new Date(linkedMaterial.archivedAt))}` : ""}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/console/materials?dialog=material-edit&id=${encodeURIComponent(linkedMaterial.id)}`}
                  >
                    打开任务
                  </Link>
                  {materialPerms.canProcess ? (
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${linkedMaterial.id}/submissions`}>
                      提交管理
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">尚未关联材料收集任务。</div>
                {materialPerms.canCreate ? (
                  <Link
                    className={buttonVariants({ size: "sm" })}
                    href={`/console/materials?dialog=material-create&noticeId=${encodeURIComponent(effectiveNoticeId ?? loadedNoticeId ?? "")}`}
                  >
                    创建材料收集任务
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {props.perms.canAuditList && showEditExtras ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={`/console/audit?targetType=notice&targetId=${effectiveNoticeId ?? loadedNoticeId ?? ""}`}
              target="_blank"
            >
              查看审计
            </Link>
          </div>
        ) : null}
      </StickyFormDialog>

      <UnsavedChangesAlertDialog
        open={unsavedAlertOpen}
        onOpenChange={setUnsavedAlertOpen}
        onDiscard={() => {
          setUnsavedAlertOpen(false);
          props.onRequestClose();
        }}
      />

      <ConfirmAlertDialog
        open={deleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        title="确认删除该公告（软删）？"
        description="删除后对所有人不可见（保留审计记录）。"
        confirmText="删除"
        cancelText="取消"
        confirmDisabled={action.pending}
        onConfirm={() => void remove()}
      />
    </>
  );
}
