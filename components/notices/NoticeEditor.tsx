"use client";

import { useEffect, useRef } from "react";

import { useTheme } from "next-themes";

type Props = {
  value: string;
  onChange: (nextValue: string) => void;
  height?: string;
  placeholder?: string;
};

export function NoticeEditor({ value, onChange, height = "420px", placeholder }: Props) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<import("@toast-ui/editor").default | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!resolvedTheme) return;
      if (!containerRef.current) return;
      if (editorRef.current) return;

      const Editor = (await import("@toast-ui/editor")).default;
      if (disposed) return;

      const editor = new Editor({
        el: containerRef.current,
        height,
        initialEditType: "wysiwyg",
        previewStyle: "vertical",
        theme: resolvedTheme === "dark" ? "dark" : "light",
        usageStatistics: false,
        initialValue: valueRef.current || "",
        placeholder: placeholder || "",
      });

      editor.on("change", () => {
        onChange(editor.getMarkdown());
      });

      editorRef.current = editor;
    }

    void init();

    return () => {
      disposed = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [height, onChange, placeholder, resolvedTheme]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getMarkdown() === value) return;
    editor.setMarkdown(value || "", false);
  }, [value]);

  return <div ref={containerRef} />;
}
