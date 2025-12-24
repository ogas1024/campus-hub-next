"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PortalNoticeViewerDialog } from "@/components/notices/PortalNoticeViewerDialog";

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function PortalNoticeDialogController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "notice-view" && id) return { open: true as const, noticeId: id };
    return { open: false as const, noticeId: "" };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "notice-view" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return <PortalNoticeViewerDialog open={state.open} noticeId={state.noticeId} onRequestClose={close} />;
}

