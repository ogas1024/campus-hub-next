"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PortalMaterialDetail, MaterialSubmissionStatus } from "@/lib/api/materials";
import { deleteMyMaterialFile, fetchPortalMaterialDetail, submitMyMaterial, uploadMyMaterialFile, withdrawMyMaterial } from "@/lib/api/materials";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { cn } from "@/lib/utils";

type Props = {
  materialId: string;
  initialDetail: PortalMaterialDetail;
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

function bytesToText(bytes: number) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PortalMaterialSubmitClient(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [detail, setDetail] = useState<PortalMaterialDetail>(props.initialDetail);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [missingItemIds, setMissingItemIds] = useState<Set<string>>(() => new Set());

  const readOnly = !detail.canSubmit;
  const my = detail.mySubmission;
  const files = useMemo(() => my?.files ?? [], [my?.files]);
  const fileCount = files.length;
  const remainingSlots = Math.max(0, detail.maxFilesPerSubmission - fileCount);

  const filesByItemId = useMemo(() => {
    const map = new Map<string, typeof files>();
    for (const f of files) {
      const list = map.get(f.itemId) ?? [];
      list.push(f);
      map.set(f.itemId, list);
    }
    return map;
  }, [files]);

  function computeMissingRequiredItemIds(next: PortalMaterialDetail) {
    const provided = new Set((next.mySubmission?.files ?? []).map((f) => f.itemId));
    return next.items.filter((i) => i.required && !provided.has(i.id)).map((i) => i.id);
  }

  async function refresh() {
    const next = await fetchPortalMaterialDetail(props.materialId);
    setDetail(next);
    setMissingItemIds((prev) => (prev.size > 0 ? new Set(computeMissingRequiredItemIds(next)) : prev));
  }

  async function handleUpload(itemId: string, list: FileList | null) {
    if (!list || list.length === 0) return;
    action.reset();
    setUploadHint(null);

    if (remainingSlots <= 0) {
      action.setError(`最多上传 ${detail.maxFilesPerSubmission} 个文件`);
      return;
    }

    const selectedFiles = Array.from(list);
    const toUpload = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      setUploadHint(`本次仅会上传前 ${remainingSlots} 个文件，已忽略 ${selectedFiles.length - remainingSlots} 个。`);
    }

    for (const file of toUpload) {
      const res = await action.run(() => uploadMyMaterialFile(props.materialId, itemId, file), { fallbackErrorMessage: "上传失败" });
      if (!res) break;
    }

    await refresh();
    router.refresh();
  }

  async function handleDelete(fileId: string) {
    const res = await action.run(() => deleteMyMaterialFile(props.materialId, fileId), { fallbackErrorMessage: "删除失败" });
    if (!res) return;
    await refresh();
    router.refresh();
  }

  async function handleSubmit() {
    setUploadHint(null);
    const missing = computeMissingRequiredItemIds(detail);
    if (missing.length > 0) {
      setMissingItemIds(new Set(missing));
      action.setError("缺少必交材料，请先上传标星项。");
      const first = missing[0];
      const el = first ? document.getElementById(`material-item-${first}`) : null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setMissingItemIds(new Set());
    const res = await action.run(() => submitMyMaterial(props.materialId), { fallbackErrorMessage: "提交失败" });
    if (!res) return;
    await refresh();
    router.refresh();
  }

  async function handleWithdraw() {
    if (!confirm("确认撤回？撤回后将物理删除已上传文件。")) return;
    const res = await action.run(() => withdrawMyMaterial(props.materialId), { fallbackErrorMessage: "撤回失败" });
    if (!res) return;
    setMissingItemIds(new Set());
    await refresh();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {detail.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">不可提交</Badge>}
        {my?.submittedAt ? <Badge variant="outline">已提交：{new Date(my.submittedAt).toLocaleString("zh-CN")}</Badge> : <Badge variant="secondary">未提交</Badge>}
        {my?.withdrawnAt ? <Badge variant="outline">已撤回</Badge> : null}
        {my ? <Badge variant="outline">状态：{statusLabel(my.status)}</Badge> : null}
        <Badge variant="outline">
          文件：{fileCount} / {detail.maxFilesPerSubmission}
        </Badge>
        <Badge variant="outline">剩余：{remainingSlots}</Badge>
        {readOnly ? <Badge variant="secondary">只读</Badge> : null}
      </div>

      {my?.studentMessage ? (
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-sm font-medium">处理意见</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{my.studentMessage}</div>
          </CardContent>
        </Card>
      ) : null}

      {action.error ? <InlineError message={action.error} /> : null}
      {uploadHint ? <div className="text-xs text-muted-foreground">{uploadHint}</div> : null}

      <div className="space-y-3">
        {detail.items
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((item) => {
            const itemFiles = filesByItemId.get(item.id) ?? [];
            const missing = missingItemIds.has(item.id);
            return (
              <Card
                key={item.id}
                id={`material-item-${item.id}`}
                className={cn(missing ? "border-destructive ring-1 ring-destructive/40" : null)}
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-base font-semibold">
                        {item.title} {item.required ? <span className="text-destructive">*</span> : null}
                      </div>
                      {item.description ? <div className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</div> : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.template ? (
                        item.template.downloadUrl ? (
                          <a
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                            href={item.template.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            下载模板（{bytesToText(item.template.size)}）
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">模板不可用</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">无模板</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">已上传文件</div>
                    {itemFiles.length === 0 ? (
                      <div className="text-sm text-muted-foreground">暂无文件</div>
                    ) : (
                      <div className="space-y-2">
                        {itemFiles.map((f) => (
                          <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm">{f.fileName}</div>
                              <div className="text-xs text-muted-foreground">{bytesToText(f.size)}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {f.downloadUrl ? (
                                <a
                                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                                  href={f.downloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  下载
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">不可用</span>
                              )}
                              <Button size="sm" variant="outline" disabled={readOnly || action.pending} onClick={() => void handleDelete(f.id)}>
                                删除
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">上传文件</div>
                    <Input
                      type="file"
                      multiple
                      disabled={readOnly || action.pending || remainingSlots <= 0}
                      onChange={(e) => {
                        const list = e.currentTarget.files;
                        e.currentTarget.value = "";
                        void handleUpload(item.id, list);
                      }}
                    />
                    <div className="text-xs text-muted-foreground">
                      支持上传多个文件；总文件数上限为 {detail.maxFilesPerSubmission}，当前剩余 {remainingSlots}。
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {my?.submittedAt ? (
          <Button size="sm" variant="outline" disabled={action.pending} onClick={() => void handleWithdraw()}>
            撤回（删除文件）
          </Button>
        ) : null}

        <Button size="sm" disabled={readOnly || action.pending} onClick={() => void handleSubmit()}>
          {action.pending ? "处理中..." : my?.submittedAt ? "更新提交（覆盖提交）" : "提交"}
        </Button>
      </div>

      {detail.notice ? (
        <div className="text-sm text-muted-foreground">
          关联公告：
          <Link className="ml-1 underline underline-offset-2 hover:text-foreground" href={`/notices/${detail.notice.id}`}>
            {detail.notice.title || detail.notice.id}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
