/**
 * 用法：
 * - Console：模块封禁管理（封禁/解封；仅影响“创建新预约”）。
 */

import { requirePerm } from "@/lib/auth/permissions";
import { ConsoleBansManager } from "@/components/facilities/console/ConsoleBansManager";

export default async function ConsoleFacilityBansPage() {
  await requirePerm("campus:facility:ban");
  return <ConsoleBansManager />;
}

