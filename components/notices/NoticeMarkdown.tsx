import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export function NoticeMarkdown({ contentMd }: { contentMd: string }) {
  return (
    <div className="space-y-4 text-sm leading-7 text-zinc-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="text-2xl font-semibold tracking-tight text-zinc-900" {...props} />,
          h2: (props) => <h2 className="text-xl font-semibold tracking-tight text-zinc-900" {...props} />,
          h3: (props) => <h3 className="text-lg font-semibold tracking-tight text-zinc-900" {...props} />,
          p: (props) => <p className="text-sm leading-7 text-zinc-800" {...props} />,
          a: (props) => <a className="text-zinc-900 underline underline-offset-2 hover:text-zinc-700" {...props} />,
          ul: (props) => <ul className="list-disc space-y-1 pl-6" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-6" {...props} />,
          blockquote: (props) => <blockquote className="border-l-4 border-zinc-200 pl-4 text-zinc-700" {...props} />,
          hr: (props) => <hr className="border-zinc-200" {...props} />,
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          th: (props) => <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-700" {...props} />,
          td: (props) => <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700" {...props} />,
          img: ({ className, alt, ...props }) => (
            <img
              {...props}
              alt={alt ?? ""}
              className={cn("max-w-full rounded-xl border border-zinc-200/70", className)}
            />
          ),
          code: ({ className, children, ...props }) => {
            const text = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
            const isBlock = Boolean(className) || text.includes("\n");
            return isBlock ? (
              <code className={cn("text-[13px] leading-6 text-zinc-800", className)} {...props}>
                {children}
              </code>
            ) : (
              <code className={cn("rounded bg-zinc-100 px-1.5 py-0.5 text-[13px] text-zinc-800", className)} {...props}>
                {children}
              </code>
            );
          },
          pre: (props) => <pre className="overflow-auto rounded-lg bg-zinc-950/5 p-4 text-[13px] leading-6" {...props} />,
        }}
      >
        {contentMd}
      </ReactMarkdown>
    </div>
  );
}
