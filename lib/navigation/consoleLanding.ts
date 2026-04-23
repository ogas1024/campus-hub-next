import "server-only";

import { getPermissionChecker } from "@/lib/auth/permissions";
import { consoleModules } from "@/lib/navigation/modules";

const preferredConsoleModuleIds = ["users"] as const;

export async function resolveConsoleLandingHref(userId: string): Promise<string | null> {
  const checker = await getPermissionChecker(userId);
  const preferred = preferredConsoleModuleIds
    .map((id) => consoleModules.find((module) => module.id === id))
    .filter((module): module is NonNullable<typeof module> => module != null);

  const orderedModules = [...preferred, ...consoleModules.filter((module) => !preferred.some((candidate) => candidate.id === module.id))];

  for (const module of orderedModules) {
    if (checker.hasAnyPerm(module.permCodes)) return module.href;
  }

  return null;
}
