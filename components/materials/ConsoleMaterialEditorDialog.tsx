"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { ConsoleDeleteDialog } from "@/components/console/crud/ConsoleDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { fetchMaterialScopeOptions } from "@/lib/api/console-materials";
import { cn } from "@/lib/utils";

import { ConsoleMaterialEditorFormFields } from "./ConsoleMaterialEditorFormFields";
import { useConsoleMaterialEditor, type ConsoleMaterialEditorPerms } from "./useConsoleMaterialEditor";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  materialId?: string;
  createNoticeId?: string;
  createNoticeIdLocked?: boolean;
  currentUserId: string;
  perms: ConsoleMaterialEditorPerms;
  onRequestClose: () => void;
  onCreated: (materialId: string) => void;
};

function statusLabel(status: string) {
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

export function ConsoleMaterialEditorDialog(props: Props) {
  const router = useRouter();
  const editor = useConsoleMaterialEditor({
    open: props.open,
    mode: props.mode,
    materialId: props.materialId,
    createNoticeId: props.createNoticeId,
    createNoticeIdLocked: props.createNoticeIdLocked,
    currentUserId: props.currentUserId,
    perms: props.perms,
  });

  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);
  const [archiveAlertOpen, setArchiveAlertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const scopeOptionsQuery = useVisibilityScopeOptions(fetchMaterialScopeOptions, { enabled: props.open && !editor.visibleAll && !editor.linkedToNotice });

  function requestClose() {
    if (editor.dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  const titleNode =
    props.mode === "create" ? (
      "新建材料收集任务"
    ) : (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>材料收集任务</span>
        <Badge variant="secondary">状态：{statusLabel(editor.status)}</Badge>
        {editor.archivedAt ? <Badge variant="secondary">已归档</Badge> : null}
        {!editor.editableStructure ? <Badge variant="secondary">结构只读</Badge> : null}
        {!editor.canOperate ? <Badge variant="outline">仅可查看</Badge> : null}
      </span>
    );

  const submissionsHref = editor.effectiveMaterialId ? `/console/materials/${editor.effectiveMaterialId}/submissions` : "/console/materials";

  const footer =
    props.mode === "create" ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={editor.action.pending} onClick={() => requestClose()}>
          取消
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            disabled={editor.action.pending || !props.perms.canCreate}
            onClick={async () => {
              const createdId = await editor.createDraft();
              if (!createdId) return;
              props.onCreated(createdId);
              router.refresh();
            }}
          >
            {editor.action.pending ? "处理中..." : "创建草稿"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={editor.action.pending} onClick={() => requestClose()}>
          取消
        </Button>

        {props.perms.canProcess ? (
          <Link className={buttonVariants({ variant: "outline" })} href={submissionsHref}>
            提交管理
          </Link>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editor.status === "draft" && props.perms.canPublish && editor.canOperate && !editor.archivedAt ? (
            <Button
              size="sm"
              disabled={editor.action.pending}
              onClick={async () => {
                const res = await editor.publish();
                if (!res) return;
                router.refresh();
              }}
            >
              发布
            </Button>
          ) : null}

          {editor.status === "published" && props.perms.canClose && editor.canOperate && !editor.archivedAt ? (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending}
              onClick={async () => {
                const res = await editor.closeMaterial();
                if (!res) return;
                router.refresh();
              }}
            >
              关闭
            </Button>
          ) : null}

          {editor.status === "closed" && props.perms.canArchive && editor.canOperate && !editor.archivedAt ? (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending}
              onClick={() => {
                editor.action.reset();
                setArchiveAlertOpen(true);
              }}
            >
              归档
            </Button>
          ) : null}

          {editor.status === "draft" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending || !editor.editableStructure}
              onClick={async () => {
                const res = await editor.saveDraft();
                if (!res) return;
                router.refresh();
              }}
            >
              {editor.action.pending ? "处理中..." : "保存草稿"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending || !editor.canOperate || !props.perms.canUpdate || !!editor.archivedAt}
              onClick={async () => {
                const res = await editor.updateDueAtOnly();
                if (!res) return;
                router.refresh();
              }}
            >
              {editor.action.pending ? "处理中..." : "更新截止时间"}
            </Button>
          )}

          {props.perms.canDelete && editor.canOperate ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={editor.action.pending}
              onClick={() => {
                editor.action.reset();
                setDeleteOpen(true);
              }}
            >
              删除
            </Button>
          ) : null}
        </div>
      </div>
    );

  const canUploadTemplate = useMemo(() => {
    if (props.mode !== "edit") return false;
    if (!props.perms.canUpdate) return false;
    if (!editor.canOperate) return false;
    if (editor.archivedAt) return false;
    if (editor.status === "closed") return false;
    return true;
  }, [editor.archivedAt, editor.canOperate, editor.status, props.mode, props.perms.canUpdate]);

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        title={titleNode}
        description={props.mode === "create" ? "草稿可编辑材料项与模板；发布后锁定结构（可改截止）。" : editor.title || editor.effectiveMaterialId}
        error={editor.detailError ?? editor.action.error}
        contentClassName={cn("max-w-5xl", props.mode === "edit" ? "max-w-6xl" : null)}
        footer={footer}
      >
        {props.mode === "edit" ? (
          editor.loading ? (
            <DialogLoadingSkeleton rows={8} />
          ) : editor.detailError ? null : (
            <ConsoleMaterialEditorFormFields
              mode="edit"
              status={editor.status}
              archivedAt={editor.archivedAt}
              canOperate={editor.canOperate}
              editableStructure={editor.editableStructure}
              formDisabled={editor.formDisabled}
              title={editor.title}
              setTitle={editor.setTitle}
              descriptionMd={editor.descriptionMd}
              setDescriptionMd={editor.setDescriptionMd}
              noticeId={editor.noticeId}
              setNoticeId={editor.setNoticeId}
              noticeIdLocked={editor.noticeIdLocked}
              linkedNotice={editor.linkedNotice}
              visibleAll={editor.visibleAll}
              setVisibleAll={editor.setVisibleAll}
              linkedToNotice={editor.linkedToNotice}
              selected={editor.selected}
              setSelected={editor.setSelected}
              scopeOptions={scopeOptionsQuery.options}
              scopeError={scopeOptionsQuery.error}
              maxFilesPerSubmission={editor.maxFilesPerSubmission}
              setMaxFilesPerSubmission={editor.setMaxFilesPerSubmission}
              dueAtLocal={editor.dueAtLocal}
              setDueAtLocal={editor.setDueAtLocal}
              items={editor.items}
              setItems={editor.setItems}
              onAddItem={() => editor.addItem()}
              onUploadTemplate={async (itemId, file) => {
                await editor.uploadTemplate(itemId, file);
                router.refresh();
              }}
              canUploadTemplate={canUploadTemplate}
            />
          )
        ) : (
          <ConsoleMaterialEditorFormFields
            mode="create"
            status={editor.status}
            archivedAt={editor.archivedAt}
            canOperate={editor.canOperate}
            editableStructure={true}
            formDisabled={editor.formDisabled}
            title={editor.title}
            setTitle={editor.setTitle}
            descriptionMd={editor.descriptionMd}
            setDescriptionMd={editor.setDescriptionMd}
            noticeId={editor.noticeId}
            setNoticeId={editor.setNoticeId}
            noticeIdLocked={editor.noticeIdLocked}
            linkedNotice={editor.linkedNotice}
            visibleAll={editor.visibleAll}
            setVisibleAll={editor.setVisibleAll}
            linkedToNotice={editor.linkedToNotice}
            selected={editor.selected}
            setSelected={editor.setSelected}
            scopeOptions={scopeOptionsQuery.options}
            scopeError={scopeOptionsQuery.error}
            maxFilesPerSubmission={editor.maxFilesPerSubmission}
            setMaxFilesPerSubmission={editor.setMaxFilesPerSubmission}
            dueAtLocal={editor.dueAtLocal}
            setDueAtLocal={editor.setDueAtLocal}
            items={editor.items}
            setItems={editor.setItems}
            onAddItem={() => editor.addItem()}
            onUploadTemplate={async () => {}}
            canUploadTemplate={false}
          />
        )}
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
        open={archiveAlertOpen}
        onOpenChange={setArchiveAlertOpen}
        title="确认归档该任务？"
        description="归档后将从学生端隐藏，并对提交做归档标记。"
        confirmText="确认归档"
        onConfirm={async () => {
          setArchiveAlertOpen(false);
          const res = await editor.archive();
          if (!res) return;
          router.refresh();
        }}
      />

      <ConsoleDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open) editor.action.reset();
          setDeleteOpen(open);
        }}
        title={editor.title.trim() ? `删除任务：${editor.title.trim()}` : "删除材料收集任务"}
        description="删除为软删：将从列表隐藏；提交与文件不会物理删除；此操作不可恢复。"
        pending={editor.action.pending}
        error={editor.action.error}
        confirmText="确认删除"
        onConfirm={async ({ reason }) => {
          const res = await editor.submitDelete(reason);
          if (!res) return;
          setDeleteOpen(false);
          props.onRequestClose();
          router.refresh();
        }}
      />
    </>
  );
}
