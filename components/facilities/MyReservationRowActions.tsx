"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineError } from "@/components/common/InlineError";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelMyReservation } from "@/lib/api/me-reservations";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

import { ReservationEditorDialog } from "./ReservationEditorDialog";

type Props = {
  userId: string;
  reservationId: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  startAt: string;
  nowIso: string;
};

export function MyReservationRowActions(props: Props) {
  const key = `${props.reservationId}:${props.status}:${props.startAt}:${props.nowIso}`;
  return <MyReservationRowActionsInner key={key} {...props} />;
}

function MyReservationRowActionsInner(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [resubmitOpen, setResubmitOpen] = useState(false);

  const canCancelByStatus = props.status === "pending" || props.status === "approved";
  const [hasStarted, setHasStarted] = useState(() => {
    const startMs = new Date(props.startAt).getTime();
    const nowMs = new Date(props.nowIso).getTime();
    return Number.isFinite(startMs) && Number.isFinite(nowMs) ? startMs <= nowMs : false;
  });

  useEffect(() => {
    if (!canCancelByStatus) return;
    if (hasStarted) return;
    const startMs = new Date(props.startAt).getTime();
    if (!Number.isFinite(startMs)) return;

    const delayMs = Math.max(0, startMs - Date.now());
    const handle = window.setTimeout(() => setHasStarted(true), delayMs);
    return () => window.clearTimeout(handle);
  }, [canCancelByStatus, hasStarted, props.startAt]);

  const canCancel = canCancelByStatus && !hasStarted;
  const cancelDisabledReason = canCancelByStatus && hasStarted ? "已开始，无法取消" : null;

  const canResubmit = props.status === "rejected";

  async function submitCancel() {
    const ok = await action.run(() => cancelMyReservation(props.reservationId), { fallbackErrorMessage: "取消失败" });
    if (!ok) return;
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <InlineError message={action.error} className="w-full" />

      <div className="flex flex-wrap justify-end gap-2">
        {canResubmit ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setResubmitOpen(true)}>
              修改并重提
            </Button>
            {resubmitOpen ? (
              <ReservationEditorDialog
                userId={props.userId}
                open
                onOpenChange={setResubmitOpen}
                mode="resubmit"
                reservationId={props.reservationId}
                onSuccess={() => router.refresh()}
              />
            ) : null}
          </>
        ) : null}

        {canCancel ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={action.pending}>
                取消
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认取消该预约？</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={action.pending}>返回</AlertDialogCancel>
                <AlertDialogAction disabled={action.pending} onClick={() => void submitCancel()}>
                  确认取消
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : cancelDisabledReason ? (
          <Button size="sm" variant="outline" disabled title={cancelDisabledReason}>
            取消
          </Button>
        ) : null}
      </div>
    </div>
  );
}
