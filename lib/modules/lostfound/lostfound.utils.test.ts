/**
 * 用法：
 * - `pnpm -C "campus-hub-next" test` 运行本模块的纯函数单测。
 */

import { describe, expect, it } from "vitest";

import { assertOwnedImageKeys, parseIsoDateTimeOrNull, requireUuid } from "@/lib/modules/lostfound/lostfound.utils";

describe("lostfound.utils", () => {
  it("requireUuid 校验 UUID", () => {
    expect(requireUuid("00000000-0000-4000-8000-000000000000", "id")).toBe("00000000-0000-4000-8000-000000000000");
    expect(() => requireUuid("", "id")).toThrow();
    expect(() => requireUuid("not-a-uuid", "id")).toThrow();
  });

  it("parseIsoDateTimeOrNull 解析时间", () => {
    expect(parseIsoDateTimeOrNull(null, "from")).toBeNull();
    expect(parseIsoDateTimeOrNull("   ", "from")).toBeNull();
    expect(parseIsoDateTimeOrNull("2025-12-21T00:00:00Z", "from")?.toISOString()).toBe("2025-12-21T00:00:00.000Z");
    expect(() => parseIsoDateTimeOrNull("invalid", "from")).toThrow();
  });

  it("assertOwnedImageKeys 校验归属与去重", () => {
    const userId = "u1";
    const ok = assertOwnedImageKeys({
      userId,
      keys: [" users/u1/lostfound/a.webp ", "users/u1/lostfound/b.webp"],
      max: 9,
    });
    expect(ok).toEqual(["users/u1/lostfound/a.webp", "users/u1/lostfound/b.webp"]);

    expect(() =>
      assertOwnedImageKeys({ userId, keys: ["users/u2/lostfound/a.webp"], max: 9 }),
    ).toThrow();

    expect(() =>
      assertOwnedImageKeys({ userId, keys: ["users/u1/lostfound/a.webp", "users/u1/lostfound/a.webp"], max: 9 }),
    ).toThrow();
  });
});

