"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { PortalSurveyFillFormFields } from "@/components/surveys/PortalSurveyFillFormFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { formatZhDateTime } from "@/lib/ui/datetime";

import { usePortalSurveyFill } from "./usePortalSurveyFill";

type Props = {
  open: boolean;
  surveyId: string;
  onRequestClose: () => void;
};

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function PortalSurveyFillDialog(props: Props) {
  const router = useRouter();
  const fill = usePortalSurveyFill({ open: props.open, surveyId: props.surveyId });
  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);

  const activeSurveyId = props.surveyId.trim();
  const detail = fill.detail && activeSurveyId && fill.detail.id === activeSurveyId ? fill.detail : null;
  const optimisticLoading = props.open && !!activeSurveyId && !detail && !fill.error;
  const loading = fill.loading || optimisticLoading;

  const startAt = detail ? safeDate(detail.startAt) : null;
  const endAt = detail ? safeDate(detail.endAt) : null;
  const now = new Date();
  const phase = (() => {
    if (!detail) return null;
    if (detail.effectiveStatus === "closed") return "closed" as const;
    if (startAt && now.getTime() < startAt.getTime()) return "upcoming" as const;
    return "active" as const;
  })();

  function phaseLabel(value: typeof phase) {
    if (value === "active") return <Badge>进行中</Badge>;
    if (value === "upcoming") return <Badge variant="outline">未开始</Badge>;
    if (value === "closed") return <Badge variant="secondary">已结束</Badge>;
    return null;
  }

  function requestClose() {
    if (fill.dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  const totalQuestions = detail ? detail.sections.reduce((acc, s) => acc + s.questions.length, 0) : 0;

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button variant="outline" disabled={fill.pending} onClick={() => requestClose()}>
        关闭
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          disabled={loading || !detail || fill.readOnly || fill.pending || totalQuestions === 0}
          onClick={async () => {
            const hadSubmitted = !!fill.submittedAt;
            const ok = await fill.submit();
            if (!ok) return;
            toast.success(hadSubmitted ? "已保存修改" : "已提交", { description: detail ? detail.title : undefined });
            router.refresh();
          }}
        >
          {fill.pending ? "提交中..." : fill.submittedAt ? "保存修改（覆盖提交）" : "提交"}
        </Button>
      </div>
    </div>
  );

  const body = loading ? (
    <DialogLoadingSkeleton rows={7} />
  ) : !detail ? (
    <div className="text-sm text-muted-foreground">问卷不存在或不可见</div>
  ) : (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {phaseLabel(phase)}
        {detail.anonymousResponses ? <Badge variant="outline">匿名答卷</Badge> : null}
        {fill.submittedAt ? <Badge variant="outline">已提交</Badge> : <Badge variant="secondary">未提交</Badge>}
        {detail.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">只读</Badge>}
      </div>

      {detail.descriptionMd?.trim() ? (
        <Card>
          <CardContent className="p-6">
            <NoticeMarkdown contentMd={detail.descriptionMd} />
          </CardContent>
        </Card>
      ) : null}

      <PortalSurveyFillFormFields
        sections={detail.sections}
        answers={fill.answers}
        readOnly={fill.readOnly}
        pending={fill.pending}
        onAnswerChange={fill.setAnswer}
        onError={fill.setError}
      />
    </>
  );

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        title={detail ? detail.title : "问卷"}
        description={detail ? `${formatZhDateTime(startAt)} ~ ${formatZhDateTime(endAt)}` : props.surveyId}
        error={fill.error}
        footer={footer}
        contentClassName="max-w-4xl"
      >
        {body}
      </StickyFormDialog>

      <UnsavedChangesAlertDialog
        open={unsavedAlertOpen}
        onOpenChange={setUnsavedAlertOpen}
        onDiscard={() => {
          setUnsavedAlertOpen(false);
          props.onRequestClose();
        }}
      />
    </>
  );
}
