"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  href: string;
  status: "available" | "comingSoon";
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalNav({ items }: { items: Item[] }) {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap" aria-label="主导航">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        const className = cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors duration-[var(--motion-duration-hover)] ease-[var(--motion-ease-standard)] focus-visible:ring-1 focus-visible:ring-ring",
          active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        );

        return (
          <Link
            key={item.id}
            href={item.href}
            className={className}
            title={item.status === "comingSoon" ? "建设中" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <span>{item.label}</span>
            {item.status === "comingSoon" ? <Badge variant="secondary">建设中</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}
