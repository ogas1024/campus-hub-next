import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePerm } from "@/lib/auth/permissions";
import { listPermissions } from "@/lib/modules/rbac/rbac.service";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConsolePermissionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePerm("campus:permission:*");
  const sp = await searchParams;
  const q = (pickString(sp.q) ?? "").trim().toLowerCase();

  const data = await listPermissions();
  const items = q
    ? data.items.filter((p) => `${p.code} ${p.description ?? ""}`.toLowerCase().includes(q))
    : data.items;

  return (
    <div className="space-y-4">
      <PageHeader
        title="权限字典"
        description="只读；权限码由迁移/代码声明式注册（支持 `*` 通配）。"
        meta={
          <>
            <span>共 {data.items.length} 条</span>
            <span>当前 {items.length} 条</span>
          </>
        }
      />

      <FiltersPanel title="筛选">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">搜索</label>
            <Input
              name="q"
              uiSize="sm"
              className="w-72"
              placeholder="按权限码/描述搜索…"
              defaultValue={q}
            />
          </div>
          <Button size="sm" type="submit">
            筛选
          </Button>
        </form>
      </FiltersPanel>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">权限码</th>
              <th className="px-3 py-2">描述</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={2}>
                  无匹配权限
                </td>
              </tr>
            ) : null}

            {items.map((p) => (
              <tr key={p.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-xs text-foreground">{p.code}</td>
                <td className="px-3 py-2 text-sm text-muted-foreground">{p.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
