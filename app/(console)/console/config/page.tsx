import { RegistrationConfigCard } from "@/components/config/RegistrationConfigCard";
import { requirePerm } from "@/lib/auth/permissions";
import { getRegistrationConfig } from "@/lib/modules/config/config.service";

export default async function ConsoleConfigPage() {
  await requirePerm("campus:config:update");
  const data = await getRegistrationConfig();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">配置</h1>
        <p className="text-sm text-muted-foreground">平台级开关（MVP）：注册审核。</p>
      </div>

      <RegistrationConfigCard requiresApproval={data.requiresApproval} />
    </div>
  );
}
