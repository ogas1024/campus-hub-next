import type { Metadata } from "next";
import "@toast-ui/editor/dist/toastui-editor.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Hub",
  description: "校园服务平台（学习项目）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
