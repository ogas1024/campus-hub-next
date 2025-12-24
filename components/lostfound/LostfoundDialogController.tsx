"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LostfoundEditorDialog } from "@/components/lostfound/LostfoundEditorDialog";

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function LostfoundDialogController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "lostfound-create") return { open: true as const, mode: "create" as const, itemId: undefined };
    if (dialog === "lostfound-edit" && id) return { open: true as const, mode: "edit" as const, itemId: id };
    return { open: false as const, mode: "create" as const, itemId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "lostfound-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  useEffect(() => {
    if (dialog !== "lostfound-edit") return;
    if (!id) return;
    if (pathname === "/lostfound/me") return;
    router.replace(`/lostfound/me?dialog=lostfound-edit&id=${encodeURIComponent(id)}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id, pathname]);

  return (
    <LostfoundEditorDialog open={state.open} mode={state.mode} itemId={state.itemId} onRequestClose={close} />
  );
}
