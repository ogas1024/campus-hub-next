"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleRoleEditorDialog } from "@/components/rbac/ConsoleRoleEditorDialog";

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ConsoleRoleDialogController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "role-create") return { open: true as const, mode: "create" as const, roleId: undefined };
    if (dialog === "role-edit" && id) return { open: true as const, mode: "edit" as const, roleId: id };
    return { open: false as const, mode: "create" as const, roleId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(roleId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "role-edit");
    next.set("id", roleId);
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "role-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <ConsoleRoleEditorDialog
      open={state.open}
      mode={state.mode}
      roleId={state.roleId}
      onRequestClose={close}
      onCreated={(roleId) => openEdit(roleId)}
    />
  );
}

