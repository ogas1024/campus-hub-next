"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { PortalMaterialSubmitFormFields } from "@/components/materials/PortalMaterialSubmitFormFields";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatZhDateTime } from "@/lib/ui/datetime";

import { usePortalMaterialSubmit } from "./usePortalMaterialSubmit";

type Props = {
  open: boolean;
  materialId?: string;
  onRequestClose: () => void;
};

export function PortalMaterialSubmitDialog(props: Props) {
  const router = useRouter();
  const submit = usePortalMaterialSubmit({ open: props.open, materialId: props.materialId });

  const [withdrawAlertOpen, setWithdrawAlertOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileName: string } | null>(null);

  const activeMaterialId = props.materialId?.trim() ?? "";
  const detail = submit.detail && activeMaterialId && submit.detail.id === activeMaterialId ? submit.detail : null;
  const optimisticLoading = props.open && !!activeMaterialId && !detail && !submit.error;
  const loading = submit.loading || optimisticLoading;

  const materialTitle = detail?.title ?? "材料提交";
  const dueAtText = (() => {
    if (!detail?.dueAt) return null;
    const d = new Date(detail.dueAt);
    if (Number.isNaN(d.getTime())) return null;
    return formatZhDateTime(d);
  })();

  const headerDescription = detail
    ? dueAtText
      ? `截止：${dueAtText}`
      : detail.status === "closed"
        ? "已关闭"
        : detail.status === "draft"
          ? "草稿"
          : "—"
    : activeMaterialId
      ? activeMaterialId
      : "—";

  const my = detail?.mySubmission ?? null;

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button variant="outline" disabled={submit.pending} onClick={() => props.onRequestClose()}>
        取消
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {my?.submittedAt ? (
          <Button
            size="sm"
            variant="outline"
            disabled={submit.pending}
            onClick={() => {
              setWithdrawAlertOpen(true);
            }}
          >
            撤回（删除文件）
          </Button>
        ) : null}

        <Button
          size="sm"
          disabled={loading || !detail || submit.readOnly || submit.pending}
          onClick={async () => {
            const ok = await submit.submit();
            if (!ok) return;
            router.refresh();
          }}
        >
          {submit.pending ? "处理中..." : my?.submittedAt ? "更新提交（覆盖提交）" : "提交"}
        </Button>
      </div>
    </div>
  );

  const body = loading ? (
    <DialogLoadingSkeleton rows={6} />
  ) : !detail ? (
    <div className="text-sm text-muted-foreground">任务不存在或不可见</div>
  ) : (
    <>
      {detail.descriptionMd?.trim() ? (
        <Card>
          <CardContent className="p-5">
            <NoticeMarkdown contentMd={detail.descriptionMd} />
          </CardContent>
        </Card>
      ) : null}

      <PortalMaterialSubmitFormFields
        detail={detail}
        readOnly={!!submit.readOnly}
        pending={submit.pending}
        uploadHint={submit.uploadHint}
        missingItemIds={submit.missingItemIds}
        onUpload={async (itemId, list) => {
          const ok = await submit.upload(itemId, list);
          if (!ok) return;
          router.refresh();
        }}
        onRequestDeleteFile={(file) => {
          setDeleteTarget(file);
          setDeleteAlertOpen(true);
        }}
      />

      {detail.notice ? (
        <div className="text-sm text-muted-foreground">
          关联公告：
          <Link className="ml-1 underline underline-offset-2 hover:text-foreground" href={`/notices?dialog=notice-view&id=${encodeURIComponent(detail.notice.id)}`}>
            {detail.notice.title || detail.notice.id}
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          props.onRequestClose();
        }}
        title={materialTitle}
        description={headerDescription}
        error={submit.error}
        footer={footer}
      >
        {body}
      </StickyFormDialog>

      <ConfirmAlertDialog
        open={withdrawAlertOpen}
        onOpenChange={setWithdrawAlertOpen}
        title="确认撤回本次提交？"
        description="撤回后将物理删除已上传文件。"
        confirmText="确认撤回"
        confirmDisabled={submit.pending}
        onConfirm={async () => {
          setWithdrawAlertOpen(false);
          const ok = await submit.withdraw();
          if (!ok) return;
          router.refresh();
        }}
      />

      <ConfirmAlertDialog
        open={deleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        title="确认删除该文件？"
        description={deleteTarget ? `将物理删除「${deleteTarget.fileName}」。` : "将物理删除该文件。"}
        confirmText="删除文件"
        confirmDisabled={submit.pending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const fileId = deleteTarget.id;
          setDeleteAlertOpen(false);
          setDeleteTarget(null);
          const ok = await submit.deleteFile(fileId);
          if (!ok) return;
          router.refresh();
        }}
      />
    </>
  );
}
