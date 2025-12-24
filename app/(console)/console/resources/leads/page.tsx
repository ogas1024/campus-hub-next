import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { MajorsManager } from "@/components/course-resources/MajorsManager";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { listConsoleMajors } from "@/lib/modules/course-resources/courseResources.service";

export default async function ConsoleResourceLeadsPage() {
  const user = await requirePerm("campus:resource:major_lead_update");

  const [canUserList, majors] = await Promise.all([
    hasPerm(user.id, "campus:user:list"),
    listConsoleMajors(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="专业负责人"
        description="维护 major_lead 映射：一个专业可配置多个负责人；一个用户可负责多个专业。"
        actions={
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/audit?targetType=major">
            查看审计
          </Link>
        }
      />

      <Card>
        <CardContent className="p-4">
          <MajorsManager
            majors={majors}
            canCreate={false}
            canUpdate={false}
            canDelete={false}
            canUpdateLeads={true}
            canUserList={canUserList}
          />
        </CardContent>
      </Card>
    </div>
  );
}
