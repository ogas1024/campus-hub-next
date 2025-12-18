import { describe, expect, it } from "vitest";

import { banBodySchema } from "./users.schemas";

describe("banBodySchema", () => {
  it("接受合法的 Supabase ban_duration", () => {
    const samples = ["10m", "2h", "1h30m", "24h", "100y", "500ms", "30s"];
    for (const duration of samples) {
      const parsed = banBodySchema.safeParse({ duration });
      expect(parsed.success).toBe(true);
    }
  });

  it("拒绝 none", () => {
    const parsed = banBodySchema.safeParse({ duration: "none" });
    expect(parsed.success).toBe(false);
  });

  it("拒绝非法格式", () => {
    const samples = ["", "10", "1H", "1h 30m", "abc", "1hour"];
    for (const duration of samples) {
      const parsed = banBodySchema.safeParse({ duration });
      expect(parsed.success).toBe(false);
    }
  });
});

