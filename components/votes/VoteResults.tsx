import { Card, CardContent } from "@/components/ui/card";
import type { VoteResults } from "@/lib/modules/votes/votes.analytics";
import { cn } from "@/lib/utils";

type Props = {
  results: VoteResults;
};

function PercentBar({ percent }: { percent: number }) {
  const safe = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-muted">
      <div className="h-full bg-primary" style={{ width: `${safe}%` }} />
    </div>
  );
}

export function VoteResults(props: Props) {
  return (
    <div className="space-y-3">
      {props.results.questions.map((q) => (
        <Card key={q.questionId}>
          <CardContent className="space-y-3 p-6">
            <div className="space-y-1">
              <div className="text-base font-semibold">{q.title}</div>
              <div className="text-sm text-muted-foreground">
                题型：{q.questionType}
                {q.questionType === "multi" ? `（最多选 ${q.maxChoices}）` : ""} · 作答数：{q.answeredCount}
              </div>
            </div>

            <div className="space-y-2">
              {q.options.map((opt) => (
                <div
                  key={opt.optionId}
                  className={cn("space-y-1 rounded-lg border border-border bg-muted p-3 text-sm", opt.count > 0 ? "border-primary/30" : null)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-muted-foreground">
                      {opt.count}（{opt.percent}%）
                    </div>
                  </div>
                  <PercentBar percent={opt.percent} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

