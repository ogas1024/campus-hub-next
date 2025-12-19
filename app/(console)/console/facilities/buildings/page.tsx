/**
 * 用法：
 * - Console：楼房管理（CRUD + 启停）。
 */

import { requirePerm } from "@/lib/auth/permissions";
import { ConsoleBuildingsManager } from "@/components/facilities/console/ConsoleBuildingsManager";

export default async function ConsoleFacilityBuildingsPage() {
  await requirePerm("campus:facility:*");
  return <ConsoleBuildingsManager />;
}

