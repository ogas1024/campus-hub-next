import { describe, expect, it } from "vitest";

import { buildManifestCsv, buildZipPath, escapeCsvCell, sanitizeForCsvFormula } from "./collect.export";

describe("collect.export", () => {
  describe("sanitizeForCsvFormula", () => {
    it("对公式注入进行前缀转义", () => {
      expect(sanitizeForCsvFormula("=1+1")).toBe("'=1+1");
      expect(sanitizeForCsvFormula("+cmd|'/C calc'!A0")).toBe("'+cmd|'/C calc'!A0");
      expect(sanitizeForCsvFormula("@SUM(1,2)")).toBe("'@SUM(1,2)");
      expect(sanitizeForCsvFormula("-1")).toBe("'-1");
    });

    it("保持普通文本（去掉首尾空白）", () => {
      expect(sanitizeForCsvFormula("  hello  ")).toBe("hello");
      expect(sanitizeForCsvFormula("")).toBe("");
      expect(sanitizeForCsvFormula("   ")).toBe("");
    });
  });

  describe("escapeCsvCell", () => {
    it("始终输出双引号包裹并转义内部双引号", () => {
      expect(escapeCsvCell("a")).toBe("\"a\"");
      expect(escapeCsvCell("a\"b")).toBe("\"a\"\"b\"");
    });
  });

  describe("buildZipPath", () => {
    it("避免路径穿越（去掉路径分隔符与上级目录）", () => {
      const path = buildZipPath({ studentId: "../..", name: "evil", itemTitle: "../x", fileName: "../a.zip" });
      expect(path.includes("..")).toBe(false);
      expect(path).toBe("evil/x/a.zip");
    });

    it("对空值给出兜底", () => {
      const path = buildZipPath({ studentId: "", name: "", itemTitle: "", fileName: "" });
      expect(path).toBe("unknown/未命名材料项/file");
    });
  });

  describe("buildManifestCsv", () => {
    it("输出包含表头与行数据，并对 CSV 注入做防护", () => {
      const csv = buildManifestCsv({
        rows: [
          {
            studentId: "=1+1",
            name: "张三",
            departments: ["计算机学院"],
            submittedAt: null,
            status: "pending",
            missingRequired: true,
            missingRequiredItems: ["身份证"],
            fileCount: 2,
            totalBytes: 10 * 1024 * 1024,
          },
        ],
      });
      expect(csv.split("\n").length).toBe(2);
      expect(csv).toContain("\"'=1+1\""); // sanitizeForCsvFormula + escapeCsvCell
    });
  });
});
