import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { LostfoundMyActions } from "@/components/lostfound/LostfoundMyActions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePortalUser } from "@/lib/auth/guards";
import { getMyLostfoundDetail } from "@/lib/modules/lostfound/lostfound.service";
import { LOSTFOUND_CONTACT_INFO_HINT } from "@/lib/modules/lostfound/lostfound.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

type Params = { params: Promise<{ id: string }> };

function statusMeta(status: string) {
  switch (status) {
    case "pending":
      return { label: "待审核", className: "bg-amber-500/10 text-amber-700" };
    case "published":
      return { label: "已发布", className: "bg-emerald-500/10 text-emerald-700" };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-500/10 text-rose-700" };
    case "offline":
      return { label: "已下架", className: "bg-muted text-muted-foreground" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

function typeLabel(type: string) {
  return type === "lost" ? "丢失" : type === "found" ? "拾到" : type;
}

export default async function LostfoundMyDetailPage({ params }: Params) {
  const user = await requirePortalUser();
  const { id } = await params;

  const data = await getMyLostfoundDetail({ userId: user.id, itemId: id });
  const status = statusMeta(data.status);

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.title}
        description={`创建：${formatZhDateTime(data.createdAt)} · 发布：${formatZhDateTime(data.publishedAt)} · 时间：${formatZhDateTime(data.occurredAt)}`}
        meta={
          <>
            <Badge variant="outline">{typeLabel(data.type)}</Badge>
            <span className={["rounded-full px-2 py-0.5 text-xs font-medium", status.className].join(" ")}>{status.label}</span>
            {data.solvedAt ? <Badge variant="secondary">已解决</Badge> : null}
            <Badge variant="secondary">地点：{data.location ?? "—"}</Badge>
          </>
        }
        actions={
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/lostfound/me">
            ← 返回
          </Link>
        }
      />

      {data.rejectReason ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">驳回原因：{data.rejectReason}</CardContent>
        </Card>
      ) : null}

      {data.offlineReason ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">下架原因：{data.offlineReason}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">正文</div>
            <div className="text-sm leading-7 whitespace-pre-wrap">{data.content}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">联系方式</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{data.contactInfo ?? "未提供"}</div>
            <div className="text-xs text-muted-foreground">{LOSTFOUND_CONTACT_INFO_HINT}</div>
          </div>
        </CardContent>
      </Card>

      {data.images.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="text-sm font-medium">图片</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.images.map((img) => (
                <a key={img.key} href={img.signedUrl} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.signedUrl} alt="" className="h-56 w-full rounded-xl border border-border object-cover" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">操作</div>
            <LostfoundMyActions id={data.id} status={data.status} solvedAt={data.solvedAt ? data.solvedAt.toISOString() : null} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
