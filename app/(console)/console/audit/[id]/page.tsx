import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePerm } from "@/lib/auth/permissions";
import { getAuditLogDetail } from "@/lib/modules/audit/audit.service";

function jsonPretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function ConsoleAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("campus:audit:list");
  const { id } = await params;
  const log = await getAuditLogDetail(id);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <Link href="/console/audit" className="text-sm text-muted-foreground hover:text-foreground">
            ← 返回审计列表
          </Link>
        }
        title="审计详情"
        description={<span className="font-mono text-xs text-muted-foreground">{log.id}</span>}
        meta={
          <span
            className={
              log.success
                ? "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                : "rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
            }
          >
            {log.success ? "成功" : "失败"}
          </span>
        }
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>摘要</CardTitle>
            <CardDescription>动作、目标与操作者等基本字段。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">时间</dt>
                <dd className="text-foreground">{new Date(log.occurredAt).toLocaleString()}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">action</dt>
                <dd className="font-mono text-xs text-foreground">{log.action}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">requestId</dt>
                <dd className="font-mono text-xs text-muted-foreground">{log.requestId ?? "—"}</dd>
              </div>

              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">targetType</dt>
                <dd className="text-foreground">{log.targetType}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">targetId</dt>
                <dd className="font-mono text-xs text-muted-foreground">{log.targetId}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">errorCode</dt>
                <dd className="text-foreground">{log.errorCode ?? "—"}</dd>
              </div>

              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">actorEmail</dt>
                <dd className="text-foreground">{log.actorEmail ?? "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">actorUserId</dt>
                <dd className="font-mono text-xs text-muted-foreground">{log.actorUserId}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">IP</dt>
                <dd className="text-foreground">{log.ip ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>上下文</CardTitle>
            <CardDescription>操作者角色、原因与 User-Agent。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">actorRoles</dt>
                <dd>
                  <pre className="overflow-auto rounded-lg border border-border bg-muted p-3 text-xs text-foreground">
                    {jsonPretty(log.actorRoles)}
                  </pre>
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">reason</dt>
                <dd className="text-foreground">{log.reason ?? "—"}</dd>
              </div>
              <div className="col-span-2 space-y-1">
                <dt className="text-xs text-muted-foreground">userAgent</dt>
                <dd className="break-words text-foreground">{log.userAgent ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>diff</CardTitle>
            <CardDescription>变更内容（若有）。</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-lg border border-border bg-muted p-3 text-xs text-foreground">{jsonPretty(log.diff)}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
