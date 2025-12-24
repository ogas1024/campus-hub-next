/**
 * 用法：
 * - 统一 Console 表格容器与空态渲染：
 *   <ConsoleDataTable
 *     headers={<tr>...</tr>}
 *     rowCount={items.length}
 *     emptyText="暂无数据"
 *     emptyColSpan={6}
 *   >
 *     {items.map(... => <tr ... />)}
 *   </ConsoleDataTable>
 */

"use client";

import type * as React from "react";

type Props = {
  headers: React.ReactNode;
  children: React.ReactNode;
  rowCount: number;
  emptyText?: React.ReactNode;
  emptyColSpan?: number;
};

export function ConsoleDataTable(props: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-auto">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">{props.headers}</thead>
        <tbody className="text-sm">
          {props.rowCount === 0 ? (
            <tr>
              <td className="px-3 py-10 text-center text-sm text-muted-foreground" colSpan={props.emptyColSpan ?? 1}>
                {props.emptyText ?? "暂无数据"}
              </td>
            </tr>
          ) : null}
          {props.children}
        </tbody>
      </table>
    </div>
  );
}
