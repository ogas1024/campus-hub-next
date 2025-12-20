import Link from "next/link";

import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { getConsoleMaterialDetail, getConsoleMaterialSubmissionDetail, type MaterialSubmissionStatus } from "@/lib/modules/materials/materials.service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string; submissionId: string }> };

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

export default async function ConsoleMaterialSubmissionDetailPage({ params }: Params) {
  const user = await requirePerm("campus:material:process");
  const { id: materialId, submissionId } = await params;

  const [canManageAll, material] = await Promise.all([
    hasPerm(user.id, "campus:material:manage"),
    getConsoleMaterialDetail({ actorUserId: user.id, materialId }),
  ]);

  const canOperate = material.createdBy === user.id || canManageAll;

  const submission = await getConsoleMaterialSubmissionDetail({
    actorUserId: user.id,
    materialId,
    submissionId,
    includeDownloadUrls: canOperate,
  });

  const assignee = submission.assigneeUserId === user.id ? "我" : submission.assigneeUserId ? "已分配" : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">提交详情</h1>
          <div className="text-sm text-muted-foreground">
            任务：<span className="font-medium text-foreground">{material.title}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            学号：<span className="font-mono text-xs text-foreground">{submission.studentId || "—"}</span> · 姓名：
            <span className="ml-1 text-foreground">{submission.name || "—"}</span>
          </div>
          <div className="text-sm text-muted-foreground">部门：{submission.departments.join(" / ") || "—"}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${materialId}/submissions`}>
            ← 返回提交管理
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${materialId}/edit`}>
            返回任务
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">提交时间：{submission.submittedAt ? formatZhDateTime(submission.submittedAt) : "未提交"}</Badge>
        <Badge variant="outline">状态：{statusLabel(submission.status)}</Badge>
        <Badge variant="outline">缺材料：{submission.missingRequired ? "是" : "否"}</Badge>
        <Badge variant="outline">经办：{assignee}</Badge>
        <Badge variant="outline">
          文件：{submission.fileCount} · {bytesToText(submission.totalBytes)}
        </Badge>
        {!canOperate ? <Badge variant="secondary">只读（无下载权限）</Badge> : null}
      </div>

      {submission.studentMessage ? (
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-sm font-medium">给学生的说明</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.studentMessage}</div>
          </CardContent>
        </Card>
      ) : null}

      {submission.staffNote ? (
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-sm font-medium">内部备注</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.staffNote}</div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {submission.items
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((item) => {
            const missing = item.required && item.files.length === 0;
            return (
              <Card key={item.id} className={cn(missing ? "border-destructive ring-1 ring-destructive/40" : null)}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-base font-semibold">
                        {item.title} {item.required ? <span className="text-destructive">*</span> : null}
                      </div>
                      {item.description ? <div className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</div> : null}
                      {missing ? <div className="text-xs text-destructive">必交材料未上传</div> : null}
                    </div>
                    <Badge variant="outline">文件：{item.files.length}</Badge>
                  </div>

                  <div className="space-y-2">
                    {item.files.length === 0 ? (
                      <div className="text-sm text-muted-foreground">暂无文件</div>
                    ) : (
                      <div className="space-y-2">
                        {item.files.map((f) => (
                          <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
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
                                <span className="text-xs text-muted-foreground">{canOperate ? "不可用" : "无权限下载"}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}

