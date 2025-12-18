import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateUserDialog } from "@/components/iam/CreateUserDialog";
import { UserStatusBadge } from "@/components/iam/UserStatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { parseIntParam } from "@/lib/http/query";
import { listConsoleUsers } from "@/lib/modules/iam/users.service";
import { buildDepartmentTree, type DepartmentNode } from "@/lib/modules/organization/departmentTree";
import { listDepartments, listPositions } from "@/lib/modules/organization/organization.service";
import { listRoles } from "@/lib/modules/rbac/rbac.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function flattenDeptOptions(roots: DepartmentNode[]) {
  const out: Array<{ id: string; label: string }> = [];
  const stack: Array<{ node: DepartmentNode; depth: number }> = roots.map((n) => ({ node: n, depth: 0 })).reverse();

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    const prefix = depth === 0 ? "" : `${"—".repeat(depth)} `;
    out.push({ id: node.id, label: `${prefix}${node.name}` });

    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: node.children[i]!, depth: depth + 1 });
    }
  }

  return out;
}

function buildConsoleUsersHref(params: {
  q?: string;
  status?: string;
  roleId?: string;
  departmentId?: string;
  positionId?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.roleId) sp.set("roleId", params.roleId);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.positionId) sp.set("positionId", params.positionId);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortOrder) sp.set("sortOrder", params.sortOrder);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/console/users?${query}` : "/console/users";
}

export default async function ConsoleUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePerm("campus:user:list");

  const sp = await searchParams;

  const q = pickString(sp.q) ?? "";
  const status = pickString(sp.status);
  const statusValue =
    status === "pending_email_verification" || status === "pending_approval" || status === "active" || status === "disabled" || status === "banned"
      ? status
      : undefined;

  const roleId = pickString(sp.roleId);
  const departmentId = pickString(sp.departmentId);
  const positionId = pickString(sp.positionId);

  const sortByRaw = pickString(sp.sortBy);
  const sortBy = sortByRaw === "createdAt" || sortByRaw === "updatedAt" || sortByRaw === "lastLoginAt" ? sortByRaw : "createdAt";
  const sortOrderRaw = pickString(sp.sortOrder);
  const sortOrder = sortOrderRaw === "asc" || sortOrderRaw === "desc" ? sortOrderRaw : "desc";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const [canCreate, canInvite, rolesData, departmentsData, positionsData, data] = await Promise.all([
    hasPerm(user.id, "campus:user:create"),
    hasPerm(user.id, "campus:user:invite"),
    listRoles(),
    listDepartments(),
    listPositions(),
    listConsoleUsers({
      actorUserId: user.id,
      page,
      pageSize,
      q: q.trim() ? q.trim() : undefined,
      status: statusValue as Parameters<typeof listConsoleUsers>[0]["status"] | undefined,
      roleId,
      departmentId,
      positionId,
      sortBy,
      sortOrder,
    }),
  ]);

  const roleById = new Map(rolesData.items.map((r) => [r.id, r]));
  const deptById = new Map(departmentsData.items.map((d) => [d.id, d]));
  const posById = new Map(positionsData.items.map((p) => [p.id, p]));

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (data.total > 0 && page > totalPages) {
    redirect(
      buildConsoleUsersHref({
        q,
        status: statusValue,
        roleId,
        departmentId,
        positionId,
        sortBy,
        sortOrder,
        page: totalPages,
        pageSize,
      }),
    );
  }

  const deptOptions = flattenDeptOptions(buildDepartmentTree(departmentsData.items).roots);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">用户</h1>
          <p className="text-sm text-muted-foreground">支持自助注册 + 邮箱验证；管理员可手动创建/邀请，用户生命周期由 Supabase Auth + profile.status 驱动。</p>
          <div className="text-sm text-muted-foreground">
            共 {data.total} 人 · 第 {displayPage} / {totalPages} 页
          </div>
        </div>
        <CreateUserDialog canCreate={canCreate} canInvite={canInvite} />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="page" value="1" />
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">关键词</label>
            <Input
              name="q"
              uiSize="sm"
              className="w-56"
              placeholder="姓名/邮箱/学号"
              defaultValue={q}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">状态</label>
            <Select
              name="status"
              defaultValue={statusValue ?? ""}
              uiSize="sm"
              className="w-44"
            >
              <option value="">全部</option>
              <option value="active">启用</option>
              <option value="pending_approval">待审核</option>
              <option value="pending_email_verification">待邮箱验证</option>
              <option value="disabled">停用</option>
              <option value="banned">封禁</option>
            </Select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">角色</label>
            <Select
              name="roleId"
              defaultValue={roleId ?? ""}
              uiSize="sm"
              className="w-48"
            >
              <option value="">全部</option>
              {rolesData.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">部门（含子部门）</label>
            <Select
              name="departmentId"
              defaultValue={departmentId ?? ""}
              uiSize="sm"
              className="w-56"
            >
              <option value="">全部</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">岗位</label>
            <Select
              name="positionId"
              defaultValue={positionId ?? ""}
              uiSize="sm"
              className="w-48"
            >
              <option value="">全部</option>
              {positionsData.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} · ` : ""}
                  {p.name}
                  {p.enabled ? "" : "（停用）"}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">排序</label>
            <Select
              name="sortBy"
              defaultValue={sortBy}
              uiSize="sm"
              className="w-36"
            >
              <option value="createdAt">创建时间</option>
              <option value="updatedAt">更新时间</option>
              <option value="lastLoginAt">最近登录</option>
            </Select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">顺序</label>
            <Select
              name="sortOrder"
              defaultValue={sortOrder}
              uiSize="sm"
              className="w-28"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </Select>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">分页</label>
            <Select
              name="pageSize"
              defaultValue={String(pageSize)}
              uiSize="sm"
              className="w-28"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}/页
                </option>
              ))}
            </Select>
          </div>

          <Button size="sm" type="submit">
            筛选
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">用户</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">角色</th>
              <th className="px-3 py-2">部门</th>
              <th className="px-3 py-2">岗位</th>
              <th className="px-3 py-2">最近登录</th>
              <th className="px-3 py-2">更新时间</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={8}>
                  暂无用户
                </td>
              </tr>
            ) : null}

            {data.items.map((u) => {
              const roleLabels = u.roleIds
                .map((id) => roleById.get(id)?.code ?? "未知角色")
                .slice(0, 2);
              const deptLabels = u.departmentIds
                .map((id) => deptById.get(id)?.name ?? "未知部门")
                .slice(0, 2);
              const posLabels = u.positionIds
                .map((id) => posById.get(id)?.name ?? "未知岗位")
                .slice(0, 2);

              return (
                <tr key={u.id} className="border-t border-border/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{u.name}</span>
                      {!u.emailVerified ? (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">未验证邮箱</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {u.studentId} · {u.email ?? "无邮箱"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <UserStatusBadge status={u.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {roleLabels.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : null}
                      {roleLabels.map((label) => (
                        <span key={label} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {label}
                        </span>
                      ))}
                      {u.roleIds.length > roleLabels.length ? (
                        <span className="text-xs text-muted-foreground">+{u.roleIds.length - roleLabels.length}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {deptLabels.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : null}
                      {deptLabels.map((label) => (
                        <span key={label} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {label}
                        </span>
                      ))}
                      {u.departmentIds.length > deptLabels.length ? (
                        <span className="text-xs text-muted-foreground">+{u.departmentIds.length - deptLabels.length}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {posLabels.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : null}
                      {posLabels.map((label) => (
                        <span key={label} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {label}
                        </span>
                      ))}
                      {u.positionIds.length > posLabels.length ? (
                        <span className="text-xs text-muted-foreground">+{u.positionIds.length - posLabels.length}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.updatedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      href={`/console/users/${u.id}`}
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={displayPage}
        totalPages={totalPages}
        hrefForPage={(nextPage) =>
          buildConsoleUsersHref({
            q,
            status: statusValue,
            roleId,
            departmentId,
            positionId,
            sortBy,
            sortOrder,
            page: nextPage,
            pageSize,
          })
        }
      />
    </div>
  );
}
