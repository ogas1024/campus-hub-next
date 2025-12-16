import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/notices");

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Campus Hub</h1>
            <p className="text-sm text-zinc-600">学习项目：先从“通知公告”模块开始。</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              className="rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
              href="/login"
            >
              登录
            </Link>
            <Link
              className="rounded-lg border border-zinc-200 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
              href="/register"
            >
              注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
