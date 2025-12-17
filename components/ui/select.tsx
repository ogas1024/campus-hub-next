import * as React from "react";

import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  uiSize?: "default" | "sm";
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, uiSize = "default", ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        uiSize === "sm" ? "h-9" : "h-10",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";
