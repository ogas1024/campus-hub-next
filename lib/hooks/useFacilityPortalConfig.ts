"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchFacilityConfig, type FacilityPortalConfigResponse } from "@/lib/api/facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

/**
 * Portal 端功能房预约配置（用于时间轴交互与前置校验）。
 *
 * 说明：
 * - 后续如扩展 Portal 配置项，仅需扩展 `/api/facilities/config` 的响应与此 hook 的返回即可。
 */
export function useFacilityPortalConfig() {
  const { run, pending, error } = useAsyncAction({ fallbackErrorMessage: "加载配置失败" });
  const [config, setConfig] = useState<FacilityPortalConfigResponse | null>(null);

  const refresh = useCallback(async () => {
    const res = await run(() => fetchFacilityConfig());
    if (!res) return null;
    setConfig(res);
    return res;
  }, [run]);

  useEffect(() => {
    void (async () => {
      const res = await run(() => fetchFacilityConfig());
      if (!res) return;
      setConfig(res);
    })();
  }, [run]);

  return { config, pending, error, refresh };
}
