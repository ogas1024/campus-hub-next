"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { InlineError } from "@/components/common/InlineError";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { PortalResourceEditorFormFields } from "@/components/course-resources/PortalResourceEditorFormFields";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getCourseResourceStatusMeta, getCourseResourceTypeLabel } from "@/lib/modules/course-resources/courseResources.ui";

import { usePortalResourceEditor } from "./usePortalResourceEditor";

export type FixedCourseContext = {
  major: { id: string; name: string };
  course: { id: string; name: string };
};

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  resourceId?: string;
  fixedContext?: FixedCourseContext;
  onRequestClose: () => void;
  onCreated: (resourceId: string) => void;
};

export function PortalResourceEditorDialog(props: Props) {
  const router = useRouter();
  const editor = usePortalResourceEditor({
    open: props.open,
    mode: props.mode,
    resourceId: props.resourceId,
    fixedContext: props.mode === "create" ? props.fixedContext : undefined,
  });

  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  function requestClose() {
    if (editor.dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  const headerTitle =
    props.mode === "create" ? (
      "新建投稿"
    ) : (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>编辑投稿</span>
        {editor.resource ? (
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-medium",
              getCourseResourceStatusMeta(editor.resource.status).className,
            ].join(" ")}
          >
            {getCourseResourceStatusMeta(editor.resource.status).label}
          </span>
        ) : null}
        {editor.resource ? <Badge variant="secondary">{getCourseResourceTypeLabel(editor.resource.resourceType)}</Badge> : null}
        {editor.resource ? <Badge variant="outline">下载 {editor.resource.downloadCount}</Badge> : null}
        {editor.resource?.isBest ? <Badge>最佳</Badge> : null}
      </span>
    );

  const footer =
    props.mode === "create" ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={editor.creating} onClick={() => requestClose()}>
          取消
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            disabled={!editor.canCreate || editor.creating}
              onClick={async () => {
                const createdId = await editor.createDraft();
                if (!createdId) return;
                toast.success("草稿已创建", { description: editor.title.trim() ? editor.title.trim() : undefined });
                props.onCreated(createdId);
                router.refresh();
              }}
            >
              {editor.creating ? "创建中..." : "创建草稿"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={editor.saving || editor.submitting || editor.unpublishing || editor.deleting || editor.uploading || editor.hashing}
          onClick={() => requestClose()}
        >
          取消
        </Button>

        {editor.resource?.status === "published" ? (
          <Link className={buttonVariants({ variant: "outline" })} href={`/resources/${editor.resource.id}`}>
            查看已发布页
          </Link>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editor.editable ? (
            <Button
              disabled={!editor.canSave || editor.saving}
              onClick={async () => {
                const ok = await editor.save();
                if (!ok) return;
                toast.success("已保存投稿", { description: editor.title.trim() ? editor.title.trim() : undefined });
                router.refresh();
              }}
            >
              {editor.saving ? "保存中..." : "保存"}
            </Button>
          ) : null}

          {editor.editable ? (
            <Button
              disabled={!editor.canSubmit || editor.submitting}
              onClick={async () => {
                const ok = await editor.submit();
                if (!ok) return;
                toast.success("已提交审核", { description: editor.title.trim() ? editor.title.trim() : undefined });
                router.refresh();
              }}
            >
              {editor.submitting ? "提交中..." : "提交审核"}
            </Button>
          ) : null}

          {editor.resource?.status === "published" ? (
            <Button
              variant="outline"
              disabled={editor.unpublishing}
              onClick={async () => {
                const ok = await editor.unpublish();
                if (!ok) return;
                toast.success("已下架投稿", { description: editor.title.trim() ? editor.title.trim() : undefined });
                router.refresh();
              }}
            >
              {editor.unpublishing ? "下架中..." : "下架"}
            </Button>
          ) : null}

          {editor.editable ? (
            <Button
              variant="destructive"
              disabled={editor.deleting}
              onClick={() => {
                setDeleteAlertOpen(true);
              }}
            >
              {editor.deleting ? "删除中..." : "删除投稿"}
            </Button>
          ) : null}
        </div>
      </div>
    );

  const body =
    props.mode === "create" ? (
      <PortalResourceEditorFormFields
        mode="create"
        fixedContext={props.fixedContext}
        majors={editor.majors}
        courses={editor.courses}
        majorId={editor.majorId}
        setMajorId={editor.setMajorId}
        courseId={editor.courseId}
        setCourseId={editor.setCourseId}
        resourceType={editor.resourceType}
        setResourceType={editor.setResourceType}
        title={editor.title}
        setTitle={editor.setTitle}
        description={editor.description}
        setDescription={editor.setDescription}
        editable={true}
      />
    ) : (
      <>
        {editor.info ? <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{editor.info}</div> : null}
        {editor.loading ? <DialogLoadingSkeleton rows={7} /> : null}
        {!editor.loading && !editor.resource && editor.error ? <InlineError message={editor.error} /> : null}
        {!editor.loading && !editor.resource && !editor.error ? <div className="text-sm text-muted-foreground">资源不存在或不可见</div> : null}
        {!editor.loading && editor.resource ? (
          <PortalResourceEditorFormFields
            mode="edit"
            fixedContext={undefined}
            majors={editor.majors}
            courses={editor.courses}
            majorId={editor.majorId}
            setMajorId={editor.setMajorId}
            courseId={editor.courseId}
            setCourseId={editor.setCourseId}
            resourceType={editor.resourceType}
            setResourceType={editor.setResourceType}
            title={editor.title}
            setTitle={editor.setTitle}
            description={editor.description}
            setDescription={editor.setDescription}
            linkUrl={editor.linkUrl}
            setLinkUrl={editor.setLinkUrl}
            editable={editor.editable}
            uploading={editor.uploading}
            hashing={editor.hashing}
            onUploadFile={async (file) => {
              const ok = await editor.uploadFile(file);
              if (!ok) return;
              toast.success("上传完成", { description: file.name });
              router.refresh();
            }}
            resource={editor.resource}
          />
        ) : null}
      </>
    );

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        title={headerTitle}
        description={
          props.mode === "create"
            ? props.fixedContext
              ? `为「${props.fixedContext.course.name}」创建资源草稿，再上传/填写外链并提交审核。`
              : "先创建草稿，再上传压缩包/填写外链并提交审核。"
            : editor.resource
              ? editor.resource.id
              : props.resourceId
        }
        error={editor.error}
        footer={footer}
        contentClassName="max-w-4xl"
      >
        {body}
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
        title="确认删除该投稿？"
        description="仅草稿/驳回/下架可删；删除为软删且不可恢复。"
        confirmText="删除投稿"
        confirmDisabled={editor.deleting}
        onConfirm={async () => {
          setDeleteAlertOpen(false);
          const ok = await editor.deleteResource();
          if (!ok) return;
          toast.success("已删除投稿");
          props.onRequestClose();
          router.refresh();
        }}
      />
    </>
  );
}
