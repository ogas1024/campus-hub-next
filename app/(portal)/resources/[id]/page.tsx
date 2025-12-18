import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalResourceDetail } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

function formatSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "—";
  const mb = size / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
}

function typeLabel(type: string) {
  return type === "file" ? "文件" : type === "link" ? "外链" : type;
}

export default async function ResourceDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const resource = await getPortalResourceDetail({ userId: user.id, resourceId: id });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/resources">
          ← 返回列表
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {resource.isBest ? <Badge>最佳</Badge> : null}
          <Badge variant="secondary">{typeLabel(resource.resourceType)}</Badge>
          <Badge variant="outline">下载 {resource.downloadCount}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{resource.title}</CardTitle>
          <div className="text-sm text-muted-foreground">仅展示已发布资源；下载会计数并跳转。</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">{resource.description}</div>

          <div className="flex flex-wrap items-center gap-2">
            <form action={`/api/resources/${resource.id}/download`} method="POST" target="_blank">
              <button className={buttonVariants()} type="submit">
                下载
              </button>
            </form>
            <Link className={buttonVariants({ variant: "outline" })} href="/resources/me">
              去投稿
            </Link>
          </div>

          {resource.file ? (
            <div className="rounded-lg border border-border bg-muted p-4 text-sm">
              <div className="font-medium">文件信息</div>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <div>文件名：{resource.file.fileName}</div>
                <div>大小：{formatSize(resource.file.size)}</div>
                <div className="break-all">SHA-256：{resource.file.sha256}</div>
              </div>
            </div>
          ) : null}

          {resource.link ? (
            <div className="rounded-lg border border-border bg-muted p-4 text-sm">
              <div className="font-medium">外链信息</div>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <div className="break-all">原始：{resource.link.url}</div>
                <div className="break-all">规范化：{resource.link.normalizedUrl}</div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

