"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleUserEditorDialog } from "@/components/iam/ConsoleUserEditorDialog";

type Props = {
  perms: {
    canCreate: boolean;
    canInvite: boolean;
    canApprove: boolean;
    canDisable: boolean;
    canBan: boolean;
    canDelete: boolean;
    canAssignRole: boolean;
    canAssignOrg: boolean;
  };
};

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ConsoleUserDialogController(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "user-create") return { open: true as const, mode: "create" as const, userId: undefined };
    if (dialog === "user-edit" && id) return { open: true as const, mode: "edit" as const, userId: id };
    return { open: false as const, mode: "create" as const, userId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(userId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "user-edit");
    next.set("id", userId);
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "user-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <ConsoleUserEditorDialog
      open={state.open}
      mode={state.mode}
      userId={state.userId}
      perms={props.perms}
      onRequestClose={close}
      onCreated={(userId) => openEdit(userId)}
    />
  );
}

