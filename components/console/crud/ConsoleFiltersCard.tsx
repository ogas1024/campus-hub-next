/**
 * 用法：
 * - 统一 Console 列表页的筛选卡片外观：
 *   <ConsoleFiltersCard>
 *     <form method="GET" action="/console/xxx" className="grid ...">...</form>
 *   </ConsoleFiltersCard>
 */

"use client";

import type * as React from "react";

import { FiltersPanel } from "@/components/common/FiltersPanel";

type Props = {
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export function ConsoleFiltersCard({ title = "筛选", description, children }: Props) {
  return <FiltersPanel title={title} description={description}>{children}</FiltersPanel>;
}
