/**
 * 用法：
 * - Console 功能房模块配置卡片（由 `/console/facilities/config` 引用）。
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { InlineError } from "@/components/common/InlineError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { updateConsoleFacilityConfig } from "@/lib/api/console-facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  auditRequired: boolean;
  maxDurationHours: number;
};

export function FacilityConfigCard(props: Props) {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "保存失败" });

  const [auditRequired, setAuditRequired] = useState(props.auditRequired);
  const [maxDurationHours, setMaxDurationHours] = useState(props.maxDurationHours);
  const [reason, setReason] = useState("");

  async function save() {
    const hours = Number(maxDurationHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
      action.setError("maxDurationHours 必须在 1~168 之间");
      return;
    }

    await action.run(async () => {
      await updateConsoleFacilityConfig({
        auditRequired,
        maxDurationHours: hours,
        reason: reason.trim() ? reason.trim() : undefined,
      });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>功能房预约配置</CardTitle>
        <CardDescription>影响新预约提交与状态流转；变更会写入审计。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">审核开关（auditRequired）</div>
              <div className="text-xs text-muted-foreground">开启后：新预约进入“待审核”；关闭后：无冲突即直接批准。</div>
            </div>
            <Switch checked={auditRequired} onCheckedChange={setAuditRequired} />
          </div>

          <div className="grid gap-2">
            <Label>最长使用时长（maxDurationHours）</Label>
            <Input
              value={String(maxDurationHours)}
              onChange={(e) => setMaxDurationHours(Number(e.target.value))}
              inputMode="numeric"
              type="number"
              min={1}
              max={168}
            />
            <div className="text-xs text-muted-foreground">默认 72 小时；限制：预约 endAt - startAt ≤ maxDurationHours。</div>
          </div>

          <div className="grid gap-2">
            <Label>原因（可选，将写入审计）</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
          </div>

          <InlineError message={action.error} />

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={action.pending}
              onClick={() => {
                setAuditRequired(props.auditRequired);
                setMaxDurationHours(props.maxDurationHours);
                setReason("");
                action.reset();
              }}
            >
              重置
            </Button>
            <Button disabled={action.pending} onClick={() => void save()}>
              {action.pending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
