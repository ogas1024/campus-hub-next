"use client";

import Link from "next/link";
import { useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { InlineMessage } from "@/components/common/InlineMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">找回密码</h1>
        <p className="text-sm text-muted-foreground">将通过 Supabase Auth 向邮箱发送重置链接。</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);

          const trimmed = email.trim();
          if (!trimmed) {
            setError("请输入邮箱。");
            return;
          }

          setLoading(true);
          try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
              redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) {
              setError(error.message);
              return;
            }

            setMessage("已发送重置邮件，请检查收件箱（含垃圾邮件）。");
          } finally {
            setLoading(false);
          }
        }}
        >
        <div className="grid gap-1.5">
          <Label>邮箱</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>

        <InlineError message={error} />
        <InlineMessage message={message} />

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "发送中..." : "发送重置链接"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Link className="font-medium underline underline-offset-2" href="/login">
          返回登录
        </Link>
        <Link className="font-medium underline underline-offset-2" href="/register">
          去注册
        </Link>
      </div>
    </div>
  );
}
