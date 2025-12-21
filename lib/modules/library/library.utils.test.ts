import { describe, expect, it } from "vitest";

import { assertLibraryFile, normalizeIsbn13, pickDefaultDownloadAssetId } from "@/lib/modules/library/library.utils";

describe("library.utils", () => {
  describe("normalizeIsbn13", () => {
    it("规范化 ISBN-13（允许连字符/空格）", () => {
      expect(normalizeIsbn13("978-7-111-12233-3")).toBe("9787111122333");
      expect(normalizeIsbn13(" 978 7 111 12233 3 ")).toBe("9787111122333");
    });

    it("拒绝非法 ISBN-13", () => {
      expect(() => normalizeIsbn13("")).toThrow("ISBN 不能为空");
      expect(() => normalizeIsbn13("123")).toThrow("ISBN 必须为 13 位数字");
      expect(() => normalizeIsbn13("9787111122334")).toThrow("ISBN 校验位不正确");
    });
  });

  describe("assertLibraryFile", () => {
    it("校验格式与大小（100MB）", () => {
      assertLibraryFile({ format: "pdf", fileName: "a.pdf", size: 1 });
      expect(() => assertLibraryFile({ format: "pdf", fileName: "a.epub", size: 1 })).toThrow("文件扩展名必须为 .pdf");
      expect(() => assertLibraryFile({ format: "pdf", fileName: "a.pdf", size: 0 })).toThrow("文件大小必须大于 0");
      expect(() => assertLibraryFile({ format: "pdf", fileName: "a.pdf", size: 101 * 1024 * 1024 })).toThrow("文件大小不能超过 100MB");
    });
  });

  describe("pickDefaultDownloadAssetId", () => {
    it("按格式优先级选择默认下载资产", () => {
      expect(
        pickDefaultDownloadAssetId([
          { id: "a1", assetType: "file", fileFormat: "epub" },
          { id: "a2", assetType: "file", fileFormat: "pdf" },
        ]),
      ).toBe("a2");

      expect(
        pickDefaultDownloadAssetId([
          { id: "l1", assetType: "link", fileFormat: null },
          { id: "a1", assetType: "file", fileFormat: "zip" },
        ]),
      ).toBe("a1");

      expect(
        pickDefaultDownloadAssetId([
          { id: "l1", assetType: "link", fileFormat: null },
        ]),
      ).toBe("l1");
    });
  });
});

