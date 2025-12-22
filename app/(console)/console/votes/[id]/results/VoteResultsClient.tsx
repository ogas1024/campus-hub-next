"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VoteResults } from "@/components/votes/VoteResults";
import { fetchConsoleVoteResults } from "@/lib/api/console-votes";
import { ApiResponseError } from "@/lib/api/http";
import { formatZhDateTime } from "@/lib/ui/datetime";

type Props = {
  voteId: string;
  perms: {
    canUpdate: boolean;
  };
};

export default function VoteResultsClient(props: Props) {
  const id = props.voteId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchConsoleVoteResults>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchConsoleVoteResults(id);
        if (cancelled) return;
        setData(res);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiResponseError ? err.message : "加载失败");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const effectiveStatus = useMemo(() => {
    if (!data) return null;
    if (data.vote.status === "closed") return "closed";
    if (data.vote.status === "draft") return "draft";
    const endAt = new Date(data.vote.endAt);
    return endAt.getTime() <= Date.now() ? "closed" : "published";
  }, [data]);

  if (loading) return <div className="text-sm text-muted-foreground">加载中...</div>;
  if (error) return <InlineError message={error} />;
  if (!data) return <div className="text-sm text-muted-foreground">无数据</div>;

  const startAt = new Date(data.vote.startAt);
  const endAt = new Date(data.vote.endAt);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">投票结果</h1>
          <div className="text-sm text-muted-foreground">{data.vote.title}</div>
          <div className="text-sm text-muted-foreground">
            {formatZhDateTime(startAt)} ~ {formatZhDateTime(endAt)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/votes">
            ← 返回列表
          </Link>
          {props.perms.canUpdate ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/votes/${id}/edit`}>
              编辑
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">参与人数：{data.results.totalResponses}</Badge>
        {data.vote.anonymousResponses ? <Badge variant="outline">匿名投票</Badge> : <Badge variant="secondary">实名投票</Badge>}
        {effectiveStatus === "closed" ? <Badge>已结束</Badge> : <Badge variant="outline">未结束</Badge>}
        {data.vote.archivedAt ? <Badge variant="secondary">已归档</Badge> : null}
      </div>

      {data.questions.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无题目</CardContent>
        </Card>
      ) : (
        <VoteResults results={data.results} />
      )}
    </div>
  );
}

