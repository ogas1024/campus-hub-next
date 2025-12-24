"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateRegistrationConfig } from "@/lib/api/config";
import { InlineError } from "@/components/common/InlineError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  requiresApproval: boolean;
};

export function RegistrationConfigCard(props: Props) {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "保存失败" });
  const [requiresApproval, setRequiresApproval] = useState(props.requiresApproval);
  const [reason, setReason] = useState("");

  async function save() {
    await action.run(async () => {
      await updateRegistrationConfig({ requiresApproval, reason: reason.trim() ? reason.trim() : undefined });
      toast.success("已保存注册审核配置");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>注册审核开关</CardTitle>
        <CardDescription>开启后：用户完成邮箱验证后进入“待审核”，需管理员通过后才能使用系统。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">requiresApproval</div>
              <div className="text-xs text-muted-foreground">默认关闭；建议仅在需要时开启。</div>
            </div>
            <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
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
                setRequiresApproval(props.requiresApproval);
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
