"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const studentIdValid = useMemo(() => /^[0-9]{16}$/.test(studentId), [studentId]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">注册</h1>
        <p className="text-sm text-muted-foreground">注册会写入 `profiles`（name/studentId）。</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);

          if (!studentIdValid) {
            setError("学号必须为 16 位数字");
            return;
          }

          setLoading(true);
          const supabase = createSupabaseBrowserClient();
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name, studentId },
            },
          });
          setLoading(false);

          if (error) {
            setError(error.message);
            return;
          }

          if (!data.session) {
            setMessage("注册成功：请前往邮箱完成验证后再登录。");
            return;
          }

          router.push("/notices");
          router.refresh();
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
            autoComplete="new-password"
            required
          />
        </div>

        <div className="grid gap-1.5">
          <Label>姓名</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid gap-1.5">
          <Label>学号（16 位数字）</Label>
          <Input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            inputMode="numeric"
            pattern="^[0-9]{16}$"
            required
          />
          {!studentIdValid && studentId ? (
            <div className="text-xs text-destructive">学号格式不正确</div>
          ) : null}
        </div>

        {error ? <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
        {message ? <div className="rounded-lg border border-border bg-muted p-3 text-sm">{message}</div> : null}

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "注册中..." : "注册"}
        </Button>
      </form>

      <div className="text-sm text-muted-foreground">
        已有账号？{" "}
        <Link className="font-medium underline underline-offset-2" href="/login">
          去登录
        </Link>
      </div>
    </div>
  );
}
