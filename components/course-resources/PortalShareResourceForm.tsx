"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Course, Major, ResourceType } from "@/lib/api/course-resources";
import {
  createMyResourceDraft,
  createMyResourceUploadUrl,
  fetchPortalCourses,
  fetchPortalMajors,
  submitMyResource,
  updateMyResource,
} from "@/lib/api/course-resources";
import { getApiErrorMessage } from "@/lib/api/http";
import { COURSE_RESOURCES_MAX_FILE_SIZE, isAllowedArchiveFileName } from "@/lib/modules/course-resources/courseResources.utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type FixedMode = {
  mode: "fixed";
  major: { id: string; name: string };
  course: { id: string; name: string };
  returnHref: string;
};

type SelectMode = {
  mode: "select";
  returnHref: string;
};

type Props = FixedMode | SelectMode;

async function sha256Hex(file: File) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function PortalShareResourceForm(props: Props) {
  const router = useRouter();

  const [majors, setMajors] = useState<Major[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [majorId, setMajorId] = useState(props.mode === "fixed" ? props.major.id : "");
  const [courseId, setCourseId] = useState(props.mode === "fixed" ? props.course.id : "");

  const [resourceType, setResourceType] = useState<ResourceType>("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(props.mode === "select");
  const [hashing, setHashing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successResourceId, setSuccessResourceId] = useState<string | null>(null);
  const [draftResourceId, setDraftResourceId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (props.mode !== "select") return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchPortalMajors();
        if (cancelled) return;
        setMajors(list);
        const firstMajorId = list[0]?.id ?? "";
        setMajorId(firstMajorId);
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "加载专业列表失败"));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.mode]);

  useEffect(() => {
    if (props.mode !== "select") return;
    let cancelled = false;
    void (async () => {
      if (!majorId) {
        setCourses([]);
        setCourseId("");
        return;
      }

      setError(null);
      try {
        const list = await fetchPortalCourses(majorId);
        if (cancelled) return;
        setCourses(list);
        setCourseId((prev) => (list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? "")));
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "加载课程列表失败"));
        setCourses([]);
        setCourseId("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.mode, majorId]);

  const majorName = props.mode === "fixed" ? props.major.name : majors.find((m) => m.id === majorId)?.name ?? "—";
  const courseName = props.mode === "fixed" ? props.course.name : courses.find((c) => c.id === courseId)?.name ?? "—";

  const canSubmit =
    !!majorId &&
    !!courseId &&
    !!title.trim() &&
    !!description.trim() &&
    (resourceType === "file" ? !!file : !!linkUrl.trim());

  async function doSubmit() {
    setError(null);
    setInfo(null);
    setSuccessResourceId(null);
    setDraftResourceId(null);

    if (!majorId || !courseId) {
      setError("请先选择专业与课程");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("标题与描述不能为空");
      return;
    }

    if (resourceType === "file") {
      if (!file) {
        setError("请选择要上传的文件");
        return;
      }
      if (!isAllowedArchiveFileName(file.name)) {
        setError("仅允许 zip/rar/7z 压缩包");
        return;
      }
      if (file.size <= 0 || file.size > COURSE_RESOURCES_MAX_FILE_SIZE) {
        setError("文件大小必须在 0~200MB 之间");
        return;
      }
    } else if (!linkUrl.trim()) {
      setError("请输入外链 URL");
      return;
    }

    setSubmitting(true);
    try {
      const draft = await createMyResourceDraft({
        majorId,
        courseId,
        resourceType,
        title: title.trim(),
        description: description.trim(),
      });

      setDraftResourceId(draft.id);

      if (resourceType === "link") {
        await updateMyResource(draft.id, { linkUrl: linkUrl.trim() });
      } else {
        setHashing(true);
        let sha256: string;
        try {
          sha256 = await sha256Hex(file!);
        } catch {
          throw new Error("计算 SHA-256 失败");
        } finally {
          setHashing(false);
        }

        const signed = await createMyResourceUploadUrl(draft.id, {
          fileName: file!.name,
          size: file!.size,
          sha256,
        });

        setUploading(true);
        try {
          const supabase = createSupabaseBrowserClient();
          const { error: uploadError } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.key, signed.token, file!);
          if (uploadError) throw new Error(uploadError.message);
        } finally {
          setUploading(false);
        }
      }

      await submitMyResource(draft.id);
      setSuccessResourceId(draft.id);
      setInfo("已提交审核（等待专业负责人/管理员处理）");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "提交失败"));
    } finally {
      setSubmitting(false);
      setHashing(false);
      setUploading(false);
    }
  }

  if (successResourceId) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="text-base font-semibold">提交成功</div>
          <div className="text-sm text-muted-foreground">已进入待审核状态；你可以在“我的投稿”中查看进度。</div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ size: "sm" })} href={props.returnHref}>
              返回
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/me">
              去我的投稿
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/resources/me/${successResourceId}`}>
              查看该投稿
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {props.mode === "fixed" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{majorName}</Badge>
            <Badge variant="secondary">{courseName}</Badge>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>专业</Label>
              <Select value={majorId} onChange={(e) => setMajorId(e.target.value)} disabled={loading || majors.length === 0}>
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
              <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!majorId || courses.length === 0}>
                {courses.length === 0 ? <option value="">该专业暂无课程</option> : null}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>资源类型</Label>
          <Select
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value as ResourceType);
              setError(null);
              setInfo(null);
            }}
          >
            <option value="file">文件（zip/rar/7z，≤200MB）</option>
            <option value="link">外链（URL）</option>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="例如：历年试题（含答案）" />
        </div>

        <div className="grid gap-1.5">
          <Label>描述</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="建议包含：适用范围、来源、内容简介、注意事项…"
          />
        </div>

        {resourceType === "link" ? (
          <div className="grid gap-1.5">
            <Label>外链 URL</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} maxLength={2000} placeholder="https://..." />
            <div className="text-xs text-muted-foreground">提交时会进行 URL 规范化与去重校验；下载将通过下载入口计数并跳转。</div>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
            <div className="text-sm font-medium">文件上传</div>
            <div className="text-xs text-muted-foreground">仅 zip/rar/7z，≤ 200MB；将计算 SHA-256 用于去重。</div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">{file ? `${file.name} · ${Math.ceil(file.size / 1024 / 1024)}MB` : "尚未选择文件"}</div>
              {file ? (
                <Button variant="outline" size="sm" disabled={submitting || hashing || uploading} onClick={() => setFile(null)}>
                  清除
                </Button>
              ) : null}
            </div>
            <input
              type="file"
              accept=".zip,.rar,.7z"
              disabled={submitting || hashing || uploading}
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                e.target.value = "";
                setError(null);
                setInfo(null);
                setFile(picked);
              }}
            />
            {hashing ? <div className="text-xs text-muted-foreground">计算 SHA-256 中…</div> : null}
            {uploading ? <div className="text-xs text-muted-foreground">上传中…</div> : null}
          </div>
        )}

        {draftResourceId && !successResourceId ? (
          <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            已创建草稿：<span className="font-mono">{draftResourceId}</span>。若上传/提交失败，可在{" "}
            <Link className="underline" href={`/resources/me/${draftResourceId}`}>
              我的投稿
            </Link>{" "}
            中继续编辑并提交审核。
          </div>
        ) : null}

        <InlineError message={error} />
        {info ? <div className="text-sm text-muted-foreground">{info}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={!canSubmit || submitting || hashing || uploading} onClick={() => void doSubmit()}>
            {submitting ? "提交中..." : "提交审核"}
          </Button>
          <Link className={buttonVariants({ variant: "outline" })} href={props.returnHref}>
            返回
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
