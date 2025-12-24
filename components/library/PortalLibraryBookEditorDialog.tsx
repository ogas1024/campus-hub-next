"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { InlineError } from "@/components/common/InlineError";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FileFormat, LibraryBookAsset, LibraryBookDetail } from "@/lib/api/library";
import {
  addMyLibraryBookLinkAsset,
  createMyLibraryBookDraft,
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
import { getLibraryFileExt, LIBRARY_MAX_FILE_SIZE } from "@/lib/modules/library/library.utils";
import { formatFileSize } from "@/lib/modules/course-resources/courseResources.ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  bookId?: string;
  onRequestClose: () => void;
  onCreated: (bookId: string) => void;
};

function isEditableStatus(status: LibraryBookDetail["status"]) {
  return status === "draft" || status === "rejected" || status === "unpublished";
}

function pickFileAssetByFormat(assets: LibraryBookAsset[], format: FileFormat) {
  return assets.find((a) => a.assetType === "file" && a.fileFormat === format) ?? null;
}

function listLinkAssets(assets: LibraryBookAsset[]) {
  return assets.filter((a) => a.assetType === "link");
}

function isDirtySnapshot(a: Record<string, unknown>, b: Record<string, unknown>) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function PortalLibraryBookEditorDialog(props: Props) {
  const router = useRouter();

  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);
  const [deleteBookAlertOpen, setDeleteBookAlertOpen] = useState(false);

  // create mode state
  const [createIsbn13, setCreateIsbn13] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createAuthor, setCreateAuthor] = useState("");
  const [createSummary, setCreateSummary] = useState("");
  const [createKeywords, setCreateKeywords] = useState("");
  const [creating, setCreating] = useState(false);

  // edit mode state
  const [book, setBook] = useState<LibraryBookDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isbn13, setIsbn13] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

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

  const createCanSubmit = useMemo(() => {
    if (!createIsbn13.trim()) return false;
    if (!createTitle.trim()) return false;
    if (!createAuthor.trim()) return false;
    return true;
  }, [createAuthor, createIsbn13, createTitle]);

  const canSave = useMemo(() => {
    if (!book) return false;
    if (!editable) return false;
    if (!isbn13.trim() || !title.trim() || !author.trim()) return false;
    return true;
  }, [author, book, editable, isbn13, title]);

  const dirty = useMemo(() => {
    if (!props.open) return false;
    if (props.mode === "create") {
      return !!(createIsbn13.trim() || createTitle.trim() || createAuthor.trim() || createSummary.trim() || createKeywords.trim());
    }
    if (!book) return false;
    const initial = {
      isbn13: book.isbn13,
      title: book.title,
      author: book.author,
      summary: book.summary ?? "",
      keywords: book.keywords ?? "",
      newLinkUrl: "",
    };
    const current = {
      isbn13,
      title,
      author,
      summary,
      keywords,
      newLinkUrl,
    };
    return isDirtySnapshot(initial, current);
  }, [author, book, createAuthor, createIsbn13, createKeywords, createSummary, createTitle, isbn13, keywords, newLinkUrl, props.mode, props.open, summary, title]);

  function requestClose() {
    if (dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  useEffect(() => {
    if (!props.open) return;
    if (props.mode !== "create") return;
    setCreateIsbn13("");
    setCreateTitle("");
    setCreateAuthor("");
    setCreateSummary("");
    setCreateKeywords("");
    setCreating(false);
    setError(null);
    setInfo(null);
  }, [props.mode, props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (props.mode !== "edit") return;
    if (!props.bookId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        const detail = await fetchMyLibraryBookDetail(props.bookId!);
        if (cancelled) return;
        setBook(detail);
        setIsbn13(detail.isbn13);
        setTitle(detail.title);
        setAuthor(detail.author);
        setSummary(detail.summary ?? "");
        setKeywords(detail.keywords ?? "");
        setNewLinkUrl("");
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "加载投稿详情失败"));
        setBook(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.bookId, props.mode, props.open]);

  async function reloadBook(id: string) {
    try {
      const detail = await fetchMyLibraryBookDetail(id);
      setBook(detail);
      setIsbn13(detail.isbn13);
      setTitle(detail.title);
      setAuthor(detail.author);
      setSummary(detail.summary ?? "");
      setKeywords(detail.keywords ?? "");
      return detail;
    } catch (err) {
      setError(getApiErrorMessage(err, "刷新失败"));
      return null;
    }
  }

  const headerTitle =
    props.mode === "create" ? (
      "新建投稿"
    ) : (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>管理投稿</span>
        {book ? <span className={["rounded-full px-2 py-0.5 text-xs font-medium", getLibraryBookStatusMeta(book.status).className].join(" ")}>{getLibraryBookStatusMeta(book.status).label}</span> : null}
        {book ? <Badge variant="outline">下载 {book.downloadCount}</Badge> : null}
      </span>
    );

  const footer =
    props.mode === "create" ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={creating} onClick={() => requestClose()}>
          取消
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            disabled={!createCanSubmit || creating}
            onClick={async () => {
              setError(null);
              setInfo(null);
              setCreating(true);
              try {
                const created = await createMyLibraryBookDraft({
                  isbn13: createIsbn13.trim(),
                  title: createTitle.trim(),
                  author: createAuthor.trim(),
                  summary: createSummary.trim() ? createSummary.trim() : null,
                  keywords: createKeywords.trim() ? createKeywords.trim() : null,
                });
                toast.success("草稿已创建", { description: createTitle.trim() ? createTitle.trim() : undefined });
                props.onCreated(created.id);
                router.refresh();
              } catch (err) {
                setError(getApiErrorMessage(err, "创建草稿失败"));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "创建中..." : "创建草稿"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={saving || submitting || unpublishing || deletingBook} onClick={() => requestClose()}>
          取消
        </Button>

        {book?.status === "published" ? (
          <Link className={buttonVariants({ variant: "outline" })} href={`/library/${book.id}`}>
            Portal 预览
          </Link>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editable ? (
            <Button
              disabled={!canSave || saving}
              onClick={async () => {
                if (!book) return;
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
                  toast.success("已保存投稿", { description: title.trim() ? title.trim() : undefined });
                  router.refresh();
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
          ) : null}

          {editable ? (
            <Button
              disabled={submitting}
              onClick={async () => {
                if (!book) return;
                setError(null);
                setInfo(null);
                setSubmitting(true);
                try {
                  const next = await submitMyLibraryBook(book.id);
                  setBook(next);
                  setInfo("已提交审核");
                  toast.success("已提交审核", { description: book.title });
                  router.refresh();
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

          {book?.status === "published" ? (
            <Button
              variant="outline"
              disabled={unpublishing}
              onClick={async () => {
                if (!book) return;
                setError(null);
                setInfo(null);
                setUnpublishing(true);
                try {
                  const next = await unpublishMyLibraryBook(book.id);
                  setBook(next);
                  setInfo("已下架，可编辑后重新提交审核");
                  toast.success("已下架投稿", { description: book.title });
                  router.refresh();
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
              onClick={() => {
                setDeleteBookAlertOpen(true);
              }}
            >
              {deletingBook ? "删除中..." : "删除投稿"}
            </Button>
          ) : null}
        </div>
      </div>
    );

  const body =
    props.mode === "create" ? (
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>ISBN-13（必填，全局唯一）</Label>
          <Input value={createIsbn13} onChange={(e) => setCreateIsbn13(e.target.value)} placeholder="978-7-111-12233-3" maxLength={32} />
          <div className="text-xs text-muted-foreground">支持空格/连字符；入库将规范化为 13 位数字并校验位。</div>
        </div>

        <div className="grid gap-1.5">
          <Label>书名（必填）</Label>
          <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} maxLength={200} />
        </div>

        <div className="grid gap-1.5">
          <Label>作者（必填）</Label>
          <Input value={createAuthor} onChange={(e) => setCreateAuthor(e.target.value)} maxLength={200} />
        </div>

        <div className="grid gap-1.5">
          <Label>简介（可选）</Label>
          <Textarea value={createSummary} onChange={(e) => setCreateSummary(e.target.value)} maxLength={2000} placeholder="可简要说明内容、适用人群、版本信息等…" />
        </div>

        <div className="grid gap-1.5">
          <Label>关键词（可选）</Label>
          <Input value={createKeywords} onChange={(e) => setCreateKeywords(e.target.value)} maxLength={500} placeholder="可用空格/逗号分隔…" />
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        {info ? <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{info}</div> : null}

        {book?.status === "rejected" && book.review?.comment ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">驳回原因</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{book.review.comment}</CardContent>
          </Card>
        ) : null}

        {!editable && book ? (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
            {book.status === "pending"
              ? "待审核状态不可修改。"
              : book.status === "published"
                ? "已发布不可直接修改；请先下架到“已下架”，再编辑并重新提交审核。"
                : "当前状态不可编辑。"}
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">元数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label>ISBN-13（必填）</Label>
              <Input uiSize="sm" value={isbn13} onChange={(e) => setIsbn13(e.target.value)} maxLength={32} disabled={!editable} />
            </div>
            <div className="grid gap-1.5">
              <Label>书名（必填）</Label>
              <Input uiSize="sm" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={!editable} />
            </div>
            <div className="grid gap-1.5">
              <Label>作者（必填）</Label>
              <Input uiSize="sm" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} disabled={!editable} />
            </div>
            <div className="grid gap-1.5">
              <Label>简介（可选）</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} disabled={!editable} />
            </div>
            <div className="grid gap-1.5">
              <Label>关键词（可选）</Label>
              <Input uiSize="sm" value={keywords} onChange={(e) => setKeywords(e.target.value)} maxLength={500} disabled={!editable} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">文件资产（≤ 100MB，每种格式最多 1 份）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {book
              ? (["pdf", "epub", "mobi", "zip"] as const).map((format) => {
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
                            if (!file || !book) return;

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
                              await reloadBook(book.id);
                              setInfo("已上传文件资产");
                              router.refresh();
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
                            disabled={!editable || deletingAssetId === asset.id}
                            onClick={async () => {
                              if (!book) return;
                              setError(null);
                              setInfo(null);
                              setDeletingAssetId(asset.id);
                              try {
                                const next = await deleteMyLibraryBookAsset(book.id, asset.id);
                                setBook(next);
                                setInfo("已删除文件资产");
                                router.refresh();
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
                })
              : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">外链资产</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">添加外链（可多个）</div>
              <div className="text-xs text-muted-foreground">提交审核时会校验 URL 并在同一本书内按规范化 URL 去重。</div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  uiSize="sm"
                  value={newLinkUrl}
                  disabled={!editable || addingLink}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  maxLength={2000}
                  placeholder="https://..."
                />
                <Button
                  size="sm"
                  disabled={!editable || addingLink || !newLinkUrl.trim()}
                  onClick={async () => {
                    if (!book) return;
                    setError(null);
                    setInfo(null);
                    setAddingLink(true);
                    try {
                      const next = await addMyLibraryBookLinkAsset(book.id, { url: newLinkUrl.trim() });
                      setBook(next);
                      setNewLinkUrl("");
                      setInfo("已添加外链");
                      router.refresh();
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
            </div>

            {book ? (
              <div className="space-y-2">
                {listLinkAssets(book.assets).length === 0 ? <div className="text-sm text-muted-foreground">暂无外链</div> : null}
                {listLinkAssets(book.assets).map((a) => (
                  <div key={a.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 text-sm">
                        <div className="truncate font-medium">{a.link?.url ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">规范化：{a.link?.normalizedUrl ?? "—"}</div>
                      </div>
                      {editable ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingAssetId === a.id}
                          onClick={async () => {
                            if (!book) return;
                            setError(null);
                            setInfo(null);
                            setDeletingAssetId(a.id);
                            try {
                              const next = await deleteMyLibraryBookAsset(book.id, a.id);
                              setBook(next);
                              setInfo("已删除外链");
                              router.refresh();
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
            ) : null}
          </CardContent>
        </Card>
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
        title={headerTitle}
        description={props.mode === "create" ? "先创建草稿，再上传 PDF/EPUB/MOBI/ZIP 或添加外链并提交审核。" : book ? book.id : props.bookId}
        error={error}
        contentClassName="max-w-4xl"
        footer={footer}
      >
        {props.mode === "edit" && loading ? <DialogLoadingSkeleton rows={6} /> : null}
        {props.mode === "edit" && !loading && !book && error ? <InlineError message={error} /> : null}
        {props.mode === "edit" && !loading && !book && !error ? <div className="text-sm text-muted-foreground">投稿不存在或不可见</div> : null}
        {props.mode === "edit" && !loading && book ? body : null}
        {props.mode === "create" ? body : null}
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
        open={deleteBookAlertOpen}
        onOpenChange={setDeleteBookAlertOpen}
        title="确认删除该投稿？"
        description="仅草稿/驳回/下架可删；删除为软删且不可恢复。"
        confirmText="删除投稿"
        confirmDisabled={deletingBook}
        onConfirm={async () => {
          if (!book) return;
          setDeleteBookAlertOpen(false);
          setError(null);
          setInfo(null);
          setDeletingBook(true);
          try {
            await deleteMyLibraryBook(book.id);
            toast.success("已删除投稿", { description: book.title });
            props.onRequestClose();
            router.refresh();
          } catch (err) {
            setError(getApiErrorMessage(err, "删除失败"));
          } finally {
            setDeletingBook(false);
          }
        }}
      />
    </>
  );
}
