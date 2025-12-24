import { PageHeader } from "@/components/common/PageHeader";
import { RegistrationConfigCard } from "@/components/config/RegistrationConfigCard";
import { requirePerm } from "@/lib/auth/permissions";
import { getRegistrationConfig } from "@/lib/modules/config/config.service";

export default async function ConsoleConfigPage() {
  await requirePerm("campus:config:update");
  const data = await getRegistrationConfig();

  return (
    <div className="space-y-4">
      <PageHeader title="配置" description="平台级开关（MVP）：注册审核。" />

      <RegistrationConfigCard requiresApproval={data.requiresApproval} />
    </div>
  );
}
