"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PortalMaterialDetail, MaterialSubmissionStatus } from "@/lib/api/materials";
import { cn } from "@/lib/utils";

type Props = {
  detail: PortalMaterialDetail;
  readOnly: boolean;
  pending: boolean;
  uploadHint: string | null;
  missingItemIds: Set<string>;
  onUpload: (itemId: string, list: FileList | null) => void;
  onRequestDeleteFile: (file: { id: string; fileName: string }) => void;
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

export function PortalMaterialSubmitFormFields(props: Props) {
  const my = props.detail.mySubmission;
  const files = useMemo(() => my?.files ?? [], [my?.files]);
  const fileCount = files.length;
  const remainingSlots = Math.max(0, props.detail.maxFilesPerSubmission - fileCount);

  const filesByItemId = useMemo(() => {
    const map = new Map<string, typeof files>();
    for (const f of files) {
      const list = map.get(f.itemId) ?? [];
      list.push(f);
      map.set(f.itemId, list);
    }
    return map;
  }, [files]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {props.detail.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">不可提交</Badge>}
        {my?.submittedAt ? (
          <Badge variant="outline">已提交：{new Date(my.submittedAt).toLocaleString("zh-CN")}</Badge>
        ) : (
          <Badge variant="secondary">未提交</Badge>
        )}
        {my?.withdrawnAt ? <Badge variant="outline">已撤回</Badge> : null}
        {my ? <Badge variant="outline">状态：{statusLabel(my.status)}</Badge> : null}
        <Badge variant="outline">
          文件：{fileCount} / {props.detail.maxFilesPerSubmission}
        </Badge>
        <Badge variant="outline">剩余：{remainingSlots}</Badge>
        {props.readOnly ? <Badge variant="secondary">只读</Badge> : null}
      </div>

      {my?.studentMessage ? (
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-sm font-medium">处理意见</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{my.studentMessage}</div>
          </CardContent>
        </Card>
      ) : null}

      {props.uploadHint ? <div className="text-xs text-muted-foreground">{props.uploadHint}</div> : null}

      <div className="space-y-3">
        {props.detail.items
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((item) => {
            const itemFiles = filesByItemId.get(item.id) ?? [];
            const missing = props.missingItemIds.has(item.id);
            return (
              <Card key={item.id} id={`material-item-${item.id}`} className={cn(missing ? "border-destructive ring-1 ring-destructive/40" : null)}>
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
                          <a className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={item.template.downloadUrl} target="_blank" rel="noreferrer">
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
                          <div
                            key={f.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm">{f.fileName}</div>
                              <div className="text-xs text-muted-foreground">{bytesToText(f.size)}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {f.downloadUrl ? (
                                <a className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={f.downloadUrl} target="_blank" rel="noreferrer">
                                  下载
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">不可用</span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={props.readOnly || props.pending}
                                onClick={() => props.onRequestDeleteFile({ id: f.id, fileName: f.fileName })}
                              >
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
                      disabled={props.readOnly || props.pending || remainingSlots <= 0}
                      onChange={(e) => {
                        const list = e.currentTarget.files;
                        e.currentTarget.value = "";
                        props.onUpload(item.id, list);
                      }}
                    />
                    <div className="text-xs text-muted-foreground">
                      支持上传多个文件；总文件数上限为 {props.detail.maxFilesPerSubmission}，当前剩余 {remainingSlots}。
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}

