import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsoleLibraryBookActions } from "@/components/library/ConsoleLibraryBookActions";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { HttpError } from "@/lib/http/errors";
import { getConsoleLibraryBookDetail } from "@/lib/modules/library/library.service";
import { getLibraryBookStatusMeta, getLibraryFileFormatLabel } from "@/lib/modules/library/library.ui";
import { formatFileSize } from "@/lib/modules/course-resources/courseResources.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

export default async function ConsoleLibraryBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("campus:library:read");
  const { id } = await params;

  const [canReview, canOffline, canDelete, canAuditList] = await Promise.all([
    hasPerm(user.id, "campus:library:review"),
    hasPerm(user.id, "campus:library:offline"),
    hasPerm(user.id, "campus:library:delete"),
    hasPerm(user.id, "campus:audit:list"),
  ]);

  const book = await getConsoleLibraryBookDetail({ bookId: id }).catch((err) => {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  });

  const meta = getLibraryBookStatusMeta(book.status);

  return (
    <div className="space-y-4">
      <PageHeader
        title={book.title}
        meta={
          <>
            <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
            <Badge variant="secondary">{book.author}</Badge>
            <Badge variant="outline">下载 {book.downloadCount}</Badge>
            <span className="font-mono text-xs">{book.isbn13}</span>
            <span className="font-mono text-xs">{book.id}</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">简介</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{book.summary ?? "—"}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">资产（下载不计入榜单）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {book.assets.length === 0 ? <div className="text-sm text-muted-foreground">暂无资产</div> : null}
              <div className="space-y-2">
                {book.assets.map((a) => (
                  <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.assetType === "file" && a.fileFormat ? (
                          <Badge variant="secondary">{getLibraryFileFormatLabel(a.fileFormat)}</Badge>
                        ) : (
                          <Badge variant="secondary">外链</Badge>
                        )}
                        <span className="text-sm font-medium">
                          {a.assetType === "file" ? a.file?.fileName ?? "—" : a.link?.url ?? "—"}
                        </span>
                      </div>
                      {a.assetType === "file" && a.file ? (
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(a.file.size)}（{a.file.size}）
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <form action={`/api/console/library/books/${book.id}/download?assetId=${a.id}`} method="POST" target="_blank">
                        <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                          {a.assetType === "file" ? "下载" : "打开外链"}
                        </button>
                      </form>
                      {a.assetType === "link" && a.link?.normalizedUrl ? (
                        <a className={buttonVariants({ variant: "outline", size: "sm" })} href={a.link.normalizedUrl} target="_blank" rel="noreferrer">
                          直达
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">审核信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">提交时间：</span>
                <span className="font-medium">{formatZhDateTime(book.submittedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">审核时间：</span>
                <span className="font-medium">{formatZhDateTime(book.review.reviewedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">审核人：</span>
                <span className="break-all font-mono text-xs">{book.review.reviewedBy ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">审核意见：</span>
                <span className="whitespace-pre-wrap font-medium">{book.review.comment ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">发布时间：</span>
                <span className="font-medium">{formatZhDateTime(book.publishedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">下架时间：</span>
                <span className="font-medium">{formatZhDateTime(book.unpublishedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">作者与统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">作者：</span>
                <span className="font-medium">{book.authorName ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">作者邮箱：</span>
                <span className="font-medium">{book.authorEmail ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">作者 userId：</span>
                <span className="break-all font-mono text-xs">{book.createdBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground">最后下载：</span>
                <span className="font-medium">{formatZhDateTime(book.lastDownloadAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">创建：</span>
                <span className="font-medium">{formatZhDateTime(book.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">更新：</span>
                <span className="font-medium">{formatZhDateTime(book.updatedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">更新人：</span>
                <span className="break-all font-mono text-xs">{book.updatedBy ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ConsoleLibraryBookActions
                bookId={book.id}
                status={book.status}
                canReview={canReview}
                canOffline={canOffline}
                canDelete={canDelete}
                afterDeleteHref="/console/library"
              />

              <div className="flex flex-wrap gap-2">
                {book.assets.length > 0 ? (
                  <form action={`/api/console/library/books/${book.id}/download`} method="POST" target="_blank">
                    <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                      默认下载（不计数）
                    </button>
                  </form>
                ) : null}
                {book.status === "published" ? (
                  <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/library/${book.id}`}>
                    Portal 预览
                  </Link>
                ) : null}
                {canAuditList ? (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/console/audit?targetType=library_book&targetId=${book.id}`}
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
