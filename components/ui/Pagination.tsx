import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
};

function buildPageItems(page: number, totalPages: number) {
  const clampedPage = Math.min(totalPages, Math.max(1, page));
  const candidates = new Set<number>([1, totalPages, clampedPage - 1, clampedPage, clampedPage + 1]);
  const pages = [...candidates].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  for (let i = 0; i < pages.length; i += 1) {
    const current = pages[i];
    const previous = pages[i - 1];
    if (previous && current - previous > 1) items.push("ellipsis");
    items.push(current);
  }

  return { clampedPage, items };
}

export function Pagination({ page, totalPages, hrefForPage }: Props) {
  if (totalPages <= 1) return null;

  const { clampedPage, items } = buildPageItems(page, totalPages);
  const prevDisabled = clampedPage <= 1;
  const nextDisabled = clampedPage >= totalPages;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="分页">
      <div className="text-sm text-zinc-600">
        第 {clampedPage} / {totalPages} 页
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {prevDisabled ? (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            上一页
          </span>
        ) : (
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={hrefForPage(clampedPage - 1)}>
            上一页
          </Link>
        )}

        <div className="flex items-center gap-1">
          {items.map((item, idx) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-sm text-zinc-400">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefForPage(item)}
                aria-current={item === clampedPage ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: item === clampedPage ? "default" : "outline", size: "sm" }),
                  "min-w-9 px-3",
                )}
              >
                {item}
              </Link>
            ),
          )}
        </div>

        {nextDisabled ? (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            下一页
          </span>
        ) : (
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={hrefForPage(clampedPage + 1)}>
            下一页
          </Link>
        )}
      </div>
    </nav>
  );
}
