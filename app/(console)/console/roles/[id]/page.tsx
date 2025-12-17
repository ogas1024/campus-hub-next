import Link from "next/link";
import { notFound } from "next/navigation";

import { RoleBasicsEditor } from "@/components/rbac/RoleBasicsEditor";
import { RoleDataScopesEditor } from "@/components/rbac/RoleDataScopesEditor";
import { RolePermissionsEditor } from "@/components/rbac/RolePermissionsEditor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePerm } from "@/lib/auth/permissions";
import { listDepartments } from "@/lib/modules/organization/organization.service";
import { getRoleDataScopes } from "@/lib/modules/data-permission/dataPermission.service";
import { getRolePermissionCodes, listPermissions, listRoles } from "@/lib/modules/rbac/rbac.service";

export default async function ConsoleRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("campus:role:*");
  const { id } = await params;

  const [rolesData, permissionsData, rolePerms, scopes, departmentsData] = await Promise.all([
    listRoles(),
    listPermissions(),
    getRolePermissionCodes(id),
    getRoleDataScopes(id),
    listDepartments(),
  ]);

  const role = rolesData.items.find((r) => r.id === id);
  if (!role) notFound();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href="/console/roles" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回角色列表
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{role.name}</h1>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{role.code}</span>
        </div>
        <div className="text-sm text-muted-foreground">{role.description ?? "—"}</div>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>维护角色名称/描述与删除（内置角色不可删除）。</CardDescription>
          </CardHeader>
        <CardContent>
            <RoleBasicsEditor
              role={{
                id: role.id,
                code: role.code,
                name: role.name,
                description: role.description,
                updatedAt: new Date(role.updatedAt).toISOString(),
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>权限</CardTitle>
            <CardDescription>从权限字典中勾选；支持 `campus:notice:*` / `campus:user:*` 等通配符。</CardDescription>
          </CardHeader>
          <CardContent>
            <RolePermissionsEditor
              roleId={role.id}
              permissions={permissionsData.items.map((p) => ({ id: p.id, code: p.code, description: p.description }))}
              value={rolePerms.permissionCodes}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>数据范围</CardTitle>
            <CardDescription>`module` 必须与权限码 `campus:&lt;module&gt;:*` 的 module 段一致。</CardDescription>
          </CardHeader>
          <CardContent>
            <RoleDataScopesEditor roleId={role.id} departments={departmentsData.items} value={scopes.items} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
