import Link from "next/link";

import { UserDepartmentsEditor } from "@/components/iam/UserDepartmentsEditor";
import { UserLifecycleActions } from "@/components/iam/UserLifecycleActions";
import { UserPositionsEditor } from "@/components/iam/UserPositionsEditor";
import { UserRolesEditor } from "@/components/iam/UserRolesEditor";
import { UserStatusBadge } from "@/components/iam/UserStatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { getConsoleUserDetail } from "@/lib/modules/iam/users.service";
import { listDepartments, listPositions } from "@/lib/modules/organization/organization.service";
import { listRoles } from "@/lib/modules/rbac/rbac.service";

export default async function ConsoleUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePerm("campus:user:read");
  const { id } = await params;

  const [detail, rolesData, departmentsData, positionsData, perms] = await Promise.all([
    getConsoleUserDetail({ actorUserId: viewer.id, userId: id }),
    listRoles(),
    listDepartments(),
    listPositions(),
    Promise.all([
      hasPerm(viewer.id, "campus:user:approve"),
      hasPerm(viewer.id, "campus:user:disable"),
      hasPerm(viewer.id, "campus:user:ban"),
      hasPerm(viewer.id, "campus:user:delete"),
      hasPerm(viewer.id, "campus:user:assign_role"),
      hasPerm(viewer.id, "campus:user:assign_org"),
    ]),
  ]);

  const [canApprove, canDisable, canBan, canDelete, canAssignRole, canAssignOrg] = perms;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
            <Link href="/console/users" className="text-sm text-muted-foreground hover:text-foreground">
              ← 返回用户列表
            </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{detail.profile.name}</h1>
              <UserStatusBadge status={detail.profile.status} />
            </div>
          <div className="text-sm text-muted-foreground">
            {detail.profile.studentId} · {detail.email ?? "无邮箱"} {detail.emailVerified ? "" : "（未验证邮箱）"}
          </div>
        </div>

        <UserLifecycleActions
          userId={detail.id}
          status={detail.profile.status}
          canApprove={canApprove}
          canDisable={canDisable}
          canBan={canBan}
          canDelete={canDelete}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>profiles（极简）+ 业务扩展表；此处仅展示 IAM 核心字段。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">用户 ID</dt>
                <dd className="break-all font-mono text-xs text-foreground">{detail.id}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">用户名</dt>
                <dd className="text-foreground">{detail.profile.username ?? "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">头像</dt>
                <dd className="text-foreground">{detail.profile.avatarUrl ? "已设置" : "—"}</dd>
              </div>

              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">创建时间</dt>
                <dd className="text-foreground">{new Date(detail.profile.createdAt).toLocaleString()}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">更新时间</dt>
                <dd className="text-foreground">{new Date(detail.profile.updatedAt).toLocaleString()}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">最近登录</dt>
                <dd className="text-foreground">{detail.profile.lastLoginAt ? new Date(detail.profile.lastLoginAt).toLocaleString() : "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auth 状态</CardTitle>
            <CardDescription>来自 Supabase Auth（admin 视角），用于 ban/delete 等能力。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">Auth 创建</dt>
                <dd className="text-foreground">{detail.auth.createdAt ? new Date(detail.auth.createdAt).toLocaleString() : "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">最后登录</dt>
                <dd className="text-foreground">{detail.auth.lastSignInAt ? new Date(detail.auth.lastSignInAt).toLocaleString() : "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">封禁至</dt>
                <dd className="text-foreground">{detail.auth.bannedUntil ? new Date(detail.auth.bannedUntil).toLocaleString() : "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">删除时间</dt>
                <dd className="text-foreground">{detail.auth.deletedAt ? new Date(detail.auth.deletedAt).toLocaleString() : "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>角色</CardTitle>
            <CardDescription>权限码支持通配符（*），角色用于聚合权限。</CardDescription>
          </CardHeader>
        <CardContent>
          <UserRolesEditor
            userId={detail.id}
            roles={rolesData.items.map((r) => ({ id: r.id, code: r.code, name: r.name, description: r.description }))}
            value={detail.roles.map((r) => r.id)}
            disabled={!canAssignRole}
          />
        </CardContent>
      </Card>

        <Card>
          <CardHeader>
            <CardTitle>部门</CardTitle>
            <CardDescription>用户可属于多个部门；查询“部门及子部门”由闭包表支持。</CardDescription>
          </CardHeader>
          <CardContent>
            <UserDepartmentsEditor
              userId={detail.id}
              departments={departmentsData.items}
              value={detail.departments.map((d) => d.id)}
              disabled={!canAssignOrg}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>岗位</CardTitle>
            <CardDescription>岗位可启停；删除岗位会自动解绑用户。</CardDescription>
          </CardHeader>
        <CardContent>
          <UserPositionsEditor
            userId={detail.id}
            positions={positionsData.items.map((p) => ({ id: p.id, code: p.code, name: p.name, description: p.description, enabled: p.enabled }))}
            value={detail.positions.map((p) => p.id)}
            disabled={!canAssignOrg}
          />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
