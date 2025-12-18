import { describe, expect, it } from "vitest";

import { isAllowedArchiveFileName, normalizeExternalUrl, sanitizeFileName } from "./courseResources.utils";

describe("courseResources.utils", () => {
  describe("isAllowedArchiveFileName", () => {
    it("允许 zip/rar/7z（大小写不敏感）", () => {
      expect(isAllowedArchiveFileName("a.zip")).toBe(true);
      expect(isAllowedArchiveFileName("a.ZIP")).toBe(true);
      expect(isAllowedArchiveFileName("a.rar")).toBe(true);
      expect(isAllowedArchiveFileName("a.7z")).toBe(true);
    });

    it("拒绝非压缩包扩展名", () => {
      expect(isAllowedArchiveFileName("a.tar.gz")).toBe(false);
      expect(isAllowedArchiveFileName("a.zip.exe")).toBe(false);
      expect(isAllowedArchiveFileName("a")).toBe(false);
    });
  });

  describe("sanitizeFileName", () => {
    it("去掉路径并规整空白", () => {
      expect(sanitizeFileName(" C:\\fakepath\\my   file.zip ")).toBe("my file.zip");
      expect(sanitizeFileName("../..//evil.zip")).toBe("evil.zip");
    });

    it("将非法字符替换为下划线", () => {
      expect(sanitizeFileName("a<>b?.zip")).toBe("a__b_.zip");
    });

    it("限制最大长度", () => {
      const input = `${"a".repeat(500)}.zip`;
      expect(sanitizeFileName(input).length).toBeLessThanOrEqual(180);
    });
  });

  describe("normalizeExternalUrl", () => {
    it("补全 scheme 并进行规范化（host/port/hash/path/query）", () => {
      expect(normalizeExternalUrl("example.com/a#x")).toBe("https://example.com/a");
      expect(normalizeExternalUrl("//EXAMPLE.com:443/a///")).toBe("https://example.com/a");
      expect(normalizeExternalUrl("https://example.com/a?b=2&a=1&b=1")).toBe("https://example.com/a?a=1&b=1&b=2");
    });

    it("幂等", () => {
      const once = normalizeExternalUrl("example.com/a?b=2&a=1");
      expect(normalizeExternalUrl(once)).toBe(once);
    });

    it("非法输入抛错", () => {
      expect(() => normalizeExternalUrl("")).toThrow("URL 不能为空");
      expect(() => normalizeExternalUrl("not a url")).toThrow("URL 不合法");
      expect(() => normalizeExternalUrl("ftp://example.com/a")).toThrow("仅支持 http/https");
    });
  });
});

