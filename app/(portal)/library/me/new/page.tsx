"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMyLibraryBookDraft } from "@/lib/api/library";
import { getApiErrorMessage } from "@/lib/api/http";

export default function NewMyLibraryBookPage() {
  const router = useRouter();
  const [isbn13, setIsbn13] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(() => {
    if (!isbn13.trim()) return false;
    if (!title.trim()) return false;
    if (!author.trim()) return false;
    return true;
  }, [isbn13, title, author]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">新建投稿</h1>
          <p className="text-sm text-muted-foreground">先创建草稿，再上传 PDF/EPUB/MOBI/ZIP 或添加外链并提交审核。</p>
        </div>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/library/me">
          ← 返回
        </Link>
      </div>

      <InlineError message={error} />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-1.5">
            <Label>ISBN-13（必填，全局唯一）</Label>
            <Input value={isbn13} onChange={(e) => setIsbn13(e.target.value)} placeholder="978-7-111-12233-3" maxLength={32} />
            <div className="text-xs text-muted-foreground">支持空格/连字符；入库将规范化为 13 位数字并校验位。</div>
          </div>

          <div className="grid gap-1.5">
            <Label>书名（必填）</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>

          <div className="grid gap-1.5">
            <Label>作者（必填）</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} />
          </div>

          <div className="grid gap-1.5">
            <Label>简介（可选）</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} placeholder="可简要说明内容、适用人群、版本信息等…" />
          </div>

          <div className="grid gap-1.5">
            <Label>关键词（可选）</Label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} maxLength={500} placeholder="可用空格/逗号分隔…" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canCreate || creating}
              onClick={async () => {
                setError(null);
                setCreating(true);
                try {
                  const book = await createMyLibraryBookDraft({
                    isbn13: isbn13.trim(),
                    title: title.trim(),
                    author: author.trim(),
                    summary: summary.trim() ? summary.trim() : null,
                    keywords: keywords.trim() ? keywords.trim() : null,
                  });
                  router.push(`/library/me/${book.id}`);
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

            <Link className={buttonVariants({ variant: "outline" })} href="/library">
              先去浏览
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

