/**
 * 用法：
 * - 作为 Console 页面通用外壳：
 *   <ConsolePage title="标题" description="描述" actions={<.../>} meta={<.../>}>
 *     {children}
 *   </ConsolePage>
 */

"use client";

import type * as React from "react";

import { PageHeader } from "@/components/common/PageHeader";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function ConsolePage(props: Props) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow={props.eyebrow} title={props.title} description={props.description} meta={props.meta} actions={props.actions} />

      {props.children}
    </div>
  );
}
