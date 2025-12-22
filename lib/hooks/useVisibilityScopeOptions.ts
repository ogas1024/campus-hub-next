import { useCallback, useEffect, useRef, useState } from "react";

import { ApiResponseError } from "@/lib/api/http";

type Options = {
  enabled?: boolean;
  silent?: boolean;
  fallbackErrorMessage?: string;
};

export function useVisibilityScopeOptions<TOptions>(fetcher: () => Promise<TOptions>, options?: Options) {
  const enabled = options?.enabled ?? true;
  const silent = options?.silent ?? false;
  const fallbackErrorMessage = options?.fallbackErrorMessage ?? "加载可见范围选项失败";

  const [data, setData] = useState<TOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    if (!silent) setError(null);

    try {
      const next = await fetcher();
      if (requestId !== requestIdRef.current) return;
      setData(next);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (!silent) setError(err instanceof ApiResponseError ? err.message : fallbackErrorMessage);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }, [enabled, fetcher, fallbackErrorMessage, silent]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    return () => {
      requestIdRef.current += 1;
    };
  }, [enabled, reload]);

  return { options: data, loading, error, reload };
}

