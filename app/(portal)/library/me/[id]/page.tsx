"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FileFormat, LibraryBookAsset, LibraryBookDetail } from "@/lib/api/library";
import {
  addMyLibraryBookLinkAsset,
  createMyLibraryBookUploadUrl,
  deleteMyLibraryBook,
  deleteMyLibraryBookAsset,
  fetchMyLibraryBookDetail,
  submitMyLibraryBook,
  unpublishMyLibraryBook,
  updateMyLibraryBook,
} from "@/lib/api/library";
import { ApiResponseError, getApiErrorMessage } from "@/lib/api/http";
import { getLibraryBookStatusMeta, getLibraryFileFormatLabel } from "@/lib/modules/library/library.ui";
import { formatFileSize } from "@/lib/modules/course-resources/courseResources.ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getLibraryFileExt, LIBRARY_MAX_FILE_SIZE } from "@/lib/modules/library/library.utils";

function isEditableStatus(status: LibraryBookDetail["status"]) {
  return status === "draft" || status === "rejected" || status === "unpublished";
}

function pickFileAssetByFormat(assets: LibraryBookAsset[], format: FileFormat) {
  return assets.find((a) => a.assetType === "file" && a.fileFormat === format) ?? null;
}

function listLinkAssets(assets: LibraryBookAsset[]) {
  return assets.filter((a) => a.assetType === "link");
}

