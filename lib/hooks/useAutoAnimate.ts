"use client";

import { useEffect, useRef, useState } from "react";

import autoAnimate, { type AutoAnimateOptions } from "@formkit/auto-animate";

type Options = Partial<AutoAnimateOptions> & {
  enabled?: boolean;
};

function sanitizeOptions(options?: Options): Partial<AutoAnimateOptions> | undefined {
  if (!options) return;
  const { enabled: _enabled, ...rest } = options;
  void _enabled;
  return rest;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    // 兼容旧版 Safari
    const legacy = mq as unknown as {
      addListener: (listener: () => void) => void;
      removeListener: (listener: () => void) => void;
    };
    legacy.addListener(onChange);
    return () => legacy.removeListener(onChange);
  }, []);

  return reduced;
}

/**
 * 白名单动效：为列表/布局高度变化提供克制的自动过渡。
 *
 * 约定：
 * - 默认开启；
 * - 若用户偏好 Reduced Motion，则自动禁用；
 * - 避免在业务代码里散落复杂动画逻辑。
 */
export function useAutoAnimate<T extends HTMLElement>(options?: Options) {
  const enabled = options?.enabled ?? true;
  const prefersReducedMotion = usePrefersReducedMotion();

  const optionsRef = useRef<Partial<AutoAnimateOptions> | undefined>(sanitizeOptions(options));
  const parent = useRef<T | null>(null);
  const controllerRef = useRef<ReturnType<typeof autoAnimate> | null>(null);

  useEffect(() => {
    if (!parent.current) return;
    if (controllerRef.current) return;

    controllerRef.current = autoAnimate(parent.current, optionsRef.current);
    return () => {
      controllerRef.current?.disable();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (!enabled || prefersReducedMotion) controller.disable();
    else controller.enable();
  }, [enabled, prefersReducedMotion]);

  return parent;
}
