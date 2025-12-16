import Link from "next/link";
import { redirect } from "next/navigation";

import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { NoticeReadMarker } from "@/components/notices/NoticeReadMarker";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalNoticeDetail } from "@/lib/modules/notices/notices.service";

type Params = { params: Promise<{ id: string }> };

export default async function NoticeDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const notice = await getPortalNoticeDetail({ userId: user.id, noticeId: id });

  return (
    <div className="space-y-6">
      <NoticeReadMarker noticeId={id} />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Link className="text-sm text-zinc-600 hover:text-zinc-900" href="/notices">
            ← 返回列表
          </Link>
          {notice.isExpired ? (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">已过期</span>
          ) : null}
        </div>

        <h1 className="text-2xl font-semibold leading-9">{notice.title}</h1>
        <div className="text-sm text-zinc-600">
          发布：{notice.publishAt ? new Date(notice.publishAt).toLocaleString() : "—"} · 阅读数：{notice.readCount}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <NoticeMarkdown contentMd={notice.contentMd} />
      </div>

      {notice.attachments.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-3 text-sm font-semibold">附件</div>
          <div className="space-y-2">
            {notice.attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm">{a.fileName}</div>
                  <div className="text-xs text-zinc-500">{Math.ceil(a.size / 1024)} KB</div>
                </div>
                {a.downloadUrl ? (
                  <a
                    className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
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
        </div>
      ) : null}
    </div>
  );
}

