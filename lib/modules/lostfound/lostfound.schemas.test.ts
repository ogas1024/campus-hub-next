import { describe, expect, it } from "vitest";

import { createLostfoundItemBodySchema, updateLostfoundItemBodySchema } from "@/lib/modules/lostfound/lostfound.schemas";

describe("lostfound.schemas", () => {
  it("create schema 接受基本字段", () => {
    const parsed = createLostfoundItemBodySchema.safeParse({
      type: "lost",
      title: "丢了钥匙",
      content: "在图书馆附近遗失一串钥匙。",
      location: "图书馆",
      occurredAt: "2025-12-21T00:00:00Z",
      contactInfo: "vx: xxx",
      imageKeys: [],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.type).toBe("lost");
    expect(parsed.data.location).toBe("图书馆");
  });

  it("update schema 至少 1 个字段", () => {
    expect(updateLostfoundItemBodySchema.safeParse({}).success).toBe(false);
    expect(updateLostfoundItemBodySchema.safeParse({ title: "更新标题", occurredAt: null }).success).toBe(true);
  });
});

