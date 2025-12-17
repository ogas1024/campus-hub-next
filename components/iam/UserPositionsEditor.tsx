"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { setUserPositions } from "@/lib/api/iam";
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
  positions: Array<{ id: string; code: string | null; name: string; description: string | null; enabled: boolean }>;
  value: string[];
  disabled?: boolean;
};

export function UserPositionsEditor(props: Props) {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "保存失败" });
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.value));

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    const items = props.positions.slice();
    if (!keyword) return items;
    return items.filter((p) => `${p.code ?? ""} ${p.name}`.toLowerCase().includes(keyword));
  }, [props.positions, q]);

  const selectedLabels = useMemo(() => {
    const byId = new Map(props.positions.map((p) => [p.id, p]));
    const ids = [...selected];
    const labels = ids.map((id) => byId.get(id)?.name ?? "未知岗位");
    labels.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    return labels;
  }, [props.positions, selected]);

  async function submit() {
    await action.run(async () => {
      await setUserPositions(props.userId, { positionIds: [...selected], reason: reason.trim() ? reason.trim() : undefined });
      setOpen(false);
      router.refresh();
    });
  }

  const chips = selectedLabels.slice(0, 6);

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
          {selectedLabels.length > chips.length ? (
            <span className="text-xs text-muted-foreground">+{selectedLabels.length - chips.length}</span>
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
              <DialogTitle>编辑用户岗位</DialogTitle>
              <DialogDescription>覆盖式保存；岗位支持启停，停用岗位仍可绑定（由业务决定是否允许）。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>搜索</Label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="按 code/name 搜索…" />
              </div>

              <div className="grid gap-2">
                <Label>岗位</Label>
                <ScrollArea className="h-72 rounded-lg border border-border">
                  <div className="space-y-1 p-2">
                    {filtered.map((p) => {
                      const checked = selected.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground",
                            p.enabled ? null : "opacity-80",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {p.code ? `${p.code} · ` : ""}
                              {p.name}
                              {p.enabled ? "" : "（停用）"}
                            </div>
                            {p.description ? <div className="truncate text-xs text-muted-foreground">{p.description}</div> : null}
                          </div>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(p.id);
                                else next.delete(p.id);
                                return next;
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                    {filtered.length === 0 ? <div className="p-2 text-sm text-muted-foreground">无匹配岗位</div> : null}
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
