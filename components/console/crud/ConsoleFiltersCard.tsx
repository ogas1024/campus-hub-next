/**
 * 用法：
 * - 统一 Console 列表页的筛选卡片外观：
 *   <ConsoleFiltersCard>
 *     <form method="GET" action="/console/xxx" className="grid ...">...</form>
 *   </ConsoleFiltersCard>
 */

"use client";

import type * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export function ConsoleFiltersCard({ title = "筛选", description, children }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
