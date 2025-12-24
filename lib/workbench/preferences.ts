import type { PortalModuleId } from "@/lib/navigation/modules";
import { portalModules } from "@/lib/navigation/modules";
import {
  ANALYTICS_TEMPLATE_DEFAULTS,
  ANALYTICS_WIDGET_SIZES,
  analyticsSceneIdSet,
  analyticsTemplateIdSet,
  analyticsWidgetIdSet,
  type AnalyticsLayoutTemplateId,
  type AnalyticsSceneId,
  type AnalyticsWidgetId,
  type AnalyticsWidgetSize,
} from "@/lib/workbench/analytics";

import type { WorkbenchCard, WorkbenchQuickLink } from "./types";

export const WORKBENCH_PREFERENCES_COOKIE_NAME = "campus_hub_workbench_prefs";
export const WORKBENCH_ANALYTICS_PREFERENCES_COOKIE_NAME = "campus_hub_workbench_analytics_prefs";
export const PORTAL_HOME_PREFERENCES_COOKIE_NAME = "campus_hub_portal_home_prefs";

export const WORKBENCH_REMINDER_WINDOW_DAYS_OPTIONS = [3, 7, 14, 30] as const;
export type WorkbenchReminderWindowDays = (typeof WORKBENCH_REMINDER_WINDOW_DAYS_OPTIONS)[number];

export type WorkbenchPreferences = {
  version: 1;
  reminderWindowDays: WorkbenchReminderWindowDays;
  cardOrder: string[];
  hiddenCardIds: string[];
  quickLinkOrder: string[];
  hiddenQuickLinkIds: string[];
};

export const defaultWorkbenchPreferences: WorkbenchPreferences = {
  version: 1,
  reminderWindowDays: 7,
  cardOrder: [],
  hiddenCardIds: [],
  quickLinkOrder: [],
  hiddenQuickLinkIds: [],
};

export type WorkbenchAnalyticsPreferences = {
  version: 2;
  templateId: AnalyticsLayoutTemplateId;
  sceneOrder: AnalyticsSceneId[];
  hiddenSceneIds: AnalyticsSceneId[];
  widgetOrder: AnalyticsWidgetId[];
  hiddenWidgetIds: AnalyticsWidgetId[];
  widgetSizeById: Record<AnalyticsWidgetId, AnalyticsWidgetSize>;
  autoRefreshEnabled: boolean;
  autoRotateEnabled: boolean;
};

export const defaultWorkbenchAnalyticsPreferences: WorkbenchAnalyticsPreferences = {
  version: 2,
  templateId: "balanced",
  sceneOrder: [...ANALYTICS_TEMPLATE_DEFAULTS.balanced.sceneOrder],
  hiddenSceneIds: [],
  widgetOrder: [],
  hiddenWidgetIds: [],
  widgetSizeById: ANALYTICS_TEMPLATE_DEFAULTS.balanced.widgetSizeById,
  autoRefreshEnabled: true,
  autoRotateEnabled: true,
};

export type PortalHomePreferences = {
  version: 1;
  favoriteModuleIds: PortalModuleId[];
};

export const defaultPortalHomePreferences: PortalHomePreferences = {
  version: 1,
  favoriteModuleIds: portalModules.slice(0, 4).map((m) => m.id),
};

function normalizeIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function normalizeBoolean(input: unknown, defaultValue: boolean) {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    const v = input.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return defaultValue;
}

function normalizeReminderWindowDays(input: unknown): WorkbenchReminderWindowDays {
  const value = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
  const normalized = Number.isFinite(value) ? (value as number) : NaN;
  return (WORKBENCH_REMINDER_WINDOW_DAYS_OPTIONS as readonly number[]).includes(normalized) ? (normalized as WorkbenchReminderWindowDays) : 7;
}

function normalizeObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

export function normalizeWorkbenchPreferences(input: unknown): WorkbenchPreferences {
  const obj = normalizeObject(input);
  return {
    ...defaultWorkbenchPreferences,
    reminderWindowDays: normalizeReminderWindowDays(obj.reminderWindowDays),
    cardOrder: normalizeIdList(obj.cardOrder),
    hiddenCardIds: normalizeIdList(obj.hiddenCardIds),
    quickLinkOrder: normalizeIdList(obj.quickLinkOrder),
    hiddenQuickLinkIds: normalizeIdList(obj.hiddenQuickLinkIds),
  };
}

