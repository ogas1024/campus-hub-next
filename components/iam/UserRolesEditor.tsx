"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { setUserRoles } from "@/lib/api/iam";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  roles: Array<{ id: string; code: string; name: string; description: string | null }>;
  value: string[];
  disabled?: boolean;
};

export function UserRolesEditor(props: Props) {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "保存失败" });
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.value));

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    const items = props.roles.slice();
    if (!keyword) return items;
    return items.filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(keyword));
  }, [props.roles, q]);

  const selectedMeta = useMemo(() => {
    const byId = new Map(props.roles.map((r) => [r.id, r]));
    const ids = [...selected];
    const labels = ids.map((id) => byId.get(id)?.code ?? "未知角色");
    labels.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    return labels;
  }, [props.roles, selected]);

  async function submit() {
    await action.run(async () => {
      await setUserRoles(props.userId, { roleIds: [...selected], reason: reason.trim() ? reason.trim() : undefined });
      setOpen(false);
      router.refresh();
    });
  }

  const chips = selectedMeta.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {chips.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
          {chips.map((label) => (
            <span key={label} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {label}
            </span>
          ))}
          {selectedMeta.length > chips.length ? (
            <span className="text-xs text-muted-foreground">+{selectedMeta.length - chips.length}</span>
          ) : null}
        </div>

        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (next) {
              setSelected(new Set(props.value));
              setQ("");
              setReason("");
              action.reset();
            }
            setOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" disabled={props.disabled}>
              编辑
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑用户角色</DialogTitle>
              <DialogDescription>覆盖式保存；内置角色 user 将被强制保留。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>搜索</Label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="按 code/name 搜索…" />
              </div>

              <div className="grid gap-2">
                <Label>角色</Label>
                <ScrollArea className="h-72 rounded-lg border border-border">
                  <div className="space-y-1 p-2">
                    {filtered.map((r) => {
                      const checked = selected.has(r.id);
                      const isBuiltinUser = r.code === "user";
                      return (
                        <label
                          key={r.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground",
                            isBuiltinUser ? "opacity-80" : null,
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {r.code} · {r.name}
                            </div>
                            {r.description ? <div className="truncate text-xs text-muted-foreground">{r.description}</div> : null}
                          </div>
                          <Checkbox
                            checked={checked}
                            disabled={isBuiltinUser}
                            onCheckedChange={(v) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (isBuiltinUser) return next;
                                if (v) next.add(r.id);
                                else next.delete(r.id);
                                return next;
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                    {filtered.length === 0 ? <div className="p-2 text-sm text-muted-foreground">无匹配角色</div> : null}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid gap-2">
                <Label>原因（可选，将写入审计）</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、处理原因、备注…" />
              </div>

              <InlineError message={action.error} />
            </div>

            <DialogFooter>
              <Button variant="outline" disabled={action.pending} onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button disabled={action.pending} onClick={() => void submit()}>
                {action.pending ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
