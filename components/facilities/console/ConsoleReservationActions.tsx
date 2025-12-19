/**
 * 用法：
 * - Console 预约列表中的审核操作按钮组（通过/驳回）。
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveConsoleFacilityReservation, rejectConsoleFacilityReservation, type ReservationStatus } from "@/lib/api/console-facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  reservationId: string;
  status: ReservationStatus;
};

export function ConsoleReservationActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const canReview = props.status === "pending";

  async function approve() {
    const ok = await action.run(() => approveConsoleFacilityReservation(props.reservationId), { fallbackErrorMessage: "通过失败" });
    if (!ok) return;
    router.refresh();
  }

  async function reject() {
    const reason = rejectReason.trim();
    if (!reason) return;
    const ok = await action.run(() => rejectConsoleFacilityReservation(props.reservationId, { reason }), { fallbackErrorMessage: "驳回失败" });
    if (!ok) return;
    setRejectOpen(false);
    router.refresh();
  }

  if (!canReview) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" disabled={action.pending} onClick={() => void approve()}>
        通过
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={action.pending}
        onClick={() => {
          action.reset();
          setRejectReason("");
          setRejectOpen(true);
        }}
      >
        驳回
      </Button>

      <ConsoleFormDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="驳回预约"
        description="驳回原因将写入预约记录并对申请人可见。"
        pending={action.pending}
        error={action.error}
        confirmText="确认驳回"
        confirmVariant="destructive"
        confirmDisabled={!rejectReason.trim()}
        onConfirm={() => void reject()}
      >
        <div className="grid gap-2">
          <Label>驳回原因（必填）</Label>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="请说明冲突/不符合用途/材料不齐等原因…" />
        </div>
      </ConsoleFormDialog>
    </div>
  );
}

