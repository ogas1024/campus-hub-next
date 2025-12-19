/**
 * 用法：
 * - `pnpm -C "campus-hub-next" test` 运行本模块的纯函数单测。
 */

import { describe, expect, it } from "vitest";

import { overlapSeconds, parseDurationMs } from "@/lib/modules/facilities/facilities.utils";

describe("facilities.utils", () => {
  describe("parseDurationMs", () => {
    it("解析单个单位", () => {
      expect(parseDurationMs("10m")).toBe(10 * 60 * 1000);
      expect(parseDurationMs("2h")).toBe(2 * 60 * 60 * 1000);
      expect(parseDurationMs("7d")).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDurationMs("4w")).toBe(4 * 7 * 24 * 60 * 60 * 1000);
    });

    it("解析复合时长", () => {
      expect(parseDurationMs("1h30m")).toBe(1 * 60 * 60 * 1000 + 30 * 60 * 1000);
      expect(parseDurationMs("2d12h")).toBe(2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    });

    it("拒绝非法格式", () => {
      expect(() => parseDurationMs("")).toThrow();
      expect(() => parseDurationMs("0m")).toThrow();
      expect(() => parseDurationMs("1")).toThrow();
      expect(() => parseDurationMs("1h0m")).toThrow();
      expect(() => parseDurationMs("1h-1m")).toThrow();
      expect(() => parseDurationMs("1x")).toThrow();
    });
  });

  describe("overlapSeconds", () => {
    it("边界相等无交集", () => {
      const startA = new Date(0);
      const endA = new Date(10_000);
      const startB = new Date(10_000);
      const endB = new Date(20_000);
      expect(overlapSeconds({ startA, endA, startB, endB })).toBe(0);
    });

    it("部分交集按秒向下取整", () => {
      const startA = new Date(0);
      const endA = new Date(10_000);
      const startB = new Date(5_000);
      const endB = new Date(15_000);
      expect(overlapSeconds({ startA, endA, startB, endB })).toBe(5);

      const startC = new Date(0);
      const endC = new Date(1_500);
      const startD = new Date(1_000);
      const endD = new Date(2_000);
      expect(overlapSeconds({ startA: startC, endA: endC, startB: startD, endB: endD })).toBe(0);
    });
  });
});

