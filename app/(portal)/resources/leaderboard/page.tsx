import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalResourceDownloadLeaderboard, getPortalUserScoreLeaderboard, listPortalMajors } from "@/lib/modules/course-resources/courseResources.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResourcesLeaderboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const majorId = pickString(sp.majorId) ?? undefined;

  const [majors, resourceLeaderboard, userLeaderboard] = await Promise.all([
    listPortalMajors(),
    getPortalResourceDownloadLeaderboard({ userId: user.id, scope: majorId ? "major" : "global", days: 30, majorId }),
    getPortalUserScoreLeaderboard({ userId: user.id, majorId }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">课程资源榜单</h1>
          <p className="text-sm text-muted-foreground">默认展示近 30 天；积分仅统计“首次通过/首次最佳”事件。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources">
            ← 返回浏览
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/me">
            我的投稿
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-center gap-2" action="/resources/leaderboard" method="GET">
            <Select name="majorId" defaultValue={majorId ?? ""} className="w-72">
              <option value="">全站</option>
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <button className={buttonVariants({ size: "sm" })} type="submit">
              应用
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">资源下载榜</CardTitle>
              <Badge variant="secondary">{resourceLeaderboard.items.length} 条</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {resourceLeaderboard.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无数据</div>
            ) : null}
            {resourceLeaderboard.items.map((item, idx) => (
              <div key={item.resource.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    {item.resource.isBest ? <Badge>最佳</Badge> : null}
                    <Link href={`/resources/${item.resource.id}`} className="truncate text-sm font-medium hover:underline">
                      {item.resource.title}
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">近 {resourceLeaderboard.days} 天下载：{item.windowDownloadCount}</div>
                </div>
                <div className="shrink-0">
                  <form action={`/api/resources/${item.resource.id}/download`} method="POST" target="_blank">
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
              <CardTitle className="text-base">用户积分榜</CardTitle>
              <Badge variant="secondary">{userLeaderboard.items.length} 人</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {userLeaderboard.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无数据</div>
            ) : null}
            {userLeaderboard.items.map((u, idx) => (
              <div key={u.userId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <div className="text-sm font-medium">{u.name}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>积分：{u.score}</span>
                    <span>通过：{u.approveCount}</span>
                    <span>最佳：{u.bestCount}</span>
                    <Link className="hover:text-foreground" href={`/api/resources/leaderboard/users/${u.userId}/works${majorId ? `?majorId=${encodeURIComponent(majorId)}` : ""}`} target="_blank" rel="noreferrer">
                      代表作API
                    </Link>
                  </div>
                </div>

                {u.topWorks.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">代表作 Top5</div>
                    {u.topWorks.map((w) => (
                      <div key={w.id} className="flex items-center justify-between gap-2">
                        <Link href={`/resources/${w.id}`} className="truncate text-sm hover:underline">
                          {w.title}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">下载 {w.downloadCount}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-muted-foreground">暂无代表作</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

