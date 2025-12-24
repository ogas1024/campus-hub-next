import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/ui/dialog",
              importNames: ["DialogContent"],
              message: "请使用 StickyFormDialog / ConsoleFormDialog 等统一弹窗壳（滚动内容 + 底部操作栏）。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/common/StickyFormDialog.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["components/notices/NoticeMarkdown.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
