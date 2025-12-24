"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleMaterialEditorDialog } from "@/components/materials/ConsoleMaterialEditorDialog";

type Props = {
  currentUserId: string;
  perms: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canPublish: boolean;
    canClose: boolean;
    canArchive: boolean;
    canProcess: boolean;
    canManageAll: boolean;
  };
};

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ConsoleMaterialDialogController(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";
  const noticeId = searchParams.get("noticeId") ?? "";

  const state = useMemo(() => {
    if (dialog === "material-create") {
      return {
        open: true as const,
        mode: "create" as const,
        materialId: undefined,
        createNoticeId: noticeId,
        createNoticeIdLocked: !!noticeId,
      };
    }
    if (dialog === "material-edit" && id) {
      return { open: true as const, mode: "edit" as const, materialId: id, createNoticeId: "", createNoticeIdLocked: false };
    }
    return { open: false as const, mode: "create" as const, materialId: undefined, createNoticeId: "", createNoticeIdLocked: false };
  }, [dialog, id, noticeId]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    next.delete("noticeId");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(materialId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "material-edit");
    next.set("id", materialId);
    next.delete("noticeId");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "material-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <ConsoleMaterialEditorDialog
      open={state.open}
      mode={state.mode}
      materialId={state.materialId}
      createNoticeId={state.createNoticeId}
      createNoticeIdLocked={state.createNoticeIdLocked}
      currentUserId={props.currentUserId}
      perms={props.perms}
      onRequestClose={close}
      onCreated={(materialId) => openEdit(materialId)}
    />
  );
}

