import "server-only";

import type { WorkbenchCard, WorkbenchContext, WorkbenchProvider, WorkbenchQuickLink } from "./types";

import { courseResourcesWorkbenchProvider } from "@/lib/modules/course-resources/courseResources.workbench";
import { facilitiesWorkbenchProvider } from "@/lib/modules/facilities/facilities.workbench";
import { libraryWorkbenchProvider } from "@/lib/modules/library/library.workbench";
import { lostfoundWorkbenchProvider } from "@/lib/modules/lostfound/lostfound.workbench";
import { materialsWorkbenchProvider } from "@/lib/modules/materials/materials.workbench";
import { noticesWorkbenchProvider } from "@/lib/modules/notices/notices.workbench";
import { surveysWorkbenchProvider } from "@/lib/modules/surveys/surveys.workbench";
import { votesWorkbenchProvider } from "@/lib/modules/votes/votes.workbench";
import { infraWorkbenchProvider } from "@/lib/workbench/system.workbench";

const providers: WorkbenchProvider[] = [
  noticesWorkbenchProvider,
  materialsWorkbenchProvider,
  courseResourcesWorkbenchProvider,
  facilitiesWorkbenchProvider,
  libraryWorkbenchProvider,
  surveysWorkbenchProvider,
  votesWorkbenchProvider,
  lostfoundWorkbenchProvider,
  infraWorkbenchProvider,
];

type WorkbenchContributions = {
  cards: WorkbenchCard[];
  quickLinks: WorkbenchQuickLink[];
};

function sortByOrderThenLabel<T extends { order?: number; title?: string; label?: string }>(a: T, b: T) {
  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  const al = a.title ?? a.label ?? "";
  const bl = b.title ?? b.label ?? "";
  return al.localeCompare(bl, "zh-Hans-CN");
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

const contributionsCache = new WeakMap<WorkbenchContext, Promise<WorkbenchContributions>>();

async function collectWorkbenchContributionsUncached(ctx: WorkbenchContext): Promise<WorkbenchContributions> {
  const rows = await Promise.all(
    providers.map(async (p) => {
      const [cards, quickLinks] = await Promise.all([
        p.getCards?.(ctx) ?? Promise.resolve([]),
        p.getQuickLinks?.(ctx) ?? Promise.resolve([]),
      ]);
      return { cards, quickLinks };
    }),
  );

  const cards = dedupeById(rows.flatMap((r) => r.cards)).sort(sortByOrderThenLabel);
  const quickLinks = dedupeById(rows.flatMap((r) => r.quickLinks)).sort(sortByOrderThenLabel);
  return { cards, quickLinks };
}

export function collectWorkbenchContributions(ctx: WorkbenchContext) {
  const cached = contributionsCache.get(ctx);
  if (cached) return cached;
  const promise = collectWorkbenchContributionsUncached(ctx);
  contributionsCache.set(ctx, promise);
  return promise;
}

export async function collectWorkbenchCards(ctx: WorkbenchContext): Promise<WorkbenchCard[]> {
  const { cards } = await collectWorkbenchContributions(ctx);
  return cards;
}

export async function collectWorkbenchQuickLinks(ctx: WorkbenchContext): Promise<WorkbenchQuickLink[]> {
  const { quickLinks } = await collectWorkbenchContributions(ctx);
  return quickLinks;
}
