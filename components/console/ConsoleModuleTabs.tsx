"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type ConsoleModuleTab = {
  id: string;
  label: string;
  href: string;
};

type Props = {
  ariaLabel: string;
  tabs: ConsoleModuleTab[];
  activeId?: string;
};

export function ConsoleModuleTabs({ ariaLabel, tabs, activeId }: Props) {
  const pathname = usePathname();

  if (tabs.length === 0) return null;

  return (
    <nav aria-label={ariaLabel}>
      <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
        {tabs.map((t) => {
          const active = activeId ? t.id === activeId : isActive(pathname, t.href);
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
                active ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50 hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
