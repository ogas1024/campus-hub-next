import Link from "next/link";

import { CreateRoleDialog } from "@/components/rbac/CreateRoleDialog";
import { buttonVariants } from "@/components/ui/button";
import { requirePerm } from "@/lib/auth/permissions";
import { listRoles } from "@/lib/modules/rbac/rbac.service";

export default async function ConsoleRolesPage() {
  await requirePerm("campus:role:*");
  const data = await listRoles();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">角色</h1>
          <p className="text-sm text-muted-foreground">角色用于聚合权限与数据范围；权限码支持 `*` 通配符。</p>
          <div className="text-sm text-muted-foreground">共 {data.items.length} 个角色</div>
        </div>
        <CreateRoleDialog />
      </div>

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
                    href={`/console/roles/${r.id}`}
                  >
                    详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
