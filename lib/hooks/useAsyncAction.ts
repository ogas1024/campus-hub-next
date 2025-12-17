"use client";

import { useCallback, useState } from "react";

import { getApiErrorMessage } from "@/lib/api/http";

type RunOptions = {
  fallbackErrorMessage?: string;
};

export function useAsyncAction(options?: RunOptions) {
  const [pending, setPending] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  const reset = useCallback(() => {
    setErrorState(null);
  }, []);

  const setError = useCallback((message: string | null) => {
    setErrorState(message);
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, runOptions?: RunOptions): Promise<T | null> => {
      setPending(true);
      setErrorState(null);
      try {
        return await action();
      } catch (err) {
        setErrorState(getApiErrorMessage(err, runOptions?.fallbackErrorMessage ?? options?.fallbackErrorMessage ?? "操作失败"));
        return null;
      } finally {
        setPending(false);
      }
    },
    [options?.fallbackErrorMessage],
  );

  return { pending, error, run, reset, setError };
}
