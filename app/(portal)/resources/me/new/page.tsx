"use client";

import Link from "next/link";

import { PortalShareResourceForm } from "@/components/course-resources/PortalShareResourceForm";
import { buttonVariants } from "@/components/ui/button";

export default function NewMyResourcePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">新建投稿</h1>
          <p className="text-sm text-muted-foreground">在此页面完成文件上传/外链填写并提交审核。</p>
        </div>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/resources/me">
          ← 返回
        </Link>
      </div>

      <PortalShareResourceForm mode="select" returnHref="/resources/me" />
    </div>
  );
}
