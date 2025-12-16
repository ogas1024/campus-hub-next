"use client";

import { useEffect } from "react";

export function NoticeReadMarker({ noticeId }: { noticeId: string }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/notices/${noticeId}/read`, { method: "POST", signal: controller.signal });
    return () => controller.abort();
  }, [noticeId]);

  return null;
}

