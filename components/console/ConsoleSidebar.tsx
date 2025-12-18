"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { ChevronDown } from "lucide-react";

import type { ConsoleNavGroup } from "@/lib/navigation/modules";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/console") return pathname === "/console";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  groups: Array<Pick<ConsoleNavGroup, "id" | "label"> & { items: Array<{ id: string; label: string; href: string }> }>;
};

export function ConsoleSidebar({ groups }: Props) {
  const pathname = usePathname();

  const groupsWithActive = useMemo(() => {
    return groups.map((g) => ({ ...g, hasActive: g.items.some((it) => isActive(pathname, it.href)) }));
  }, [groups, pathname]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groupsWithActive) initial[g.id] = g.id === "infra" || g.hasActive;
    return initial;
  });

  return (
    <nav className="space-y-2" aria-label="Console 导航">
      {groupsWithActive.map((group) => {
        const isOpen = group.hasActive ? true : (openMap[group.id] ?? false);

        return (
          <Collapsible
            key={group.id}
            open={isOpen}
            onOpenChange={(nextOpen) => {
              setOpenMap((prev) => ({ ...prev, [group.id]: nextOpen }));
            }}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground",
                  group.hasActive ? "bg-accent text-accent-foreground" : null,
                )}
              >
                <span className="truncate">{group.label}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen ? "rotate-180" : null)} />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-1 space-y-1 px-1 pb-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      active ? "bg-muted text-foreground" : null,
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}
