"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleNoticeEditorDialog } from "@/components/notices/ConsoleNoticeEditorDialog";

type Props = {
  currentUserId: string;
  perms: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canPin: boolean;
    canPublish: boolean;
    canManageAll: boolean;
    canAuditList: boolean;
  };
};

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ConsoleNoticeDialogController(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "notice-create") return { open: true as const, mode: "create" as const, noticeId: undefined };
    if (dialog === "notice-edit" && id) return { open: true as const, mode: "edit" as const, noticeId: id };
    return { open: false as const, mode: "create" as const, noticeId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(noticeId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "notice-edit");
    next.set("id", noticeId);
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "notice-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <ConsoleNoticeEditorDialog
      open={state.open}
      mode={state.mode}
      noticeId={state.noticeId}
      currentUserId={props.currentUserId}
      perms={props.perms}
      onRequestClose={close}
      onCreated={(noticeId) => openEdit(noticeId)}
    />
  );
}
