import Link from "next/link";

import type { PortalModuleId } from "@/lib/navigation/modules";
import { ModuleIcon } from "@/components/layout/ModuleIcon";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: string;
  docPath?: string;
  moduleId?: PortalModuleId;
};

export function ComingSoon({ title, description, docPath, moduleId }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {moduleId ? (
                <span className="mt-0.5 text-muted-foreground">
                  <ModuleIcon moduleId={moduleId} />
                </span>
              ) : null}
              <div className="space-y-1">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span>{title}</span>
                  <Badge variant="secondary">建设中</Badge>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link className={buttonVariants({ variant: "outline" })} href="/">
                返回首页
              </Link>
              <Link className={buttonVariants()} href="/notices">
                去看通知公告
              </Link>
            </div>
          </div>
        </CardHeader>

        {docPath ? (
          <CardContent>
            <div className="text-sm text-muted-foreground">参考需求文档</div>
            <div className="mt-2">
              <code className={cn("rounded-md border border-border bg-muted px-2 py-1 text-sm text-foreground")}>
                {docPath}
              </code>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
