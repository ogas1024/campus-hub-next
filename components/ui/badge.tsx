import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "secondary" | "outline";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  const styles: Record<BadgeVariant, string> = {
    default: "bg-zinc-900 text-white",
    secondary: "bg-zinc-100 text-zinc-900",
    outline: "border border-zinc-200 text-zinc-900",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium leading-none",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

