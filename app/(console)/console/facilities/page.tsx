/**
 * 用法：
 * - `/console/facilities` 入口页：按权限自动跳转到第一个可访问的子页面。
 */

import { redirect } from "next/navigation";

import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleFacilitiesIndexPage() {
  const user = await requireUser();

  const [canManage, canReview, canBan, canConfig] = await Promise.all([
    hasPerm(user.id, "campus:facility:*"),
    hasPerm(user.id, "campus:facility:review"),
    hasPerm(user.id, "campus:facility:ban"),
    hasPerm(user.id, "campus:facility:config"),
  ]);

  const tabs = [
    canManage ? "/console/facilities/buildings" : null,
    canManage ? "/console/facilities/rooms" : null,
    canReview ? "/console/facilities/reservations" : null,
    canManage || canBan ? "/console/facilities/bans" : null,
    canManage || canConfig ? "/console/facilities/config" : null,
  ].filter((href): href is string => typeof href === "string");

  redirect(tabs[0] ?? "/console");
}

