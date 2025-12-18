import { PositionsManager } from "@/components/organization/PositionsManager";
import { requirePerm } from "@/lib/auth/permissions";
import { listPositions } from "@/lib/modules/organization/organization.service";

export default async function ConsolePositionsPage() {
  await requirePerm("campus:position:*");
  const data = await listPositions();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">岗位</h1>
        <p className="text-sm text-muted-foreground">岗位支持启停；删除岗位会自动解绑用户（不影响用户本身）。</p>
      </div>

      <PositionsManager
        positions={data.items.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          enabled: p.enabled,
          sort: p.sort,
        }))}
      />
    </div>
  );
}
