"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleVoteEditorDialog } from "@/components/votes/ConsoleVoteEditorDialog";

type Props = {
  currentUserId: string;
  perms: {
    canCreate: boolean;
    canUpdate: boolean;
    canPublish: boolean;
    canClose: boolean;
    canExtend: boolean;
    canPin: boolean;
    canArchive: boolean;
    canManageAll: boolean;
  };
};

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ConsoleVoteDialogController(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "vote-create") return { open: true as const, mode: "create" as const, voteId: undefined };
    if (dialog === "vote-edit" && id) return { open: true as const, mode: "edit" as const, voteId: id };
    return { open: false as const, mode: "create" as const, voteId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(voteId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "vote-edit");
    next.set("id", voteId);
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "vote-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <ConsoleVoteEditorDialog
      open={state.open}
      mode={state.mode}
      voteId={state.voteId}
      currentUserId={props.currentUserId}
      perms={props.perms}
      onRequestClose={close}
      onCreated={(voteId) => openEdit(voteId)}
    />
  );
}

