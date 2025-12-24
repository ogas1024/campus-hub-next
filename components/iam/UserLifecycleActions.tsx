"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { approveUser, banUser, deleteUser, disableUser, enableUser, rejectUser, unbanUser } from "@/lib/api/iam";
import type { UserStatus } from "@/lib/api/iam";
import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  userId: string;
  status: UserStatus;
  canApprove: boolean;
  canDisable: boolean;
  canBan: boolean;
  canDelete: boolean;
};

type ConfirmAction = "approve" | "reject" | "disable" | "enable" | "unban" | "delete";

function getConfirmMeta(action: ConfirmAction) {
  switch (action) {
    case "approve":
      return { title: "通过审核", description: "将用户状态从“待审核”切换为“启用”。", confirmLabel: "通过", variant: "default" as const };
    case "reject":
      return { title: "驳回审核", description: "将用户状态从“待审核”切换为“停用”。", confirmLabel: "驳回", variant: "destructive" as const };
    case "disable":
      return { title: "停用用户", description: "用户将无法正常使用系统（不影响 Auth 账号存在）。", confirmLabel: "停用", variant: "destructive" as const };
    case "enable":
      return { title: "启用用户", description: "将用户状态切换为“启用”。", confirmLabel: "启用", variant: "default" as const };
    case "unban":
      return { title: "解封用户", description: "通过 Supabase Auth Admin API 解除封禁。", confirmLabel: "解封", variant: "default" as const };
    case "delete":
      return { title: "删除用户（软删）", description: "通过 Supabase Auth Admin API 软删除用户。", confirmLabel: "删除", variant: "destructive" as const };
  }
}

export function UserLifecycleActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const available = useMemo(() => {
    const actions: Array<{ id: string; label: string; disabled?: boolean }> = [];

    if (props.status === "pending_approval") {
      if (props.canApprove) actions.push({ id: "approve", label: "通过审核" });
      if (props.canApprove) actions.push({ id: "reject", label: "驳回审核" });
    }

    if (props.status !== "disabled") {
      if (props.canDisable) actions.push({ id: "disable", label: "停用" });
    }
    if (props.status === "disabled") {
      if (props.canDisable) actions.push({ id: "enable", label: "启用" });
    }

    if (props.status === "banned") {
      if (props.canBan) actions.push({ id: "unban", label: "解封" });
    }
    if (props.status !== "banned") {
      if (props.canBan) actions.push({ id: "ban", label: "封禁" });
    }

    if (props.canDelete) actions.push({ id: "delete", label: "删除（软删）" });
    return actions;
  }, [props.status, props.canApprove, props.canBan, props.canDelete, props.canDisable]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [reason, setReason] = useState("");

  const [banOpen, setBanOpen] = useState(false);
  const [banDuration, setBanDuration] = useState("24h");
  const [banReason, setBanReason] = useState("");

  async function run(runAction: () => Promise<unknown>, fallbackMessage: string) {
    const result = await action.run(runAction, { fallbackErrorMessage: fallbackMessage });
    if (result === null) return;
    setConfirmOpen(false);
    setConfirmAction(null);
    setBanOpen(false);
    router.refresh();
  }

  if (available.length === 0) return null;

  const confirmMeta = confirmAction ? getConfirmMeta(confirmAction) : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">操作</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {available.map((a, idx) => {
            const isDestructive = a.id === "delete" || a.id === "disable" || a.id === "reject";
            const item = (
              <DropdownMenuItem
                key={a.id}
                className={isDestructive ? "text-destructive focus:text-destructive" : undefined}
                onSelect={(e) => {
                  e.preventDefault();
                  action.reset();
                  setReason("");
                  if (a.id === "ban") {
                    setBanOpen(true);
                    return;
                  }
                  setConfirmAction(a.id as ConfirmAction);
                  setConfirmOpen(true);
                }}
              >
                {a.label}
              </DropdownMenuItem>
            );

            const nextIsSeparator =
              idx === available.findIndex((x) => x.id === "reject") ||
              idx === available.findIndex((x) => x.id === "enable") ||
              idx === available.findIndex((x) => x.id === "unban");

            return (
              <div key={a.id}>
                {item}
                {nextIsSeparator ? <DropdownMenuSeparator /> : null}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConsoleFormDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmAction(null);
            setReason("");
            action.reset();
          }
          setConfirmOpen(next);
        }}
        title={confirmMeta?.title ?? "确认操作"}
        description={confirmMeta?.description}
        pending={action.pending}
        error={action.error}
        confirmText={confirmMeta?.confirmLabel ?? "确认"}
        confirmVariant={confirmMeta?.variant === "destructive" ? "destructive" : "default"}
        confirmDisabled={!confirmAction}
        onConfirm={() => {
          if (!confirmAction) return;
          const body = reason.trim() ? { reason: reason.trim() } : {};

          if (confirmAction === "approve") void run(() => approveUser(props.userId, body), "通过失败");
          if (confirmAction === "reject") void run(() => rejectUser(props.userId, body), "驳回失败");
          if (confirmAction === "disable") void run(() => disableUser(props.userId, body), "停用失败");
          if (confirmAction === "enable") void run(() => enableUser(props.userId, body), "启用失败");
          if (confirmAction === "unban") void run(() => unbanUser(props.userId, body), "解封失败");
          if (confirmAction === "delete") void run(() => deleteUser(props.userId, { reason: reason.trim() || undefined }), "删除失败");
        }}
      >
        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、处理原因、备注…" />
        </div>
      </ConsoleFormDialog>

      <ConsoleFormDialog
        open={banOpen}
        onOpenChange={(next) => {
          if (!next) {
            setBanDuration("24h");
            setBanReason("");
            action.reset();
          }
          setBanOpen(next);
        }}
        title="封禁用户"
        description="通过 Supabase Auth Admin API 执行封禁（ban_duration）。"
        pending={action.pending}
        error={action.error}
        confirmText="封禁"
        confirmVariant="destructive"
        confirmDisabled={!banDuration.trim()}
        onConfirm={() => {
          void run(
            () => banUser(props.userId, { duration: banDuration.trim(), reason: banReason.trim() ? banReason.trim() : undefined }),
            "封禁失败",
          );
        }}
      >
        <div className="grid gap-2">
          <Label>封禁时长</Label>
          <Input value={banDuration} onChange={(e) => setBanDuration(e.target.value)} placeholder="示例：10m / 2h / 1h30m / 24h / 100y" />
          <div className="flex flex-wrap gap-2">
            {["10m", "2h", "24h", "7d", "30d", "100y"].map((d) => (
              <Button
                key={d}
                type="button"
                variant="outline"
                size="sm"
                disabled={action.pending}
                onClick={() => setBanDuration(d)}
              >
                {d}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="可填写工单号、处理原因、备注…" />
        </div>
      </ConsoleFormDialog>
    </>
  );
}
