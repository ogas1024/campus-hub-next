import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalVoteDetail } from "@/lib/modules/votes/votes.service";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { PortalVoteFillClient } from "@/components/votes/PortalVoteFillClient";
import { VoteResults } from "@/components/votes/VoteResults";

type Params = { params: Promise<{ id: string }> };

export default async function VoteDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const data = await getPortalVoteDetail({ userId: user.id, voteId: id });

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
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/votes">
            ← 返回列表
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/votes/my">
            我的投票
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.archivedAt ? <Badge variant="secondary">已归档</Badge> : null}
        {data.pinned ? <Badge>置顶</Badge> : null}
        {phase === "active" ? <Badge>进行中</Badge> : null}
        {phase === "upcoming" ? <Badge variant="outline">未开始</Badge> : null}
        {phase === "closed" ? <Badge variant="secondary">已结束</Badge> : null}
        {data.anonymousResponses ? <Badge variant="outline">匿名投票</Badge> : null}
        {data.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">不可提交</Badge>}
        {data.myResponse ? <Badge variant="outline">已投</Badge> : <Badge variant="secondary">未投</Badge>}
      </div>

      {data.descriptionMd?.trim() ? (
        <Card>
          <CardContent className="p-6">
            <NoticeMarkdown contentMd={data.descriptionMd} />
          </CardContent>
        </Card>
      ) : null}

      <PortalVoteFillClient
        voteId={data.id}
        canSubmit={data.canSubmit}
        questions={data.questions}
        initialItems={data.myResponse?.items ?? []}
        initialSubmittedAt={initialSubmittedAt}
      />

      {data.results ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">投票结果</h2>
            <Badge variant="secondary">参与人数：{data.results.totalResponses}</Badge>
          </div>
          <VoteResults results={data.results} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">投票结束后将展示结果。</CardContent>
        </Card>
      )}
    </div>
  );
}

