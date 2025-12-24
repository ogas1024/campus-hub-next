"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PortalResourceEditorDialog, type FixedCourseContext } from "@/components/course-resources/PortalResourceEditorDialog";

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function PortalResourceDialogController(props: { fixedContext?: FixedCourseContext }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "resource-create") return { open: true as const, mode: "create" as const, resourceId: undefined };
    if (dialog === "resource-edit" && id) return { open: true as const, mode: "edit" as const, resourceId: id };
    return { open: false as const, mode: "create" as const, resourceId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(resourceId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "resource-edit");
    next.set("id", resourceId);
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "resource-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <PortalResourceEditorDialog
      open={state.open}
      mode={state.mode}
      resourceId={state.resourceId}
      fixedContext={props.fixedContext}
      onRequestClose={close}
      onCreated={(resourceId) => openEdit(resourceId)}
    />
  );
}

