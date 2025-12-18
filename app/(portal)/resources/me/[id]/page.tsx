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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Course, CourseResourceDetail, Major, ResourceStatus, ResourceType } from "@/lib/api/course-resources";
import {
  createMyResourceUploadUrl,
  deleteMyResource,
  fetchMyResourceDetail,
  fetchPortalCourses,
  fetchPortalMajors,
  submitMyResource,
  unpublishMyResource,
  updateMyResource,
} from "@/lib/api/course-resources";
import { ApiResponseError, getApiErrorMessage } from "@/lib/api/http";

const MAX_SIZE = 200 * 1024 * 1024;

function statusMeta(status: ResourceStatus) {
  switch (status) {
    case "draft":
      return { label: "草稿", className: "bg-muted text-muted-foreground" };
    case "pending":
      return { label: "待审核", className: "bg-amber-500/10 text-amber-700" };
    case "published":
      return { label: "已发布", className: "bg-emerald-500/10 text-emerald-700" };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-500/10 text-rose-700" };
    case "unpublished":
      return { label: "已下架", className: "bg-muted text-muted-foreground" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

function typeLabel(type: ResourceType) {
  return type === "file" ? "文件" : "外链";
}

function isAllowedExt(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z");
}

async function sha256Hex(file: File) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function EditMyResourcePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [resource, setResource] = useState<CourseResourceDetail | null>(null);
  const [majors, setMajors] = useState<Major[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [majorId, setMajorId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hashing, setHashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const editable = useMemo(() => {
    const status = resource?.status;
    return status === "draft" || status === "rejected" || status === "unpublished";
  }, [resource?.status]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        const [detail, majorList] = await Promise.all([fetchMyResourceDetail(id), fetchPortalMajors()]);
        if (cancelled) return;

        setResource(detail);
        setMajors(majorList);

        setMajorId(detail.majorId);
        setCourseId(detail.courseId);
        setResourceType(detail.resourceType);
        setTitle(detail.title);
        setDescription(detail.description);
        setLinkUrl(detail.link?.url ?? "");

        const courseList = await fetchPortalCourses(detail.majorId);
        if (cancelled) return;
        setCourses(courseList);
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "加载资源详情失败"));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!majorId) return;
      try {
        const list = await fetchPortalCourses(majorId);
        if (cancelled) return;
        setCourses(list);
        setCourseId((prev) => (list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? "")));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiResponseError ? err.message : "加载课程列表失败");
        setCourses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [majorId]);

  const canSave = useMemo(() => {
    if (!editable) return false;
    if (!majorId || !courseId) return false;
    if (!title.trim() || !description.trim()) return false;
    if (resourceType === "link" && linkUrl.trim().length === 0) return true;
    return true;
  }, [editable, majorId, courseId, title, description, resourceType, linkUrl]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (!resource) {
    return (
      <div className="space-y-3">
        <InlineError message={error ?? "资源不存在或不可见"} />
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/me">
          ← 返回
        </Link>
      </div>
    );
  }

  const meta = statusMeta(resource.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">编辑投稿</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className={["rounded-full px-2 py-0.5 text-xs font-medium", meta.className].join(" ")}>{meta.label}</span>
            <Badge variant="secondary">{typeLabel(resource.resourceType)}</Badge>
            <Badge variant="outline">下载 {resource.downloadCount}</Badge>
            {resource.isBest ? <Badge>最佳</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/resources/${resource.id}`}>
            查看已发布页
          </Link>
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/resources/me">
            ← 返回
          </Link>
        </div>
      </div>

      <InlineError message={error} />
      {info ? <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{info}</div> : null}

      {resource.status === "rejected" && resource.review?.comment ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">驳回原因</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{resource.review.comment}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-1.5">
            <Label>专业</Label>
            <Select value={majorId} onChange={(e) => setMajorId(e.target.value)} disabled={!editable}>
              {majors.length === 0 ? <option value="">暂无专业</option> : null}
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>课程</Label>
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!editable || !majorId || courses.length === 0}>
              {courses.length === 0 ? <option value="">该专业暂无课程</option> : null}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>资源类型</Label>
            <Select value={resourceType} onChange={(e) => setResourceType(e.target.value as ResourceType)} disabled={!editable}>
              <option value="file">文件（zip/rar/7z）</option>
              <option value="link">外链（URL）</option>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={!editable} />
          </div>

          <div className="grid gap-1.5">
            <Label>描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={!editable} />
          </div>

          {resourceType === "link" ? (
            <div className="grid gap-1.5">
              <Label>外链 URL</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} maxLength={2000} disabled={!editable} placeholder="https://..." />
              <div className="text-xs text-muted-foreground">提交审核时会进行规范化与去重校验；下载会通过下载入口计数并跳转。</div>
            </div>
          ) : null}

          {resourceType === "file" ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
              <div className="text-sm font-medium">文件上传（≤ 200MB，仅 zip/rar/7z）</div>
              <div className="text-xs text-muted-foreground">
                {resource.file ? (
                  <>
                    当前：{resource.file.fileName} · {Math.ceil(resource.file.size / 1024 / 1024)}MB
                  </>
                ) : (
                  "尚未上传"
                )}
              </div>
              <input
                type="file"
                accept=".zip,.rar,.7z"
                disabled={!editable || uploading || hashing}
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!file) return;
                  setError(null);
                  setInfo(null);

                  if (!isAllowedExt(file.name)) {
                    setError("仅允许 zip/rar/7z 压缩包");
                    return;
                  }
                  if (file.size <= 0 || file.size > MAX_SIZE) {
                    setError("文件大小必须在 0~200MB 之间");
                    return;
                  }

                  setHashing(true);
                  let hash: string;
                  try {
                    hash = await sha256Hex(file);
                  } catch {
                    setError("计算 SHA-256 失败");
                    setHashing(false);
                    return;
                  } finally {
                    setHashing(false);
                  }

                  setUploading(true);
                  try {
                    const signed = await createMyResourceUploadUrl(resource.id, { fileName: file.name, size: file.size, sha256: hash });
                    const supabase = createSupabaseBrowserClient();
                    const { error: uploadError } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.key, signed.token, file);
                    if (uploadError) throw new Error(uploadError.message);
                    setInfo("上传完成（可继续编辑并提交审核）");
                    const refreshed = await fetchMyResourceDetail(resource.id);
                    setResource(refreshed);
                  } catch (err) {
                    setError(getApiErrorMessage(err, "上传失败"));
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              {hashing ? <div className="text-xs text-muted-foreground">计算 SHA-256 中…</div> : null}
              {uploading ? <div className="text-xs text-muted-foreground">上传中…</div> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canSave || saving}
              onClick={async () => {
                setError(null);
                setInfo(null);
                setSaving(true);
                try {
                  const body: Parameters<typeof updateMyResource>[1] = {
                    majorId,
                    courseId,
                    title: title.trim(),
                    description: description.trim(),
                    resourceType,
                  };
                  if (resourceType === "link") body.linkUrl = linkUrl.trim() ? linkUrl.trim() : null;

                  const updated = await updateMyResource(resource.id, body);
                  setResource(updated);
                  setInfo("已保存");
                } catch (err) {
                  setError(getApiErrorMessage(err, "保存失败"));
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
                    const next = await submitMyResource(resource.id);
                    setResource(next);
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

            {resource.status === "published" ? (
              <Button
                variant="outline"
                onClick={async () => {
                  setError(null);
                  setInfo(null);
                  try {
                    const next = await unpublishMyResource(resource.id);
                    setResource(next);
                    setInfo("已下架");
                  } catch (err) {
                    setError(getApiErrorMessage(err, "下架失败"));
                  }
                }}
              >
                下架
              </Button>
            ) : null}

            {editable ? (
              <Button
                variant="destructive"
                onClick={async () => {
                  const ok = window.confirm("确认删除该资源？（仅草稿/驳回/下架可删）");
                  if (!ok) return;
                  setError(null);
                  setInfo(null);
                  try {
                    await deleteMyResource(resource.id);
                    router.push("/resources/me");
                  } catch (err) {
                    setError(getApiErrorMessage(err, "删除失败"));
                  }
                }}
              >
                删除
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