export function normalizeWorkbenchAnalyticsPreferences(input: unknown): WorkbenchAnalyticsPreferences {
  const obj = normalizeObject(input);
  const rawTemplateId = typeof obj.templateId === "string" ? (obj.templateId.trim() as AnalyticsLayoutTemplateId) : null;
  const templateId = rawTemplateId && analyticsTemplateIdSet.has(rawTemplateId) ? rawTemplateId : defaultWorkbenchAnalyticsPreferences.templateId;
  const templateDefaults = ANALYTICS_TEMPLATE_DEFAULTS[templateId];

  const sceneOrderRaw = Array.isArray(obj.sceneOrder) ? obj.sceneOrder : null;
  const sceneOrder = normalizeIdList(sceneOrderRaw)
    .map((id) => id as AnalyticsSceneId)
    .filter((id) => analyticsSceneIdSet.has(id));
  const normalizedSceneOrder = sceneOrder.length > 0 ? sceneOrder : [...templateDefaults.sceneOrder];

  const hiddenSceneRaw = Array.isArray(obj.hiddenSceneIds) ? obj.hiddenSceneIds : null;
  const hiddenSceneIds = normalizeIdList(hiddenSceneRaw)
    .map((id) => id as AnalyticsSceneId)
    .filter((id) => analyticsSceneIdSet.has(id));

  const widgetOrderInput = Array.isArray(obj.widgetOrder) ? obj.widgetOrder : Array.isArray(obj.chartOrder) ? obj.chartOrder : null;
  const widgetOrder = normalizeIdList(widgetOrderInput)
    .map((id) => id as AnalyticsWidgetId)
    .filter((id) => analyticsWidgetIdSet.has(id));

  const hiddenWidgetInput = Array.isArray(obj.hiddenWidgetIds) ? obj.hiddenWidgetIds : Array.isArray(obj.hiddenChartIds) ? obj.hiddenChartIds : null;
  const hiddenWidgetIds = normalizeIdList(hiddenWidgetInput)
    .map((id) => id as AnalyticsWidgetId)
    .filter((id) => analyticsWidgetIdSet.has(id));

  const widgetSizeByIdInput = normalizeObject(obj.widgetSizeById);
  const widgetSizeById: Record<AnalyticsWidgetId, AnalyticsWidgetSize> = { ...templateDefaults.widgetSizeById };
  for (const [key, value] of Object.entries(widgetSizeByIdInput)) {
    const id = key as AnalyticsWidgetId;
    if (!analyticsWidgetIdSet.has(id)) continue;
    const size = typeof value === "string" ? (value.trim() as AnalyticsWidgetSize) : null;
    if (!size) continue;
    if (!(ANALYTICS_WIDGET_SIZES as readonly string[]).includes(size)) continue;
    widgetSizeById[id] = size;
  }

  const autoRefreshEnabled = normalizeBoolean(obj.autoRefreshEnabled, defaultWorkbenchAnalyticsPreferences.autoRefreshEnabled);
  const autoRotateEnabled = normalizeBoolean(obj.autoRotateEnabled, defaultWorkbenchAnalyticsPreferences.autoRotateEnabled);

  return {
    ...defaultWorkbenchAnalyticsPreferences,
    templateId,
    sceneOrder: normalizedSceneOrder,
    hiddenSceneIds,
    widgetOrder,
    hiddenWidgetIds,
    widgetSizeById,
    autoRefreshEnabled,
    autoRotateEnabled,
  };
}

const portalModuleIdSet = new Set<PortalModuleId>(portalModules.map((m) => m.id));

function normalizePortalModuleIdList(input: unknown): PortalModuleId[] {
  if (!Array.isArray(input)) return [];
  const result: PortalModuleId[] = [];
  const seen = new Set<PortalModuleId>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    const id = v.trim() as PortalModuleId;
    if (!portalModuleIdSet.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function normalizePortalHomePreferences(input: unknown): PortalHomePreferences {
  const obj = normalizeObject(input);
  const favoriteModuleIds = normalizePortalModuleIdList(obj.favoriteModuleIds);
  return favoriteModuleIds.length === 0 ? defaultPortalHomePreferences : { ...defaultPortalHomePreferences, favoriteModuleIds };
}

export function mergePreferredIdOrder(params: { allIds: readonly string[]; preferredOrder: readonly string[] }): string[] {
  const exists = new Set(params.allIds);
  const head: string[] = [];
  const headSet = new Set<string>();
  for (const id of params.preferredOrder) {
    if (!exists.has(id)) continue;
    if (headSet.has(id)) continue;
    headSet.add(id);
    head.push(id);
  }
  const tail = params.allIds.filter((id) => !headSet.has(id));
  return [...head, ...tail];
}

export function applyWorkbenchPreferencesToCards(cards: WorkbenchCard[], prefs: WorkbenchPreferences): WorkbenchCard[] {
  const hidden = new Set(prefs.hiddenCardIds);
  const visible = cards.filter((c) => !hidden.has(c.id));
  const orderedIds = mergePreferredIdOrder({ allIds: visible.map((c) => c.id), preferredOrder: prefs.cardOrder });

  const byId = new Map(visible.map((c) => [c.id, c] as const));
  return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
}

export function applyWorkbenchPreferencesToQuickLinks(links: WorkbenchQuickLink[], prefs: WorkbenchPreferences): WorkbenchQuickLink[] {
  const hidden = new Set(prefs.hiddenQuickLinkIds);
  const visible = links.filter((l) => !hidden.has(l.id));
  const orderedIds = mergePreferredIdOrder({ allIds: visible.map((l) => l.id), preferredOrder: prefs.quickLinkOrder });

  const byId = new Map(visible.map((l) => [l.id, l] as const));
  return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
}
