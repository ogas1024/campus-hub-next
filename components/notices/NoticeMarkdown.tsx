import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function NoticeMarkdown({ contentMd }: { contentMd: string }) {
  return (
    <div className="space-y-4 text-sm leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="text-2xl font-semibold leading-9" {...props} />,
          h2: (props) => <h2 className="text-xl font-semibold leading-8" {...props} />,
          h3: (props) => <h3 className="text-lg font-semibold leading-7" {...props} />,
          p: (props) => <p className="text-sm leading-7" {...props} />,
          a: (props) => (
            <a className="text-blue-600 underline underline-offset-2 hover:text-blue-700" {...props} />
          ),
          ul: (props) => <ul className="list-disc pl-6" {...props} />,
          ol: (props) => <ol className="list-decimal pl-6" {...props} />,
          li: (props) => <li className="my-1" {...props} />,
          blockquote: (props) => (
            <blockquote className="border-l-4 border-zinc-200 pl-4 text-zinc-700" {...props} />
          ),
          code: (props) => <code className="rounded bg-zinc-100 px-1 py-0.5" {...props} />,
          pre: (props) => <pre className="overflow-auto rounded bg-zinc-100 p-4" {...props} />,
        }}
      >
        {contentMd}
      </ReactMarkdown>
    </div>
  );
}
