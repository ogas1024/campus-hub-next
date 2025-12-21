"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SignedImage } from "@/lib/api/lostfound";
import { createMyLostfound, updateMyLostfound, uploadMyLostfoundImage } from "@/lib/api/me-lostfound";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import {
  LOSTFOUND_CONTACT_INFO_HINT,
  LOSTFOUND_MAX_IMAGES,
} from "@/lib/modules/lostfound/lostfound.ui";
import { cn } from "@/lib/utils";

type Mode = "create" | "edit";

type EditorDraft = {
  type: "lost" | "found";
  title: string;
  content: string;
  location: string;
  occurredAtLocal: string;
  contactInfo: string;
};

type Props = {
  mode: Mode;
  itemId?: string;
  initial?: {
    type: "lost" | "found";
    title: string;
    content: string;
    location: string | null;
    occurredAt: string | null;
    contactInfo: string | null;
    images: SignedImage[];
  };
  returnHref?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export function LostfoundEditorClient(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [draft, setDraft] = useState<EditorDraft>(() => {
    const init = props.initial;
    return {
      type: init?.type ?? "lost",
      title: init?.title ?? "",
      content: init?.content ?? "",
      location: init?.location ?? "",
      occurredAtLocal: init?.occurredAt ? toLocalInputValue(init.occurredAt) : "",
      contactInfo: init?.contactInfo ?? "",
    };
  });

  const [images, setImages] = useState<SignedImage[]>(() => props.initial?.images ?? []);
  const [uploadHint, setUploadHint] = useState<string | null>(null);

  const remainingSlots = useMemo(() => Math.max(0, LOSTFOUND_MAX_IMAGES - images.length), [images.length]);
  const backHref = props.returnHref ?? "/lostfound/me";

  function removeImage(key: string) {
    setImages((prev) => prev.filter((img) => img.key !== key));
  }

  async function handleUpload(list: FileList | null) {
    if (!list || list.length === 0) return;
    action.reset();
    setUploadHint(null);

    if (remainingSlots <= 0) {
      action.setError(`最多上传 ${LOSTFOUND_MAX_IMAGES} 张图片`);
      return;
    }

    const selectedFiles = Array.from(list);
    const toUpload = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      setUploadHint(`本次仅会上传前 ${remainingSlots} 张，已忽略 ${selectedFiles.length - remainingSlots} 张。`);
    }

    for (const file of toUpload) {
      const res = await action.run(() => uploadMyLostfoundImage(file), { fallbackErrorMessage: "上传失败" });
      if (!res) break;
      setImages((prev) => [...prev, res]);
    }
  }

  async function submit() {
    action.reset();
    setUploadHint(null);

    const title = draft.title.trim();
    const content = draft.content.trim();
    if (title.length < 2) {
      action.setError("标题至少 2 个字符");
      return;
    }
    if (content.length < 5) {
      action.setError("正文至少 5 个字符");
      return;
    }

    const body = {
      type: draft.type,
      title,
      content,
      location: draft.location.trim() ? draft.location.trim() : null,
      occurredAt: toIsoOrNull(draft.occurredAtLocal),
      contactInfo: draft.contactInfo.trim() ? draft.contactInfo.trim() : null,
      imageKeys: images.map((img) => img.key),
    };

    if (props.mode === "create") {
      const res = await action.run(() => createMyLostfound(body), { fallbackErrorMessage: "发布失败" });
      if (!res) return;
      router.push(backHref);
      router.refresh();
      return;
    }

    if (!props.itemId) {
      action.setError("缺少 itemId");
      return;
    }

    const ok = await action.run(() => updateMyLostfound(props.itemId!, body), { fallbackErrorMessage: "保存失败" });
    if (!ok) return;
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{props.mode === "create" ? "发布失物招领" : "编辑失物招领"}</h1>
          <p className="text-sm text-muted-foreground">
            {props.mode === "create"
              ? "提交后进入待审核，审核通过后才会公开展示。"
              : "保存后将重新进入待审核（不支持编辑已下架/已解决条目）。"}
          </p>
        </div>
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={backHref}>
          ← 返回
        </Link>
      </div>

      {action.error ? <InlineError message={action.error} /> : null}
      {uploadHint ? <div className="text-xs text-muted-foreground">{uploadHint}</div> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>类型</Label>
              <Select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as EditorDraft["type"] }))}>
                <option value="lost">丢失</option>
                <option value="found">拾到</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>时间（可选）</Label>
              <Input
                type="datetime-local"
                value={draft.occurredAtLocal}
                onChange={(e) => setDraft((p) => ({ ...p, occurredAtLocal: e.target.value }))}
                placeholder="yyyy-mm-ddThh:mm"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>标题</Label>
            <Input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} maxLength={50} required />
            <div className="text-xs text-muted-foreground">2~50 字</div>
          </div>

          <div className="grid gap-1.5">
            <Label>正文</Label>
            <Textarea value={draft.content} onChange={(e) => setDraft((p) => ({ ...p, content: e.target.value }))} maxLength={2000} rows={8} required />
            <div className="text-xs text-muted-foreground">5~2000 字</div>
          </div>

          <div className="grid gap-1.5">
            <Label>地点（可选）</Label>
            <Input value={draft.location} onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))} maxLength={100} />
            <div className="text-xs text-muted-foreground">≤100 字</div>
          </div>

          <div className="grid gap-1.5">
            <Label>联系方式（可选）</Label>
            <Input value={draft.contactInfo} onChange={(e) => setDraft((p) => ({ ...p, contactInfo: e.target.value }))} maxLength={50} />
            <div className="text-xs text-muted-foreground">{LOSTFOUND_CONTACT_INFO_HINT}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">图片（可选）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              已上传 {images.length} / {LOSTFOUND_MAX_IMAGES}
            </span>
            <span>·</span>
            <span>单张 ≤2MB，JPG/PNG/WEBP</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <div key={img.key} className="overflow-hidden rounded-xl border border-border bg-card">
                <a href={img.signedUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.signedUrl} alt="" className="h-40 w-full object-cover" />
                </a>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs text-muted-foreground">{img.key.split("/").pop() ?? img.key}</div>
                  </div>
                  <Button size="sm" variant="outline" disabled={action.pending} onClick={() => removeImage(img.key)} className="h-8 px-2 text-xs">
                    移除
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className={cn("flex flex-wrap items-center gap-2", images.length === 0 ? "pt-1" : "pt-2")}>
            <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), action.pending ? "pointer-events-none opacity-60" : null)}>
              选择图片上传
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleUpload(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {remainingSlots <= 0 ? <span className="text-xs text-muted-foreground">已达到上限</span> : null}
          </div>

          <div className="text-xs text-muted-foreground">
            说明：本页上传成功后即写入存储；若你最终未提交，图片可能会成为“孤儿对象”（后续可做清理任务）。
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Link className={buttonVariants({ variant: "outline" })} href={backHref}>
          取消
        </Link>
        <Button disabled={action.pending} onClick={() => void submit()}>
          {props.mode === "create" ? "提交审核" : "保存并重新提交审核"}
        </Button>
      </div>
    </div>
  );
}

