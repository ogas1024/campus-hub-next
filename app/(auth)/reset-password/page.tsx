"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setError(null);
      setMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) router.replace("/reset-password");
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (!cancelled) setReady(!!data.user);
      } catch (err) {
        if (!cancelled) {
          setReady(false);
          setError(err instanceof Error ? err.message : "链接无效或已过期，请重新发送重置邮件。");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">重置密码</h1>
        <p className="text-sm text-muted-foreground">通过邮件链接进入后在此设置新密码。</p>
      </div>

      {!ready ? (
        <div className="space-y-3">
          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : (
            <div className="rounded-lg border border-border bg-muted p-3 text-sm">正在验证重置链接...</div>
          )}
          <div className="text-sm text-muted-foreground">
            你可以{" "}
            <Link className="font-medium underline underline-offset-2" href="/forgot-password">
              重新发送重置邮件
            </Link>
            。
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);

            if (password.length < 8) {
              setError("新密码至少 8 位。");
              return;
            }
            if (password !== passwordConfirm) {
              setError("两次输入的新密码不一致。");
              return;
            }

            setLoading(true);
            try {
              const supabase = createSupabaseBrowserClient();
              const { error } = await supabase.auth.updateUser({ password });
              if (error) throw error;

              setMessage("密码已更新，请重新登录。");
              await supabase.auth.signOut();
              router.push("/login");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "重置失败");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label>新密码</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>

          <div className="grid gap-1.5">
            <Label>确认新密码</Label>
            <Input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" required />
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : null}
          {message ? <div className="rounded-lg border border-border bg-muted p-3 text-sm">{message}</div> : null}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "更新中..." : "更新密码"}
          </Button>
        </form>
      )}

      <div className="text-sm text-muted-foreground">
        <Link className="font-medium underline underline-offset-2" href="/login">
          返回登录
        </Link>
      </div>
    </div>
  );
}
