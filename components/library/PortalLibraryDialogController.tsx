"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PortalLibraryBookEditorDialog } from "@/components/library/PortalLibraryBookEditorDialog";

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function PortalLibraryDialogController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "library-create") return { open: true as const, mode: "create" as const, bookId: undefined };
    if (dialog === "library-edit" && id) return { open: true as const, mode: "edit" as const, bookId: id };
    return { open: false as const, mode: "create" as const, bookId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(bookId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "library-edit");
    next.set("id", bookId);
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "library-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <PortalLibraryBookEditorDialog
      open={state.open}
      mode={state.mode}
      bookId={state.bookId}
      onRequestClose={close}
      onCreated={(bookId) => openEdit(bookId)}
    />
  );
}