export default function EditMyLibraryBookPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [book, setBook] = useState<LibraryBookDetail | null>(null);

  const [isbn13, setIsbn13] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deletingBook, setDeletingBook] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const editable = useMemo(() => (book ? isEditableStatus(book.status) : false), [book]);

  const canSave = useMemo(() => {
    if (!book) return false;
    if (!editable) return false;
    if (!isbn13.trim() || !title.trim() || !author.trim()) return false;
    return true;
  }, [book, editable, isbn13, title, author]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        const detail = await fetchMyLibraryBookDetail(id);
        if (cancelled) return;
        setBook(detail);
        setIsbn13(detail.isbn13);
        setTitle(detail.title);
        setAuthor(detail.author);
        setSummary(detail.summary ?? "");
        setKeywords(detail.keywords ?? "");
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "加载投稿详情失败"));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (!book) {
    return (
      <div className="space-y-3">
        <InlineError message={error ?? "投稿不存在或不可见"} />
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/me">
          ← 返回
        </Link>
      </div>
    );
  }

  const meta = getLibraryBookStatusMeta(book.status);
  const linkAssets = listLinkAssets(book.assets);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">管理投稿</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
            <Badge variant="outline">下载 {book.downloadCount}</Badge>
            <span className="font-mono text-xs">{book.id}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {book.status === "published" ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/library/${book.id}`}>
              Portal 预览
            </Link>
          ) : null}
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/library/me">
            ← 返回
          </Link>
        </div>
      </div>

      <InlineError message={error} />
      {info ? <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{info}</div> : null}

      {book.status === "rejected" && book.review?.comment ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">驳回原因</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{book.review.comment}</CardContent>
        </Card>
      ) : null}

      {!editable ? (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          {book.status === "pending" ? "待审核状态不可修改。" : book.status === "published" ? "已发布不可直接修改；请先下架到“已下架”，再编辑并重新提交审核。" : "当前状态不可编辑。"}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">元数据</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>ISBN-13（必填）</Label>
            <Input value={isbn13} onChange={(e) => setIsbn13(e.target.value)} maxLength={32} disabled={!editable} />
          </div>

          <div className="grid gap-1.5">
            <Label>书名（必填）</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={!editable} />
          </div>

          <div className="grid gap-1.5">
            <Label>作者（必填）</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} disabled={!editable} />
          </div>

          <div className="grid gap-1.5">
            <Label>简介（可选）</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} disabled={!editable} />
          </div>

          <div className="grid gap-1.5">
            <Label>关键词（可选）</Label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} maxLength={500} disabled={!editable} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">文件资产（≤ 100MB，每种格式最多 1 份）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["pdf", "epub", "mobi", "zip"] as const).map((format) => {
            const asset = pickFileAssetByFormat(book.assets, format);
            const ext = getLibraryFileExt(format);
            return (
              <div key={format} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{getLibraryFileFormatLabel(format)}</div>
                  {asset?.file ? (
                    <div className="text-xs text-muted-foreground">
                      当前：{asset.file.fileName} · {formatFileSize(asset.file.size)}（{asset.file.size}）
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">尚未上传</div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept={ext}
                    disabled={!editable || uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (!file) return;

                      setError(null);
                      setInfo(null);

                      const nameLower = file.name.toLowerCase();
                      if (!nameLower.endsWith(ext)) {
                        setError(`仅允许上传 ${ext} 文件`);
                        return;
                      }
                      if (file.size <= 0 || file.size > LIBRARY_MAX_FILE_SIZE) {
                        setError("文件大小必须在 0~100MB 之间");
                        return;
                      }

                      setUploading(true);
                      try {
                        const signed = await createMyLibraryBookUploadUrl(book.id, {
                          format,
                          fileName: file.name,
                          size: file.size,
                          contentType: file.type || undefined,
                        });
                        const supabase = createSupabaseBrowserClient();
                        const { error: uploadError } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.key, signed.token, file);
                        if (uploadError) throw new Error(uploadError.message);
                        setInfo(`上传完成（${getLibraryFileFormatLabel(format)}）`);
                        const refreshed = await fetchMyLibraryBookDetail(book.id);
                        setBook(refreshed);
                      } catch (err) {
                        setError(getApiErrorMessage(err, "上传失败"));
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />

                  {asset ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!editable || uploading || deletingAssetId === asset.id}
                      onClick={async () => {
                        setError(null);
                        setInfo(null);
                        setDeletingAssetId(asset.id);
                        try {
                          const next = await deleteMyLibraryBookAsset(book.id, asset.id);
                          setBook(next);
                          setInfo("已删除文件资产");
                        } catch (err) {
                          setError(getApiErrorMessage(err, "删除资产失败"));
                        } finally {
                          setDeletingAssetId(null);
                        }
                      }}
                    >
                      {deletingAssetId === asset.id ? "删除中..." : "删除"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">外链资产（可多条）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="grid flex-1 gap-1.5">
              <Label>新增外链</Label>
              <Input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="https://..." disabled={!editable || addingLink} />
              <div className="text-xs text-muted-foreground">提交审核时会校验 URL 并在同一本书内按规范化 URL 去重。</div>
            </div>
            <Button
              disabled={!editable || addingLink || !newLinkUrl.trim()}
              onClick={async () => {
                setError(null);
                setInfo(null);
                setAddingLink(true);
                try {
                  const next = await addMyLibraryBookLinkAsset(book.id, { url: newLinkUrl.trim() });
                  setBook(next);
                  setNewLinkUrl("");
                  setInfo("已添加外链");
                } catch (err) {
                  setError(getApiErrorMessage(err, "添加外链失败"));
                } finally {
                  setAddingLink(false);
                }
              }}
            >
              {addingLink ? "添加中..." : "添加"}
            </Button>
          </div>

          {linkAssets.length === 0 ? <div className="text-sm text-muted-foreground">暂无外链</div> : null}

          <div className="space-y-2">
            {linkAssets.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium break-all">{a.link?.url ?? "—"}</div>
                  {a.link?.normalizedUrl ? <div className="text-xs text-muted-foreground break-all">规范化：{a.link.normalizedUrl}</div> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {a.link?.normalizedUrl ? (
                    <a className={buttonVariants({ variant: "outline", size: "sm" })} href={a.link.normalizedUrl} target="_blank" rel="noreferrer">
                      打开
                    </a>
                  ) : null}
                  {editable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingAssetId === a.id}
                      onClick={async () => {
                        setError(null);
                        setInfo(null);
                        setDeletingAssetId(a.id);
                        try {
                          const next = await deleteMyLibraryBookAsset(book.id, a.id);
                          setBook(next);
                          setInfo("已删除外链");
                        } catch (err) {
                          setError(getApiErrorMessage(err, "删除外链失败"));
                        } finally {
                          setDeletingAssetId(null);
                        }
                      }}
                    >
                      {deletingAssetId === a.id ? "删除中..." : "删除"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!canSave || saving}
          onClick={async () => {
            setError(null);
            setInfo(null);
            setSaving(true);
            try {
              const next = await updateMyLibraryBook(book.id, {
                isbn13: isbn13.trim(),
                title: title.trim(),
                author: author.trim(),
                summary: summary.trim() ? summary.trim() : null,
                keywords: keywords.trim() ? keywords.trim() : null,
              });
              setBook(next);
              setInfo("已保存");
            } catch (err) {
              if (err instanceof ApiResponseError && err.status === 409) {
                setError(err.message || "ISBN 冲突或状态冲突");
              } else {
                setError(getApiErrorMessage(err, "保存失败"));
              }
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "保存中..." : "保存"}
        </Button>

        {editable ? (
          <Button
            disabled={submitting}
            onClick={async () => {
              setError(null);
              setInfo(null);
              setSubmitting(true);
              try {
                const next = await submitMyLibraryBook(book.id);
                setBook(next);
                setInfo("已提交审核");
              } catch (err) {
                setError(getApiErrorMessage(err, "提交审核失败"));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "提交中..." : "提交审核"}
          </Button>
        ) : null}

        {book.status === "published" ? (
          <Button
            variant="outline"
            disabled={unpublishing}
            onClick={async () => {
              setError(null);
              setInfo(null);
              setUnpublishing(true);
              try {
                const next = await unpublishMyLibraryBook(book.id);
                setBook(next);
                setInfo("已下架，可编辑后重新提交审核");
              } catch (err) {
                setError(getApiErrorMessage(err, "下架失败"));
              } finally {
                setUnpublishing(false);
              }
            }}
          >
            {unpublishing ? "下架中..." : "下架"}
          </Button>
        ) : null}

        {editable ? (
          <Button
            variant="destructive"
            disabled={deletingBook}
            onClick={async () => {
              const ok = window.confirm("确认删除该投稿？（仅草稿/驳回/下架可删）");
              if (!ok) return;
              setError(null);
              setInfo(null);
              setDeletingBook(true);
              try {
                await deleteMyLibraryBook(book.id);
                router.push("/library/me");
                router.refresh();
              } catch (err) {
                setError(getApiErrorMessage(err, "删除失败"));
              } finally {
                setDeletingBook(false);
              }
            }}
          >
            {deletingBook ? "删除中..." : "删除投稿"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
