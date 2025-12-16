"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">登录</h1>
        <p className="text-sm text-zinc-600">使用 Supabase Auth（邮箱/密码）。</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);

          const supabase = createSupabaseBrowserClient();
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          setLoading(false);

          if (error) {
            setError(error.message);
            return;
          }

          router.push("/notices");
          router.refresh();
        }}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">邮箱</label>
          <input
            className="h-10 w-full rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-400"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">密码</label>
          <input
            className="h-10 w-full rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-400"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <button
          className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>

      <div className="text-sm text-zinc-600">
        还没有账号？{" "}
        <Link className="font-medium text-zinc-900 underline underline-offset-2" href="/register">
          去注册
        </Link>
      </div>
    </div>
  );
}

