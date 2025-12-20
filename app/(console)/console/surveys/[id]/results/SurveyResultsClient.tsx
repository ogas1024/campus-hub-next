"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchConsoleSurveyAiSummary, fetchConsoleSurveyResults, buildConsoleSurveyExportUrl } from "@/lib/api/console-surveys";
import { ApiResponseError } from "@/lib/api/http";
import { formatZhDateTime } from "@/lib/ui/datetime";

type Props = {
  surveyId: string;
  perms: {
    canUpdate: boolean;
    canExport: boolean;
    canAiSummary: boolean;
  };
};

export default function SurveyResultsClient(props: Props) {
  const id = props.surveyId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchConsoleSurveyResults>> | null>(null);

  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchConsoleSurveyResults(id);
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
    if (data.survey.status === "closed") return "closed";
    if (data.survey.status === "draft") return "draft";
    const endAt = new Date(data.survey.endAt);
    return endAt.getTime() <= Date.now() ? "closed" : "published";
  }, [data]);

  async function doAiSummary() {
    setAiError(null);
    setAiMarkdown(null);
    setAiPending(true);
    try {
      const res = await fetchConsoleSurveyAiSummary(id);
      setAiMarkdown(res.markdown);
    } catch (err) {
      setAiError(err instanceof ApiResponseError ? err.message : "生成失败");
    } finally {
      setAiPending(false);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">加载中...</div>;
  if (error) return <InlineError message={error} />;
  if (!data) return <div className="text-sm text-muted-foreground">无数据</div>;

  const startAt = new Date(data.survey.startAt);
  const endAt = new Date(data.survey.endAt);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">问卷结果</h1>
          <div className="text-sm text-muted-foreground">{data.survey.title}</div>
          <div className="text-sm text-muted-foreground">
            {formatZhDateTime(startAt)} ~ {formatZhDateTime(endAt)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/surveys">
            ← 返回列表
          </Link>
          {props.perms.canUpdate ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/surveys/${id}/edit`}>
              编辑
            </Link>
          ) : null}
          {props.perms.canExport ? (
            <a className={buttonVariants({ variant: "outline", size: "sm" })} href={buildConsoleSurveyExportUrl(id)}>
              导出 CSV
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">答卷数：{data.results.totalResponses}</Badge>
        {data.survey.anonymousResponses ? <Badge variant="outline">匿名答卷</Badge> : <Badge variant="secondary">实名答卷</Badge>}
        {effectiveStatus === "closed" ? <Badge>已结束</Badge> : <Badge variant="outline">未结束</Badge>}
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-base font-semibold">AI 总结（Markdown）</div>
              <div className="text-sm text-muted-foreground">开放题原文会按样本抽样发送给 AI；本结果不落库。</div>
            </div>
            <Button
              size="sm"
              disabled={aiPending || !props.perms.canAiSummary || effectiveStatus !== "closed"}
              onClick={() => void doAiSummary()}
              title={
                !props.perms.canAiSummary
                  ? "无权限：campus:survey:ai_summary"
                  : effectiveStatus !== "closed"
                    ? "问卷结束后才允许生成 AI 总结"
                    : undefined
              }
            >
              {aiPending ? "生成中..." : "生成 AI 总结"}
            </Button>
          </div>

          {aiError ? <InlineError message={aiError} /> : null}

          {aiMarkdown ? (
            <div className="rounded-lg border border-border bg-background p-4">
              <NoticeMarkdown contentMd={aiMarkdown} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">尚未生成</div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data.results.questions.map((q) => (
          <Card key={q.questionId}>
            <CardContent className="space-y-3 p-6">
              <div className="space-y-1">
                <div className="text-base font-semibold">{q.sectionTitle ? `${q.sectionTitle} / ` : ""}{q.title}</div>
                <div className="text-sm text-muted-foreground">
                  题型：{q.questionType} · 作答数：{q.answeredCount}
                </div>
              </div>

              {q.questionType === "rating" ? (
                <div className="space-y-2">
                  <div className="text-sm">平均分：{q.avg ?? "—"}</div>
                  <div className="grid gap-2 md:grid-cols-5">
                    {q.distribution.map((d) => (
                      <div key={d.value} className="rounded-lg border border-border bg-muted p-3 text-sm">
                        <div className="font-medium">{d.value}</div>
                        <div className="text-muted-foreground">{d.count}（{d.percent}%）</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {q.questionType === "single" || q.questionType === "multi" ? (
                <div className="space-y-2">
                  {q.options.length === 0 ? (
                    <div className="text-sm text-muted-foreground">无选项</div>
                  ) : (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <div key={opt.optionId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3 text-sm">
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-muted-foreground">{opt.count}（{opt.percent}%）</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {q.questionType === "text" ? (
                <div className="space-y-2">
                  {q.samples.length === 0 ? (
                    <div className="text-sm text-muted-foreground">暂无样本（仅展示抽样）</div>
                  ) : (
                    <div className="space-y-2">
                      {q.samples.slice(0, 30).map((s, idx) => (
                        <div key={idx} className="rounded-lg border border-border bg-muted p-3 text-sm">
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
