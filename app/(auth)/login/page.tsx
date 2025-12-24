"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { InlineMessage } from "@/components/common/InlineMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type MeResponse = {
  authenticated: boolean;
  allowed: boolean;
  blockCode?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [blockCode, setBlockCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">登录</h1>
        <p className="text-sm text-muted-foreground">使用 Supabase Auth（邮箱/密码）。</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);
          setBlockCode(null);
          setLoading(true);

          const supabase = createSupabaseBrowserClient();
          const { error } = await supabase.auth.signInWithPassword({ email, password });

          if (error) {
            setLoading(false);
            setError(error.message);
            return;
          }

          try {
            const res = await fetch("/api/me", { cache: "no-store" });
            const me = (await res.json()) as MeResponse;

            if (!me.authenticated) {
              setError("登录成功但会话未同步到服务器（Cookie 未写入）。请刷新页面后重试。");
              return;
            }

            if (!me.allowed) {
              setBlockCode(me.blockCode ?? "UNKNOWN");
              switch (me.blockCode) {
                case "EMAIL_NOT_VERIFIED":
                  setMessage("邮箱未验证：请前往邮箱点击验证链接后再登录。");
                  break;
                case "PENDING_APPROVAL":
                  setMessage("账号待管理员审核通过后才能使用。");
                  break;
                case "DISABLED":
                  setMessage("账号已停用，请联系管理员。");
                  break;
                case "BANNED":
                  setMessage("账号已封禁，请联系管理员。");
                  break;
                case "DELETED":
                  setMessage("账号已删除，请联系管理员。");
                  break;
                case "PROFILE_MISSING":
                  setMessage("账号资料未初始化（profiles 缺失），请联系管理员或重新注册。");
                  break;
                default:
                  setMessage("当前账号状态不允许登录，请联系管理员。");
                  break;
              }

              await supabase.auth.signOut();
              return;
            }

            router.push("/notices");
            router.refresh();
          } catch {
            setError("登录成功但读取账号状态失败，请刷新页面后重试。");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="grid gap-1.5">
          <Label>邮箱</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>

        <div className="grid gap-1.5">
          <Label>密码</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <InlineError message={error} />
        <InlineMessage message={message} />

        {blockCode === "EMAIL_NOT_VERIFIED" ? (
          <Button
            className="w-full"
            type="button"
            variant="outline"
            disabled={loading || resending || !email.trim()}
            onClick={async () => {
              setError(null);
              setResending(true);
              try {
                const supabase = createSupabaseBrowserClient();
                const { error } = await supabase.auth.resend({
                  type: "signup",
                  email: email.trim(),
                  options: { emailRedirectTo: `${window.location.origin}/login` },
                });
                if (error) setError(error.message);
                else setMessage("已重新发送验证邮件，请检查收件箱（含垃圾邮件）。");
              } finally {
                setResending(false);
              }
            }}
          >
            {resending ? "发送中..." : "重新发送验证邮件"}
          </Button>
        ) : null}

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          还没有账号？{" "}
          <Link className="font-medium underline underline-offset-2" href="/register">
            去注册
          </Link>
        </div>
        <Link className="font-medium underline underline-offset-2" href="/forgot-password">
          忘记密码
        </Link>
      </div>
    </div>
  );
}
