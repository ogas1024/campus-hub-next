import { describe, expect, it } from "vitest";

import { sanitizeStorageObjectKeyPart } from "@/lib/utils/fileName";

describe("fileName", () => {
  describe("sanitizeStorageObjectKeyPart", () => {
    it("should remove path and unsafe chars", () => {
      expect(sanitizeStorageObjectKeyPart(" C:\\fakepath\\my   file.zip ")).toBe("my_file.zip");
      expect(sanitizeStorageObjectKeyPart("../..//evil.zip")).toBe("evil.zip");
      expect(sanitizeStorageObjectKeyPart("a<>b?.zip")).toBe("a_b.zip");
    });

    it("should handle non-ascii by falling back to file+ext", () => {
      expect(sanitizeStorageObjectKeyPart("学时统计.md")).toBe("file.md");
      expect(sanitizeStorageObjectKeyPart("中文")).toBe("file");
    });
  });
});
