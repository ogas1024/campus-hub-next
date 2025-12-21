import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalLostfoundDetail } from "@/lib/modules/lostfound/lostfound.service";
import { LOSTFOUND_CONTACT_INFO_HINT } from "@/lib/modules/lostfound/lostfound.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

type Params = { params: Promise<{ id: string }> };

function typeLabel(type: string) {
  return type === "lost" ? "丢失" : type === "found" ? "拾到" : type;
}

export default async function LostfoundDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const data = await getPortalLostfoundDetail({ itemId: id });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
          <div className="text-sm text-muted-foreground">
            发布：{formatZhDateTime(data.publishedAt)} · 时间：{formatZhDateTime(data.occurredAt)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/lostfound">
            ← 返回列表
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{typeLabel(data.type)}</Badge>
        {data.solvedAt ? <Badge variant="secondary">已解决</Badge> : null}
        <Badge variant="secondary">地点：{data.location ?? "—"}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
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
          <CardContent className="space-y-3 p-6">
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
    </div>
  );
}

