import "server-only";

import { getPermissionChecker } from "@/lib/auth/permissions";

import type { WorkbenchContext } from "./types";

export function createWorkbenchContext(params: { actorUserId: string; now?: Date; settings?: WorkbenchContext["settings"] }): WorkbenchContext {
  const now = params.now ?? new Date();
  const settings = params.settings ?? { reminderWindowDays: 7 };

  const permCache = new Map<string, Promise<boolean>>();
  const anyPermCache = new Map<string, Promise<boolean>>();
  let checkerPromise: ReturnType<typeof getPermissionChecker> | null = null;

  function getChecker() {
    checkerPromise ??= getPermissionChecker(params.actorUserId);
    return checkerPromise;
  }

  async function canPerm(permCode: string) {
    const cached = permCache.get(permCode);
    if (cached) return cached;
    const promise = getChecker().then((checker) => checker.hasPerm(permCode));
    permCache.set(permCode, promise);
    return promise;
  }

  async function canAnyPerm(permCodes: readonly string[]) {
    const uniqueSorted = [...new Set(permCodes)].sort();
    const cacheKey = uniqueSorted.join("|");
    const cached = anyPermCache.get(cacheKey);
    if (cached) return cached;
    const promise = getChecker().then((checker) => checker.hasAnyPerm(uniqueSorted));
    anyPermCache.set(cacheKey, promise);
    return promise;
  }

  return {
    actorUserId: params.actorUserId,
    now,
    settings,
    canPerm,
    canAnyPerm,
  };
}
