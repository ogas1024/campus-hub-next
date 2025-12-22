import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { departments, positions, roles } from "@campus-hub/db";

export type VisibilityScopeOptions = {
  roles: Array<{ id: string; name: string; code: string }>;
  departments: Array<{ id: string; name: string; parentId: string | null }>;
  positions: Array<{ id: string; name: string }>;
};

export async function getVisibilityScopeOptions(): Promise<VisibilityScopeOptions> {
  const [roleRows, deptRows, positionRows] = await Promise.all([
    db.select({ id: roles.id, name: roles.name, code: roles.code }).from(roles).orderBy(desc(roles.updatedAt)),
    db.select({ id: departments.id, name: departments.name, parentId: departments.parentId }).from(departments).orderBy(desc(departments.updatedAt)),
    db.select({ id: positions.id, name: positions.name }).from(positions).orderBy(desc(positions.updatedAt)),
  ]);

  return {
    roles: roleRows.map((r) => ({ id: r.id, name: r.name, code: r.code })),
    departments: deptRows.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId })),
    positions: positionRows.map((p) => ({ id: p.id, name: p.name })),
  };
}

