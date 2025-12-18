"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { setRolePermissions } from "@/lib/api/rbac";
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
  roleId: string;
  permissions: Array<{ id: string; code: string; description: string | null }>;
  value: string[];
};

export function RolePermissionsEditor(props: Props) {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "保存失败" });
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.value));

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    const items = props.permissions.slice();
    if (!keyword) return items;
    return items.filter((p) => `${p.code} ${p.description ?? ""}`.toLowerCase().includes(keyword));
  }, [props.permissions, q]);

  const selectedCodes = useMemo(() => {
    const codes = [...selected];
    codes.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    return codes;
  }, [selected]);

  async function submit() {
    await action.run(async () => {
      await setRolePermissions(props.roleId, {
        permissionCodes: selectedCodes,
        reason: reason.trim() ? reason.trim() : undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  const chips = selectedCodes.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {chips.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
          {chips.map((code) => (
            <span key={code} className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">
              {code}
            </span>
          ))}
          {selectedCodes.length > chips.length ? (
            <span className="text-xs text-muted-foreground">+{selectedCodes.length - chips.length}</span>
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
            <Button variant="outline">编辑</Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑角色权限</DialogTitle>
              <DialogDescription>从权限字典中勾选；推荐优先选择 `campus:&lt;module&gt;:*`。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>搜索</Label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="按 code/描述 搜索…" />
              </div>

              <div className="grid gap-2">
                <Label>权限</Label>
                <ScrollArea className="h-80 rounded-lg border border-border">
                  <div className="space-y-1 p-2">
                    {filtered.map((p) => {
                      const checked = selected.has(p.code);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex cursor-pointer items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs">{p.code}</div>
                            {p.description ? <div className="truncate text-xs text-muted-foreground">{p.description}</div> : null}
                          </div>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(p.code);
                                else next.delete(p.code);
                                return next;
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                    {filtered.length === 0 ? <div className="p-2 text-sm text-muted-foreground">无匹配权限</div> : null}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid gap-2">
                <Label>原因（可选，将写入审计）</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
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
