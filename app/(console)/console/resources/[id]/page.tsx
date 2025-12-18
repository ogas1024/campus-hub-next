import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsoleResourceActions } from "@/components/course-resources/ConsoleResourceActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { HttpError } from "@/lib/http/errors";
import { getConsoleResourceDetail } from "@/lib/modules/course-resources/courseResources.service";
import { formatFileSize, getCourseResourceStatusMeta, getCourseResourceTypeLabel } from "@/lib/modules/course-resources/courseResources.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

export default async function ConsoleResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("campus:resource:read");
  const { id } = await params;

  const [canReview, canOffline, canBest, canDelete, canAuditList] = await Promise.all([
    hasPerm(user.id, "campus:resource:review"),
    hasPerm(user.id, "campus:resource:offline"),
    hasPerm(user.id, "campus:resource:best"),
    hasPerm(user.id, "campus:resource:delete"),
    hasPerm(user.id, "campus:audit:list"),
  ]);

  const resource = await getConsoleResourceDetail({ actorUserId: user.id, resourceId: id }).catch((err) => {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  });

  const meta = getCourseResourceStatusMeta(resource.status);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href="/console/resources" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回课程资源
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{resource.title}</h1>
          {resource.isBest ? <Badge>最佳</Badge> : null}
          <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
          <Badge variant="secondary">{getCourseResourceTypeLabel(resource.resourceType)}</Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          {resource.majorName} / {resource.courseName}
        </div>
        <div className="font-mono text-xs text-muted-foreground">{resource.id}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">描述</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{resource.description}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">资源信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {resource.resourceType === "file" ? (
                resource.file ? (
                  <>
                    <div>
                      <span className="text-muted-foreground">文件名：</span>
                      <span className="font-medium">{resource.file.fileName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">大小：</span>
                      <span className="font-medium">
                        {formatFileSize(resource.file.size)}（{resource.file.size}）
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SHA-256：</span>
                      <span className="break-all font-mono text-xs">{resource.file.sha256}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">存储 key：</span>
                      <span className="break-all font-mono text-xs">
                        {resource.file.bucket}/{resource.file.key}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">文件信息不完整（草稿阶段允许缺省）。</div>
                )
              ) : resource.link ? (
                <>
                  <div>
                    <span className="text-muted-foreground">原始 URL：</span>
                    <a className="break-all underline" href={resource.link.url} target="_blank" rel="noreferrer">
                      {resource.link.url}
                    </a>
                  </div>
                  <div>
                    <span className="text-muted-foreground">规范化 URL：</span>
                    <a className="break-all underline" href={resource.link.normalizedUrl} target="_blank" rel="noreferrer">
                      {resource.link.normalizedUrl}
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">外链信息不完整（草稿阶段允许缺省）。</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">审核与状态流转</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">提交时间：</span>
                <span className="font-medium">{formatZhDateTime(resource.submittedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">审核时间：</span>
                <span className="font-medium">{formatZhDateTime(resource.review.reviewedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">审核人：</span>
                <span className="break-all font-mono text-xs">{resource.review.reviewedBy ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">审核意见：</span>
                <span className="whitespace-pre-wrap font-medium">{resource.review.comment ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">发布时间：</span>
                <span className="font-medium">{formatZhDateTime(resource.publishedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">下架时间：</span>
                <span className="font-medium">{formatZhDateTime(resource.unpublishedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">统计与作者</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">作者：</span>
                <span className="font-medium">{resource.authorName ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">作者邮箱：</span>
                <span className="font-medium">{resource.authorEmail ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">作者 userId：</span>
                <span className="break-all font-mono text-xs">{resource.createdBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground">下载次数：</span>
                <span className="font-medium tabular-nums">{resource.downloadCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">最后下载：</span>
                <span className="font-medium">{formatZhDateTime(resource.lastDownloadAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">创建：</span>
                <span className="font-medium">{formatZhDateTime(resource.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">更新：</span>
                <span className="font-medium">{formatZhDateTime(resource.updatedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">更新人：</span>
                <span className="break-all font-mono text-xs">{resource.updatedBy ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ConsoleResourceActions
                resourceId={resource.id}
                status={resource.status}
                isBest={resource.isBest}
                canReview={canReview}
                canOffline={canOffline}
                canBest={canBest}
                canDelete={canDelete}
                afterDeleteHref="/console/resources"
              />

              <div className="flex flex-wrap gap-2">
                {(resource.resourceType === "file" && resource.file) || (resource.resourceType === "link" && resource.link) ? (
                  <form action={`/api/console/resources/${resource.id}/download`} method="POST" target="_blank">
                    <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                      {resource.resourceType === "file" ? "下载（不计数）" : "打开外链（不计数）"}
                    </button>
                  </form>
                ) : null}
                {resource.status === "published" ? (
                  <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/resources/${resource.id}`}>
                    Portal 预览
                  </Link>
                ) : null}
                {canAuditList ? (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/console/audit?targetType=course_resource&targetId=${resource.id}`}
                  >
                    查看审计
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
