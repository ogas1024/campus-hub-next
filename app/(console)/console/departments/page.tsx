import { PageHeader } from "@/components/common/PageHeader";
import { DepartmentsManager } from "@/components/organization/DepartmentsManager";
import { requirePerm } from "@/lib/auth/permissions";
import { listDepartments } from "@/lib/modules/organization/organization.service";

export default async function ConsoleDepartmentsPage() {
  await requirePerm("campus:department:*");
  const data = await listDepartments();

  return (
    <div className="space-y-4">
      <PageHeader title="部门" description="树形组织结构；删除限制：存在子部门或用户绑定则禁止删除。" />

      <DepartmentsManager departments={data.items} />
    </div>
  );
}
