import Link from "next/link";
import { redirect } from "next/navigation";

import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { getPortalLibraryBookDownloadLeaderboard, getPortalLibraryContributorLeaderboard } from "@/lib/modules/library/library.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseDays(value: string | undefined) {
  if (!value) return undefined;
  if (value === "0") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest("days 必须为数字");
  const days = Math.trunc(n);
  if (days !== 7 && days !== 30 && days !== 365) throw badRequest("days 仅支持 0/7/30/365");
  return days as 7 | 30 | 365;
}

export default async function LibraryLeaderboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const daysParam = pickString(sp.days);
  const days = parseDays(daysParam);
  const selectValue = days ? String(days) : "0";

  const [bookLeaderboard, userLeaderboard] = await Promise.all([
    getPortalLibraryBookDownloadLeaderboard({ userId: user.id, days }),
    getPortalLibraryContributorLeaderboard({ userId: user.id, days }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="数字图书馆榜单"
        description="支持总榜与近 7/30/365 天窗口；下载榜基于下载事件统计。"
        actions={
          <>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library">
              ← 返回浏览
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/library/me">
              我的投稿
            </Link>
          </>
        }
      />

      <FiltersPanel title="时间窗口">
        <form className="flex flex-wrap items-center gap-2" action="/library/leaderboard" method="GET">
          <Select name="days" defaultValue={selectValue} uiSize="sm" className="w-56">
            <option value="0">总榜</option>
            <option value="7">近 7 天</option>
            <option value="30">近 30 天</option>
            <option value="365">近 365 天</option>
          </Select>
          <button className={buttonVariants({ size: "sm" })} type="submit">
            应用
          </button>
        </form>
      </FiltersPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">图书下载榜</CardTitle>
              <Badge variant="secondary">{bookLeaderboard.items.length} 条</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookLeaderboard.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无数据</div>
            ) : null}
            {bookLeaderboard.items.map((item, idx) => (
              <div key={item.book.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <Link href={`/library/${item.book.id}`} className="truncate text-sm font-medium hover:underline">
                      {item.book.title}
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {bookLeaderboard.days ? `近 ${bookLeaderboard.days} 天下载：` : "总下载："}
                    {item.windowDownloadCount}
                  </div>
                </div>
                <div className="shrink-0">
                  <form action={`/api/library/${item.book.id}/download`} method="POST" target="_blank">
                    <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                      下载
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">用户贡献榜</CardTitle>
              <Badge variant="secondary">{userLeaderboard.items.length} 人</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {userLeaderboard.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无数据</div>
            ) : null}
            {userLeaderboard.items.map((u, idx) => (
              <div key={u.userId} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <div className="truncate text-sm font-medium">{u.name}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {userLeaderboard.days ? `近 ${userLeaderboard.days} 天发布：` : "已发布："}
                    {u.publishedBookCount} 本
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{u.userId}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
