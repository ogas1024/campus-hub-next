/**
 * 用法：
 * - `pnpm -C "campus-hub-next" test` 运行偏好模型的纯函数单测。
 */

import { describe, expect, it } from "vitest";

import {
  applyWorkbenchPreferencesToCards,
  applyWorkbenchPreferencesToQuickLinks,
  defaultPortalHomePreferences,
  defaultWorkbenchPreferences,
  mergePreferredIdOrder,
  normalizePortalHomePreferences,
  normalizeWorkbenchPreferences,
} from "@/lib/workbench/preferences";
import type { WorkbenchCard, WorkbenchQuickLink } from "@/lib/workbench/types";

describe("workbench.preferences", () => {
  it("normalizeWorkbenchPreferences: 非法输入回退默认", () => {
    expect(normalizeWorkbenchPreferences(null)).toEqual(defaultWorkbenchPreferences);
    expect(normalizeWorkbenchPreferences("bad")).toEqual(defaultWorkbenchPreferences);
  });

  it("normalizeWorkbenchPreferences: 归一化列表并去重/去空", () => {
    const prefs = normalizeWorkbenchPreferences({
      reminderWindowDays: 14,
      cardOrder: [" a ", "", "b", "a", 1],
      hiddenCardIds: ["b", "  ", "c"],
      quickLinkOrder: ["x", "x", " y "],
      hiddenQuickLinkIds: ["y"],
    });
    expect(prefs.reminderWindowDays).toBe(14);
    expect(prefs.cardOrder).toEqual(["a", "b"]);
    expect(prefs.hiddenCardIds).toEqual(["b", "c"]);
    expect(prefs.quickLinkOrder).toEqual(["x", "y"]);
    expect(prefs.hiddenQuickLinkIds).toEqual(["y"]);
  });

  it("mergePreferredIdOrder: 优先顺序 + 保留剩余", () => {
    expect(mergePreferredIdOrder({ allIds: ["a", "b", "c"], preferredOrder: ["c", "a"] })).toEqual(["c", "a", "b"]);
    expect(mergePreferredIdOrder({ allIds: ["a"], preferredOrder: ["x", "a", "a"] })).toEqual(["a"]);
  });

  it("applyWorkbenchPreferencesToCards: 隐藏 + 排序", () => {
    const cards: WorkbenchCard[] = [
      { id: "a", title: "A", metrics: [], actions: [] },
      { id: "b", title: "B", metrics: [], actions: [] },
      { id: "c", title: "C", metrics: [], actions: [] },
    ];
    const prefs = normalizeWorkbenchPreferences({ cardOrder: ["c", "a"], hiddenCardIds: ["b"] });
    expect(applyWorkbenchPreferencesToCards(cards, prefs).map((c) => c.id)).toEqual(["c", "a"]);
  });

  it("applyWorkbenchPreferencesToQuickLinks: 隐藏 + 排序", () => {
    const links: WorkbenchQuickLink[] = [
      { id: "x", label: "X", href: "/x" },
      { id: "y", label: "Y", href: "/y" },
      { id: "z", label: "Z", href: "/z" },
    ];
    const prefs = normalizeWorkbenchPreferences({ quickLinkOrder: ["z", "x"], hiddenQuickLinkIds: ["y"] });
    expect(applyWorkbenchPreferencesToQuickLinks(links, prefs).map((l) => l.id)).toEqual(["z", "x"]);
  });

  it("normalizePortalHomePreferences: 过滤非法 moduleId，空则回退默认", () => {
    expect(normalizePortalHomePreferences(null)).toEqual(defaultPortalHomePreferences);
    expect(normalizePortalHomePreferences({ favoriteModuleIds: [] })).toEqual(defaultPortalHomePreferences);
    expect(normalizePortalHomePreferences({ favoriteModuleIds: ["__bad__"] })).toEqual(defaultPortalHomePreferences);
  });
});
