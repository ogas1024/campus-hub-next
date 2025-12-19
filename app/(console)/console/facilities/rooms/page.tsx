/**
 * 用法：
 * - Console：房间管理（楼房/楼层筛选 + 房间 CRUD + 启停）。
 */

import { requirePerm } from "@/lib/auth/permissions";
import { ConsoleRoomsManager } from "@/components/facilities/console/ConsoleRoomsManager";

export default async function ConsoleFacilityRoomsPage() {
  await requirePerm("campus:facility:*");
  return <ConsoleRoomsManager />;
}

