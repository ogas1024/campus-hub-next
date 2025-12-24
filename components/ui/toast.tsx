"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export type ToastOptions = {
  variant?: ToastVariant;
  description?: string;
  durationMs?: number;
};

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

const DEFAULT_DURATION_MS = 2400;

let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

function getServerSnapshot() {
  return [];
}

function remove(id: string) {
  const next = items.filter((it) => it.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

function add(title: string, options?: ToastOptions) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const next: ToastItem = {
    id,
    title,
    description: options?.description,
    variant: options?.variant ?? "info",
  };

  items = [next, ...items].slice(0, 5);
  emit();

  const duration = options?.durationMs ?? DEFAULT_DURATION_MS;
  if (duration > 0) {
    window.setTimeout(() => remove(id), duration);
  }

  return id;
}

export const toast = Object.assign(
  (title: string, options?: ToastOptions) => add(title, options),
  {
    success: (title: string, options?: Omit<ToastOptions, "variant">) => add(title, { ...options, variant: "success" }),
    error: (title: string, options?: Omit<ToastOptions, "variant">) => add(title, { ...options, variant: "error" }),
    info: (title: string, options?: Omit<ToastOptions, "variant">) => add(title, { ...options, variant: "info" }),
    dismiss: (id: string) => remove(id),
  },
);

function variantClassName(variant: ToastVariant) {
  if (variant === "success") return "border-emerald-500/30";
  if (variant === "error") return "border-destructive/40";
  return "border-border";
}

function variantDotClassName(variant: ToastVariant) {
  if (variant === "success") return "bg-emerald-500";
  if (variant === "error") return "bg-destructive";
  return "bg-muted-foreground";
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 space-y-2"
      role="region"
      aria-label="提示"
    >
      {toasts.map((it) => (
        <div
          key={it.id}
          className={cn(
            "ch-enter pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm",
            variantClassName(it.variant),
          )}
          role={it.variant === "error" ? "alert" : "status"}
          aria-live={it.variant === "error" ? "assertive" : "polite"}
        >
          <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", variantDotClassName(it.variant))} aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{it.title}</div>
            {it.description ? <div className="mt-1 text-xs text-muted-foreground">{it.description}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
