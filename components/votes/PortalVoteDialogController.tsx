"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PortalVoteFillDialog } from "@/components/votes/PortalVoteFillDialog";

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function PortalVoteDialogController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "vote-fill" && id) return { open: true as const, voteId: id };
    return { open: false as const, voteId: "" };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "vote-fill" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return <PortalVoteFillDialog open={state.open} voteId={state.voteId} onRequestClose={close} />;
}

