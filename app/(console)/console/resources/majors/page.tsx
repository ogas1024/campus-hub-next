import { PageHeader } from "@/components/common/PageHeader";
import { MajorsManager } from "@/components/course-resources/MajorsManager";
import { Card, CardContent } from "@/components/ui/card";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { listConsoleMajors } from "@/lib/modules/course-resources/courseResources.service";

export default async function ConsoleResourceMajorsPage() {
  const user = await requirePerm("campus:resource:major_list");

  const [canCreate, canUpdate, canDelete, canUpdateLeads, canUserList, majors] = await Promise.all([
    hasPerm(user.id, "campus:resource:major_create"),
    hasPerm(user.id, "campus:resource:major_update"),
    hasPerm(user.id, "campus:resource:major_delete"),
    hasPerm(user.id, "campus:resource:major_lead_update"),
    hasPerm(user.id, "campus:user:list"),
    listConsoleMajors(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="专业管理" description="维护专业字典与负责人映射（major_lead）。专业为软删，不级联删除课程/资源。" />

      <Card>
        <CardContent className="p-4">
          <MajorsManager
            majors={majors}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canUpdateLeads={canUpdateLeads}
            canUserList={canUserList}
          />
        </CardContent>
      </Card>
    </div>
  );
}
