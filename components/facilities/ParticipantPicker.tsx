"use client";

import { useEffect, useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchUsers, type UserSearchItem } from "@/lib/api/users";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  userId: string;
  value: UserSearchItem[];
  onChange: (next: UserSearchItem[]) => void;
};

export function ParticipantPicker(props: Props) {
  const action = useAsyncAction({ fallbackErrorMessage: "搜索失败" });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchItem[]>([]);

  const selectedIds = useMemo(() => new Set(props.value.map((u) => u.id)), [props.value]);

  useEffect(() => {
    const query = q.trim();
    if (!query) return;

    const handle = window.setTimeout(() => {
      void (async () => {
        const res = await action.run(() => searchUsers({ q: query, limit: 10 }));
        if (!res) return;
        setResults(res.items.filter((u) => u.id !== props.userId));
      })();
    }, 250);

    return () => window.clearTimeout(handle);
  }, [action, props.userId, q]);

  function add(user: UserSearchItem) {
    if (user.id === props.userId) return;
    if (selectedIds.has(user.id)) return;
    props.onChange([...props.value, user]);
    setQ("");
    setResults([]);
  }

  function remove(userId: string) {
    props.onChange(props.value.filter((u) => u.id !== userId));
  }

  const totalCount = props.value.length + 1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">已选 {totalCount} 人（含你本人）</Badge>
        <Badge variant="secondary">至少 3 人</Badge>
      </div>

      <Input
        value={q}
        onChange={(e) => {
          const next = e.target.value;
          setQ(next);
          if (!next.trim()) {
            setResults([]);
            action.reset();
          }
        }}
        placeholder="按姓名/学号/邮箱搜索参与人…"
      />
      <InlineError message={action.error} />

      {results.length > 0 ? (
        <div className="rounded-lg border border-border bg-background">
          <ScrollArea className="max-h-56">
            <div className="p-1">
              {results.map((u) => {
                const disabled = selectedIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={[
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                      disabled ? "opacity-60" : "",
                    ].join(" ")}
                    disabled={disabled}
                    onClick={() => add(u)}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{u.studentId}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{disabled ? "已选择" : "添加"}</div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      ) : null}

      {props.value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {props.value.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs">
              <span className="font-medium">{u.name}</span>
              <span className="font-mono text-muted-foreground">{u.studentId}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => remove(u.id)}>
                移除
              </Button>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">可选：添加至少 2 名其他已注册用户（申请人默认在参与人内）。</div>
      )}
    </div>
  );
}
