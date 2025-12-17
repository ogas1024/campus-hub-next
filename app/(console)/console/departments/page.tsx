import { DepartmentsManager } from "@/components/organization/DepartmentsManager";
import { requirePerm } from "@/lib/auth/permissions";
import { listDepartments } from "@/lib/modules/organization/organization.service";

export default async function ConsoleDepartmentsPage() {
  await requirePerm("campus:department:*");
  const data = await listDepartments();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">部门</h1>
        <p className="text-sm text-muted-foreground">树形组织结构；删除限制：存在子部门或用户绑定则禁止删除。</p>
      </div>

      <DepartmentsManager departments={data.items} />
    </div>
  );
}
