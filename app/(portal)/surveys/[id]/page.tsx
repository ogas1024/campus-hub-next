import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalSurveyDetail } from "@/lib/modules/surveys/surveys.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { PortalSurveyFillClient } from "@/components/surveys/PortalSurveyFillClient";

type Params = { params: Promise<{ id: string }> };

export default async function SurveyDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const data = await getPortalSurveyDetail({ userId: user.id, surveyId: id });

  const now = new Date();
  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);
  const phase = now.getTime() < startAt.getTime() ? "upcoming" : now.getTime() >= endAt.getTime() ? "closed" : "active";
  const initialSubmittedAt = data.myResponse?.submittedAt ? new Date(data.myResponse.submittedAt).toISOString() : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
          <div className="text-sm text-muted-foreground">
            {formatZhDateTime(startAt)} ~ {formatZhDateTime(endAt)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/surveys">
            ← 返回列表
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {phase === "active" ? <Badge>进行中</Badge> : null}
        {phase === "upcoming" ? <Badge variant="outline">未开始</Badge> : null}
        {phase === "closed" ? <Badge variant="secondary">已结束</Badge> : null}
        {data.anonymousResponses ? <Badge variant="outline">匿名答卷</Badge> : null}
        {data.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">不可提交</Badge>}
      </div>

      {data.descriptionMd?.trim() ? (
        <Card>
          <CardContent className="p-6">
            <NoticeMarkdown contentMd={data.descriptionMd} />
          </CardContent>
        </Card>
      ) : null}

      <PortalSurveyFillClient
        surveyId={data.id}
        canSubmit={data.canSubmit}
        sections={data.sections}
        initialItems={data.myResponse?.items ?? []}
        initialSubmittedAt={initialSubmittedAt}
      />
    </div>
  );
}
