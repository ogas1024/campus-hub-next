"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createConsoleUser, inviteConsoleUser } from "@/lib/api/iam";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  canCreate: boolean;
  canInvite: boolean;
};

export function CreateUserDialog(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const [open, setOpen] = useState(false);

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: "create" | "invite"; label: string }> = [];
    if (props.canCreate) tabs.push({ id: "create", label: "手动创建" });
    if (props.canInvite) tabs.push({ id: "invite", label: "邀请注册" });
    return tabs;
  }, [props.canCreate, props.canInvite]);

  const [tab, setTab] = useState<"create" | "invite">(() => availableTabs[0]?.id ?? "create");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");

  const [password, setPassword] = useState("");
  const [emailConfirm, setEmailConfirm] = useState(false);

  const studentIdValid = useMemo(() => /^[0-9]{16}$/.test(studentId), [studentId]);

  async function runAndNavigate(runAction: () => Promise<{ userId: string }>, fallbackMessage: string) {
    const result = await action.run(runAction, { fallbackErrorMessage: fallbackMessage });
    if (!result) return;
    setOpen(false);
    router.push(`/console/users/${result.userId}`);
    router.refresh();
  }

  if (!props.canCreate && !props.canInvite) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) action.reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>新增用户</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>新增用户</DialogTitle>
          <DialogDescription>通过 Supabase Auth Admin API 创建/邀请用户，写入审计。</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            {availableTabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="create">
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label>邮箱</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
              </div>
              <div className="grid gap-2">
                <Label>密码（≥8 位）</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>姓名</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>学号（16 位数字）</Label>
                  <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} inputMode="numeric" />
                  {!studentIdValid && studentId ? <div className="text-xs text-destructive">学号格式不正确</div> : null}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">标记邮箱已验证</div>
                  <div className="text-xs text-muted-foreground">仅当你确定邮箱可用且无需走验证流程时使用。</div>
                </div>
                <Switch checked={emailConfirm} onCheckedChange={setEmailConfirm} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invite">
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label>邮箱</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>姓名</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>学号（16 位数字）</Label>
                  <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} inputMode="numeric" />
                  {!studentIdValid && studentId ? <div className="text-xs text-destructive">学号格式不正确</div> : null}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
                将向邮箱发送邀请链接（Supabase 默认邮件模板）。用户完成邮箱验证后会按“注册审核开关”进入 active 或待审核。
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <InlineError message={action.error} />

        <DialogFooter>
          <Button
            variant="outline"
            disabled={action.pending}
            onClick={() => {
              setOpen(false);
            }}
          >
            取消
          </Button>
          <Button
            disabled={action.pending || !email.trim() || !name.trim() || !studentIdValid || (tab === "create" && password.length < 8)}
            onClick={() => {
              if (tab === "create") {
                if (!props.canCreate) return;
                void runAndNavigate(
                  async () => {
                    const created = await createConsoleUser({
                      email: email.trim(),
                      password,
                      emailConfirm,
                      name: name.trim(),
                      studentId: studentId.trim(),
                    });
                    return { userId: created.id };
                  },
                  "创建失败",
                );
              } else {
                if (!props.canInvite) return;
                void runAndNavigate(
                  async () => {
                    const created = await inviteConsoleUser({
                      email: email.trim(),
                      name: name.trim(),
                      studentId: studentId.trim(),
                    });
                    return created;
                  },
                  "邀请失败",
                );
              }
            }}
          >
            {action.pending ? "提交中..." : tab === "create" ? "创建" : "发送邀请"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
