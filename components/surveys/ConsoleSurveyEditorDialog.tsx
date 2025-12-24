"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { fetchSurveyScopeOptions } from "@/lib/api/console-surveys";
import { cn } from "@/lib/utils";

import { ConsoleSurveyEditorFormFields } from "./ConsoleSurveyEditorFormFields";
import { useConsoleSurveyEditor, type ConsoleSurveyEditorPerms } from "./useConsoleSurveyEditor";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  surveyId?: string;
  currentUserId: string;
  perms: ConsoleSurveyEditorPerms;
  onRequestClose: () => void;
  onCreated: (surveyId: string) => void;
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

export function ConsoleSurveyEditorDialog(props: Props) {
  const router = useRouter();
  const editor = useConsoleSurveyEditor({
    open: props.open,
    mode: props.mode,
    surveyId: props.surveyId,
    currentUserId: props.currentUserId,
    perms: props.perms,
  });

  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  const scopeOptionsQuery = useVisibilityScopeOptions(fetchSurveyScopeOptions, { enabled: props.open && !editor.visibleAll });

  const canShowDelete = useMemo(() => {
    if (!editor.effectiveSurveyId) return false;
    if (!props.perms.canDelete) return false;
    return editor.canOperate;
  }, [editor.canOperate, editor.effectiveSurveyId, props.perms.canDelete]);

  function requestClose() {
    if (editor.dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  const titleNode =
    props.mode === "create" ? (
      "新建问卷"
    ) : (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>问卷编辑</span>
        <Badge variant="secondary">状态：{statusLabel(editor.status)}</Badge>
        {editor.effectiveStatus !== editor.status ? <Badge variant="outline">有效：{statusLabel(editor.effectiveStatus)}</Badge> : null}
        {!editor.editableStructure ? <Badge variant="secondary">结构只读</Badge> : null}
      </span>
    );

  const resultsHref = editor.effectiveSurveyId ? `/console/surveys/${editor.effectiveSurveyId}/results` : "/console/surveys";

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
          {editor.effectiveStatus === "published" && props.perms.canClose && editor.canOperate ? (
            <Button
              size="sm"
              variant="outline"
              disabled={editor.action.pending}
              onClick={async () => {
                const res = await editor.closeSurvey();
                if (!res) return;
                router.refresh();
              }}
            >
              关闭
            </Button>
          ) : null}

          {editor.status === "draft" && props.perms.canPublish && editor.canOperate ? (
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
              disabled={editor.action.pending}
              onClick={async () => {
                const res = await editor.saveDraft();
                if (!res) return;
                router.refresh();
              }}
            >
              {editor.action.pending ? "保存中..." : "保存草稿"}
            </Button>
          ) : null}

          {canShowDelete ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={editor.action.pending}
              onClick={() => {
                editor.action.reset();
                setDeleteAlertOpen(true);
              }}
            >
              删除
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
        description={props.mode === "create" ? "草稿阶段可编辑分节/题目；发布后锁定结构。" : editor.title || editor.effectiveSurveyId}
        error={editor.detailError ?? editor.action.error}
        contentClassName={cn("max-w-5xl", props.mode === "edit" ? "max-w-6xl" : null)}
        footer={footer}
      >
        {props.mode === "edit" ? (
          editor.loading ? (
            <DialogLoadingSkeleton rows={8} />
          ) : editor.detailError ? null : (
            <ConsoleSurveyEditorFormFields
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
              sections={editor.sections}
              setSections={editor.setSections}
              onAddSection={() => editor.addSection()}
              onAddQuestion={(sectionId) => editor.addQuestion(sectionId)}
            />
          )
        ) : (
          <ConsoleSurveyEditorFormFields
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
            sections={editor.sections}
            setSections={editor.setSections}
            onAddSection={() => editor.addSection()}
            onAddQuestion={(sectionId) => editor.addQuestion(sectionId)}
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
        open={deleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        title="确认删除该问卷（软删）？"
        description="删除后将从列表隐藏；此操作不可恢复。"
        confirmText="删除"
        confirmDisabled={editor.action.pending}
        onConfirm={async () => {
          const res = await editor.deleteSurvey();
          if (!res) return;
          setDeleteAlertOpen(false);
          props.onRequestClose();
          router.refresh();
        }}
      />
    </>
  );
}
