import Link from "next/link";
import { redirect } from "next/navigation";

import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalMaterialDetail } from "@/lib/modules/materials/materials.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { PortalMaterialSubmitClient } from "@/components/materials/PortalMaterialSubmitClient";

type Params = { params: Promise<{ id: string }> };

export default async function MaterialDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const data = await getPortalMaterialDetail({ userId: user.id, materialId: id });

  const initialDetail = {
    ...data,
    dueAt: data.dueAt ? data.dueAt.toISOString() : null,
    mySubmission: data.mySubmission
      ? {
          ...data.mySubmission,
          submittedAt: data.mySubmission.submittedAt ? data.mySubmission.submittedAt.toISOString() : null,
          withdrawnAt: data.mySubmission.withdrawnAt ? data.mySubmission.withdrawnAt.toISOString() : null,
        }
      : null,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
          <div className="text-sm text-muted-foreground">{data.dueAt ? `截止：${formatZhDateTime(data.dueAt)}` : "—"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/materials">
            ← 返回列表
          </Link>
          {data.notice ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/notices/${data.notice.id}`}>
              查看公告
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">不可提交</Badge>}
        {data.status === "closed" ? <Badge variant="secondary">已关闭</Badge> : null}
        {data.notice ? <Badge variant="outline">关联公告</Badge> : null}
      </div>

      {data.descriptionMd?.trim() ? (
        <Card>
          <CardContent className="p-6">
            <NoticeMarkdown contentMd={data.descriptionMd} />
          </CardContent>
        </Card>
      ) : null}

      <PortalMaterialSubmitClient materialId={data.id} initialDetail={initialDetail} />
    </div>
  );
}

