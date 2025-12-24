"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleSurveyEditorDialog } from "@/components/surveys/ConsoleSurveyEditorDialog";

type Props = {
  currentUserId: string;
  perms: {
    canCreate: boolean;
    canUpdate: boolean;
    canPublish: boolean;
    canClose: boolean;
    canDelete: boolean;
    canManageAll: boolean;
  };
};

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ConsoleSurveyDialogController(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "survey-create") return { open: true as const, mode: "create" as const, surveyId: undefined };
    if (dialog === "survey-edit" && id) return { open: true as const, mode: "edit" as const, surveyId: id };
    return { open: false as const, mode: "create" as const, surveyId: undefined };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  function openEdit(surveyId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dialog", "survey-edit");
    next.set("id", surveyId);
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "survey-edit" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return (
    <ConsoleSurveyEditorDialog
      open={state.open}
      mode={state.mode}
      surveyId={state.surveyId}
      currentUserId={props.currentUserId}
      perms={props.perms}
      onRequestClose={close}
      onCreated={(surveyId) => openEdit(surveyId)}
    />
  );
}

