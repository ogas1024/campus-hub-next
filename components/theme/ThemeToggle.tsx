"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeMode = "system" | "light" | "dark";

function normalizeTheme(value: string | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = mounted ? normalizeTheme(theme) : "system";
  const currentSystemLabel = mounted && resolvedTheme ? (resolvedTheme === "dark" ? "深色" : "浅色") : null;
  const buttonLabel =
    currentTheme === "system"
      ? `系统${currentSystemLabel ? `（${currentSystemLabel}）` : ""}`
      : currentTheme === "dark"
        ? "深色"
        : "浅色";
  const ButtonIcon = currentTheme === "system" ? Laptop : currentTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), className)}
          aria-label={`主题：${buttonLabel}，点击切换`}
        >
          <ButtonIcon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{buttonLabel}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>主题</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentTheme} onValueChange={(value) => setTheme(value)}>
          <DropdownMenuRadioItem value="system">
            <span className="inline-flex items-center gap-2">
              <Laptop className="h-4 w-4" aria-hidden />
              跟随系统{currentSystemLabel ? `（当前：${currentSystemLabel}）` : ""}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <span className="inline-flex items-center gap-2">
              <Sun className="h-4 w-4" aria-hidden />
              浅色
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <span className="inline-flex items-center gap-2">
              <Moon className="h-4 w-4" aria-hidden />
              深色
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
