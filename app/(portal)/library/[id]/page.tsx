import Link from "next/link";
import { notFound } from "next/navigation";

import { LibraryFavoriteButton } from "@/components/library/LibraryFavoriteButton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePortalUser } from "@/lib/auth/guards";
import { HttpError } from "@/lib/http/errors";
import { getPortalLibraryBookDetail } from "@/lib/modules/library/library.service";
import { getLibraryFileFormatLabel } from "@/lib/modules/library/library.ui";
import { formatFileSize } from "@/lib/modules/course-resources/courseResources.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

export default async function LibraryBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser();
  const { id } = await params;

  const book = await getPortalLibraryBookDetail({ userId: user.id, bookId: id }).catch((err) => {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  });

  if (book.status !== "published") notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{book.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{book.author}</Badge>
            <Badge variant="outline">下载 {book.downloadCount}</Badge>
            <span className="font-mono text-xs">{book.isbn13}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LibraryFavoriteButton bookId={book.id} initialFavorite={book.isFavorite} />
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library">
            ← 返回列表
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/me">
            我的投稿
          </Link>
        </div>
      </div>

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
              <CardTitle className="text-base">下载与资产</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {book.assets.length === 0 ? (
                <div className="text-sm text-muted-foreground">暂无资产</div>
              ) : (
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
                        <form action={`/api/library/${book.id}/download?assetId=${a.id}`} method="POST" target="_blank">
                          <button className={buttonVariants({ size: "sm" })} type="submit">
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
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">关键词：</span>
                <span className="font-medium">{book.keywords ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">投稿人：</span>
                <span className="font-medium">{book.authorName ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">发布时间：</span>
                <span className="font-medium">{formatZhDateTime(book.publishedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">最后下载：</span>
                <span className="font-medium">{formatZhDateTime(book.lastDownloadAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">投稿入口</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>你也可以投稿电子书/资料，经图书管理员审核后对全站可见。</div>
              <Link className={buttonVariants({ size: "sm" })} href="/library/me/new">
                新建投稿
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
