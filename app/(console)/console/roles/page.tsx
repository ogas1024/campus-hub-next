import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { ConsoleRoleDialogController } from "@/components/rbac/ConsoleRoleDialogController";
import { buttonVariants } from "@/components/ui/button";
import { requirePerm } from "@/lib/auth/permissions";
import { withDialogHref } from "@/lib/navigation/dialog";
import { listRoles } from "@/lib/modules/rbac/rbac.service";

export default async function ConsoleRolesPage() {
  await requirePerm("campus:role:*");
  const data = await listRoles();

  const baseHref = "/console/roles";

  return (
    <div className="space-y-4">
      <PageHeader
        title="角色"
        description="角色用于聚合权限与数据范围；权限码支持 `*` 通配符。"
        meta={<span>共 {data.items.length} 个角色</span>}
        actions={
          <Link className={buttonVariants()} href={withDialogHref(baseHref, { dialog: "role-create" })} scroll={false}>
            新增角色
          </Link>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">code</th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">描述</th>
              <th className="px-3 py-2">更新时间</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={5}>
                  暂无角色
                </td>
              </tr>
            ) : null}

            {data.items.map((r) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.code}</td>
                <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                <td className="px-3 py-2 text-sm text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.updatedAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={withDialogHref(baseHref, { dialog: "role-edit", id: r.id })}
                    scroll={false}
                  >
                    编辑
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConsoleRoleDialogController />
    </div>
  );
}
