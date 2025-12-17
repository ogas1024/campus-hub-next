import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export function NoticeMarkdown({ contentMd }: { contentMd: string }) {
  return (
    <div className="space-y-4 text-sm leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="text-2xl font-semibold tracking-tight" {...props} />,
          h2: (props) => <h2 className="text-xl font-semibold tracking-tight" {...props} />,
          h3: (props) => <h3 className="text-lg font-semibold tracking-tight" {...props} />,
          p: (props) => <p className="text-sm leading-7" {...props} />,
          a: (props) => <a className="text-foreground underline underline-offset-2 hover:text-muted-foreground" {...props} />,
          ul: (props) => <ul className="list-disc space-y-1 pl-6" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-6" {...props} />,
          blockquote: (props) => <blockquote className="border-l-4 border-border pl-4 text-muted-foreground" {...props} />,
          hr: (props) => <hr className="border-border" {...props} />,
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          th: (props) => (
            <th className="border-b border-border bg-muted px-3 py-2 text-left text-xs font-semibold text-muted-foreground" {...props} />
          ),
          td: (props) => <td className="border-b border-border px-3 py-2 text-sm" {...props} />,
          img: ({ className, alt, ...props }) => (
            <img
              {...props}
              alt={alt ?? ""}
              className={cn("max-w-full rounded-xl border border-border/70", className)}
            />
          ),
          code: ({ className, children, ...props }) => {
            const text = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
            const isBlock = Boolean(className) || text.includes("\n");
            return isBlock ? (
              <code className={cn("text-[13px] leading-6 text-foreground", className)} {...props}>
                {children}
              </code>
            ) : (
              <code className={cn("rounded bg-muted px-1.5 py-0.5 text-[13px] text-foreground", className)} {...props}>
                {children}
              </code>
            );
          },
          pre: (props) => <pre className="overflow-auto rounded-lg bg-muted p-4 text-[13px] leading-6" {...props} />,
        }}
      >
        {contentMd}
      </ReactMarkdown>
    </div>
  );
}
