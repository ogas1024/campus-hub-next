import { redirect } from "next/navigation";

import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { listConsoleMaterialSubmissions, getConsoleMaterialDetail, getMaterialScopeOptions } from "@/lib/modules/materials/materials.service";
import { buildDepartmentTree, type DepartmentNode } from "@/lib/modules/organization/departmentTree";

import { ConsoleMaterialSubmissionsClient } from "./submissionsClient";

type SearchParams = Record<string, string | string[] | undefined>;
type Params = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseIsoDate(value: string | undefined) {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
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

function buildConsoleMaterialSubmissionsHref(materialId: string, params: {
  q?: string;
  status?: string;
  missingRequired?: string;
  from?: string;
  to?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.missingRequired) sp.set("missingRequired", params.missingRequired);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const query = sp.toString();
  return query ? `/console/materials/${materialId}/submissions?${query}` : `/console/materials/${materialId}/submissions`;
}

export default async function ConsoleMaterialSubmissionsPage({ params, searchParams }: Params) {
  const user = await requirePerm("campus:material:process");
  const { id } = await params;

  const sp = await searchParams;
  const q = pickString(sp.q) ?? "";
  const status = pickString(sp.status);
  const statusValue = status === "pending" || status === "complete" || status === "need_more" || status === "approved" || status === "rejected" ? status : "";
  const missingRequiredRaw = pickString(sp.missingRequired) ?? "";
  const missingRequired = parseTriStateBooleanParam(missingRequiredRaw || null);
  const fromRaw = pickString(sp.from) ?? "";
  const toRaw = pickString(sp.to) ?? "";
  const departmentId = pickString(sp.departmentId) ?? "";

  const page = parseIntParam(pickString(sp.page) ?? null, { defaultValue: 1, min: 1 });
  const pageSize = parseIntParam(pickString(sp.pageSize) ?? null, { defaultValue: 20, min: 1, max: 50 });

  const [canExport, canManageAll, material, scopeOptions, submissions] = await Promise.all([
    hasPerm(user.id, "campus:material:export"),
    hasPerm(user.id, "campus:material:manage"),
    getConsoleMaterialDetail({ actorUserId: user.id, materialId: id }),
    getMaterialScopeOptions(),
    listConsoleMaterialSubmissions({
      actorUserId: user.id,
      materialId: id,
      page,
      pageSize,
      q: q.trim() ? q.trim() : undefined,
      status: statusValue ? (statusValue as Parameters<typeof listConsoleMaterialSubmissions>[0]["status"]) : undefined,
      missingRequired,
      from: parseIsoDate(fromRaw || undefined),
      to: parseIsoDate(toRaw || undefined),
      departmentId: departmentId.trim() ? departmentId.trim() : undefined,
    }),
  ]);

  const canOperate = material.createdBy === user.id || canManageAll;

  const { roots } = buildDepartmentTree(
    scopeOptions.departments.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId ?? null, sort: 0 })),
  );
  const deptOptions = flattenDeptOptions(roots);

  const initialData = {
    ...submissions,
    items: submissions.items.map((s) => ({
      ...s,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    })),
  };

  const totalPages = Math.max(1, Math.ceil(submissions.total / submissions.pageSize));
  const displayPage = Math.min(page, totalPages);
  if (submissions.total > 0 && page > totalPages) {
    redirect(
      buildConsoleMaterialSubmissionsHref(id, {
        q,
        status: statusValue || undefined,
        missingRequired: missingRequiredRaw || undefined,
        from: fromRaw || undefined,
        to: toRaw || undefined,
        departmentId: departmentId || undefined,
        page: totalPages,
        pageSize,
      }),
    );
  }

  return (
    <ConsoleMaterialSubmissionsClient
      materialId={id}
      materialTitle={material.title}
      currentUserId={user.id}
      canOperate={canOperate}
      canExport={canExport && canOperate}
      filters={{
        q,
        status: statusValue,
        missingRequired: missingRequiredRaw,
        from: fromRaw,
        to: toRaw,
        departmentId,
        page: displayPage,
        pageSize,
        totalPages,
        total: submissions.total,
      }}
      deptOptions={deptOptions}
      initialData={initialData}
    />
  );
}
