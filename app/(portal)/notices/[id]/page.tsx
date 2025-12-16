import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { NoticeReadMarker } from "@/components/notices/NoticeReadMarker";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalNoticeDetail } from "@/lib/modules/notices/notices.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export default async function NoticeDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const notice = await getPortalNoticeDetail({ userId: user.id, noticeId: id });

  return (
    <div className="space-y-6">
      <NoticeReadMarker noticeId={id} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/notices">
          ← 返回列表
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {notice.pinned ? <Badge variant="outline">置顶</Badge> : null}
          {notice.isExpired ? (
            <Badge variant="outline" className="text-zinc-500">
              已过期
            </Badge>
          ) : null}
          {notice.read ? <Badge variant="secondary">已读</Badge> : <Badge>未读</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{notice.title}</CardTitle>
          <div className="text-sm text-zinc-600">
            发布：{formatZhDateTime(notice.publishAt)} · 阅读数：{notice.readCount}
            {notice.expireAt ? ` · 有效至：${formatZhDateTime(notice.expireAt)}` : ""}
          </div>
        </CardHeader>
        <CardContent>
          <NoticeMarkdown contentMd={notice.contentMd} />
        </CardContent>
      </Card>

      {notice.attachments.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">附件</CardTitle>
              <div className="text-sm text-zinc-500">{notice.attachments.length} 个</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notice.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-900">{a.fileName}</div>
                    <div className="text-xs text-zinc-500">{Math.ceil(a.size / 1024)} KB</div>
                  </div>
                  {a.downloadUrl ? (
                    <a
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      href={a.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      下载
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-500">不可用</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
