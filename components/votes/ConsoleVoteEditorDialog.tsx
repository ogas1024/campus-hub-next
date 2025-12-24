"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { fetchVoteScopeOptions } from "@/lib/api/console-votes";
import { cn } from "@/lib/utils";

import { ConsoleVoteEditorFormFields } from "./ConsoleVoteEditorFormFields";
import { useConsoleVoteEditor, type ConsoleVoteEditorPerms } from "./useConsoleVoteEditor";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  voteId?: string;
  currentUserId: string;
  perms: ConsoleVoteEditorPerms;
  onRequestClose: () => void;
  onCreated: (voteId: string) => void;
};

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "closed":
      return "已结束";
    default:
      return status;
  }
}

export function ConsoleVoteEditorDialog(props: Props) {
  const router = useRouter();
  const editor = useConsoleVoteEditor({
    open: props.open,
    mode: props.mode,
    voteId: props.voteId,
    currentUserId: props.currentUserId,
    perms: props.perms,
  });

  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);
  const [archiveAlertOpen, setArchiveAlertOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  const scopeOptionsQuery = useVisibilityScopeOptions(fetchVoteScopeOptions, { enabled: props.open && !editor.visibleAll });

  const canShowExtend = useMemo(() => {
    if (!editor.effectiveVoteId) return false;
    if (editor.archivedAt) return false;
    if (!props.perms.canExtend) return false;
    return editor.canOperate && editor.status !== "draft";
  }, [editor.archivedAt, editor.canOperate, editor.effectiveVoteId, editor.status, props.perms.canExtend]);

  const canShowArchive = useMemo(() => {
    if (!editor.effectiveVoteId) return false;
    if (editor.archivedAt) return false;
    if (!props.perms.canArchive) return false;
    return editor.canOperate && editor.effectiveStatus === "closed";
  }, [editor.archivedAt, editor.canOperate, editor.effectiveStatus, editor.effectiveVoteId, props.perms.canArchive]);

  function requestClose() {
    if (editor.dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  const titleNode =
    props.mode === "create" ? (
      "新建投票"
    ) : (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>投票编辑</span>
        <Badge variant="secondary">状态：{statusLabel(editor.status)}</Badge>
        {editor.effectiveStatus !== editor.status ? <Badge variant="outline">有效：{statusLabel(editor.effectiveStatus)}</Badge> : null}
        {editor.archivedAt ? <Badge variant="secondary">已归档</Badge> : null}
        {editor.pinned ? <Badge>置顶</Badge> : null}
        {!editor.editableStructure ? <Badge variant="secondary">结构只读</Badge> : null}
      </span>
    );

  const resultsHref = editor.effectiveVoteId ? `/console/votes/${editor.effectiveVoteId}/results` : "/console/votes";

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
            {editor.action.pending ? "创建中..." : "创建草稿"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={editor.action.pending} onClick={() => requestClose()}>
          取消
        </Button>
        <Link className={buttonVariants({ variant: "outline" })} href={resultsHref}>
          查看结果
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editor.effectiveStatus === "published" && props.perms.canClose && editor.canOperate && !editor.archivedAt ? (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending}
              onClick={async () => {
                const res = await editor.closeVote();
                if (!res) return;
                router.refresh();
              }}
            >
              关闭
            </Button>
          ) : null}

          {canShowExtend ? (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending}
              onClick={() => {
                editor.action.reset();
                setExtendOpen(true);
              }}
            >
              延期
            </Button>
          ) : null}

          {props.perms.canPin && editor.canOperate && !editor.archivedAt && editor.status === "published" && editor.effectiveStatus === "published" ? (
            <Button
              size="sm"
              variant={editor.pinned ? "outline" : "default"}
              disabled={editor.action.pending}
              onClick={async () => {
                const res = await editor.pin(!editor.pinned);
                if (!res) return;
                router.refresh();
              }}
            >
              {editor.pinned ? "取消置顶" : "置顶"}
            </Button>
          ) : null}

          {canShowArchive ? (
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

          {editor.editableStructure ? (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending || !editor.canSaveDraft()}
              onClick={async () => {
                const res = await editor.saveDraft();
                if (!res) return;
                router.refresh();
              }}
            >
              {editor.action.pending ? "保存中..." : "保存草稿"}
            </Button>
          ) : null}
        </div>
      </div>
    );

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        title={titleNode}
        description={props.mode === "create" ? "草稿阶段可编辑题目与候选项；发布后锁定结构。" : editor.title || editor.effectiveVoteId}
        error={editor.detailError ?? editor.action.error}
        contentClassName={cn("max-w-5xl", props.mode === "edit" ? "max-w-6xl" : null)}
        footer={footer}
      >
        {props.mode === "edit" ? (
          editor.loading ? (
            <DialogLoadingSkeleton rows={8} />
          ) : editor.detailError ? null : (
            <ConsoleVoteEditorFormFields
              mode="edit"
              editableStructure={editor.editableStructure}
              formDisabled={editor.formDisabled}
              title={editor.title}
              setTitle={editor.setTitle}
              descriptionMd={editor.descriptionMd}
              setDescriptionMd={editor.setDescriptionMd}
              startAtLocal={editor.startAtLocal}
              setStartAtLocal={editor.setStartAtLocal}
              endAtLocal={editor.endAtLocal}
              setEndAtLocal={editor.setEndAtLocal}
              anonymousResponses={editor.anonymousResponses}
              setAnonymousResponses={editor.setAnonymousResponses}
              visibleAll={editor.visibleAll}
              setVisibleAll={editor.setVisibleAll}
              selected={editor.selected}
              setSelected={editor.setSelected}
              scopeOptions={scopeOptionsQuery.options}
              scopeError={scopeOptionsQuery.error}
              questions={editor.questions}
              setQuestions={editor.setQuestions}
              onAddQuestion={() => editor.addQuestion()}
            />
          )
        ) : (
          <ConsoleVoteEditorFormFields
            mode="create"
            editableStructure={editor.editableStructure}
            formDisabled={editor.formDisabled}
            title={editor.title}
            setTitle={editor.setTitle}
            descriptionMd={editor.descriptionMd}
            setDescriptionMd={editor.setDescriptionMd}
            startAtLocal={editor.startAtLocal}
            setStartAtLocal={editor.setStartAtLocal}
            endAtLocal={editor.endAtLocal}
            setEndAtLocal={editor.setEndAtLocal}
            anonymousResponses={editor.anonymousResponses}
            setAnonymousResponses={editor.setAnonymousResponses}
            visibleAll={editor.visibleAll}
            setVisibleAll={editor.setVisibleAll}
            selected={editor.selected}
            setSelected={editor.setSelected}
            scopeOptions={scopeOptionsQuery.options}
            scopeError={scopeOptionsQuery.error}
            questions={editor.questions}
            setQuestions={editor.setQuestions}
            onAddQuestion={() => editor.addQuestion()}
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
        title="确认归档该投票？"
        description="归档后将从学生端公共列表隐藏，但已参与用户仍可在“我的投票”中查看。"
        confirmText="确认归档"
        onConfirm={async () => {
          setArchiveAlertOpen(false);
          const res = await editor.archive();
          if (!res) return;
          router.refresh();
        }}
      />

      <ConsoleFormDialog
        open={extendOpen}
        onOpenChange={(open) => {
          if (open) editor.action.reset();
          setExtendOpen(open);
        }}
        title="延期投票"
        description="允许到期后延期；endAt 必须晚于当前结束时间且晚于当前时间。"
        pending={editor.action.pending}
        error={editor.action.error}
        confirmText="确认延期"
        onConfirm={async () => {
          const res = await editor.extend();
          if (!res) return;
          setExtendOpen(false);
          router.refresh();
        }}
      >
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">新的结束时间</label>
          <Input type="datetime-local" value={editor.extendEndAtLocal} onChange={(e) => editor.setExtendEndAtLocal(e.target.value)} required />
        </div>
      </ConsoleFormDialog>
    </>
  );
}
