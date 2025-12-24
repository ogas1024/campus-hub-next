import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  uiSize?: "default" | "sm";
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, uiSize = "default", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color,color] duration-[var(--motion-duration-hover)] ease-[var(--motion-ease-standard)] focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        uiSize === "sm" ? "h-9" : "h-10",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
